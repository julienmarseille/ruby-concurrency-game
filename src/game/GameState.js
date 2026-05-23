import { TICK_MS, MEM_BASE, MEM_MAX, THREAD_MEM, REQ_TYPES, EVENTS } from '../config.js';
import { UPGRADES } from '../UpgradeConfig.js';
import { MetricsComputer } from './MetricsComputer.js';

export class GameState {
  constructor(events) {
    this._events    = events;
    this.money      = 1000;
    this.completed  = 0;
    this.tick       = 0;
    this.threads    = [];
    this.queue      = [];
    this.recentDone = [];
    this.gvlHolder  = null;
    this._reqId     = 0;
    this._threadId  = 0;
    this.upgrades   = new Set();
    this._metrics   = new MetricsComputer();
  }

  hasUpgrade(id) { return this.upgrades.has(id); }

  buyUpgrade(id) {
    const def = UPGRADES[id];
    if (!def || this.upgrades.has(id)) return false;
    if (this.money < def.cost) return false;
    this.money -= def.cost;
    this.upgrades.add(id);
    this._events.emit(EVENTS.UPGRADE_UNLOCKED, id);
    if (id === 'mixed_requests')  this._injectRequests('MIXED',  30);
    if (id === 'report_requests') this._injectRequests('REPORT', 30);
    return true;
  }

  _injectRequests(type, count) {
    for (let i = 0; i < count; i++) {
      const req = { id: ++this._reqId, type, def: REQ_TYPES[type] };
      this.queue.push(req);
      this._events.emit(EVENTS.REQUEST_SPAWNED, req);
    }
  }

  availableUpgrades() {
    return Object.values(UPGRADES).filter(u => !this.upgrades.has(u.id));
  }

  shopData() {
    const MAX_THREADS = 8;
    const threadNodes = Array.from({ length: MAX_THREADS }, (_, i) => {
      const n     = i + 1;
      const owned = this.threads.length >= n;
      const ramOk = MEM_BASE + n * THREAD_MEM <= MEM_MAX;
      const cost  = n === 1 ? 0 : 100;
      return {
        id:         `thread_${n}`,
        name:       n === 1 ? 'Start Server' : `Thread ${n}`,
        icon:       n === 1 ? '🚀' : '🧵',
        desc:       `OS thread · shares the GVL · uses ${THREAD_MEM}MB RAM`,
        cost,
        isThread:   true,
        isFree:     cost === 0,
        owned,
        unlocked:   (n === 1 || this.threads.length >= n - 1) && ramOk,
        affordable: owned || cost === 0 || this.money >= cost,
        moneyPct:   cost > 0 ? Math.min(1, this.money / cost) : 1,
      };
    });
    const upgrades = Object.values(UPGRADES).map(u => ({
      ...u,
      isThread:   false,
      owned:      this.upgrades.has(u.id),
      unlocked:   !u.requires || this.upgrades.has(u.requires),
      affordable: this.money >= u.cost,
      moneyPct:   Math.min(1, this.money / u.cost),
    }));
    return [...threadNodes, ...upgrades];
  }

  addThread(free = false) {
    const nextMem = MEM_BASE + (this.threads.length + 1) * THREAD_MEM;
    if (nextMem > MEM_MAX) return false;
    if (!free && this.money < 100) return false;
    if (!free) this.money -= 100;

    const id = ++this._threadId;
    const thread = {
      id,
      label:        `Thread ${id}`,
      status:       'idle',
      request:      null,
      phaseIdx:     0,
      phaseElapsed: 0,
      phaseRunWall: null,
      receivedAt:   null,
      pendingUntil: 0,
    };
    this.threads.push(thread);
    this._events.emit(EVENTS.THREAD_ADDED, thread);
    return true;
  }

  spawnRequest() {
    if (this.queue.length > 12) return null;
    const pool = ['DB_REQUEST', 'DB_REQUEST', 'DB_REQUEST'];
    if (this.hasUpgrade('mixed_requests'))  pool.push('MIXED', 'MIXED');
    if (this.hasUpgrade('report_requests')) pool.push('REPORT');
    const type = pool[Math.floor(Math.random() * pool.length)];
    const req  = { id: ++this._reqId, type, def: REQ_TYPES[type] };
    this.queue.push(req);
    this._events.emit(EVENTS.REQUEST_SPAWNED, req);
    return req;
  }

  autoSpawnRequests() {
    if (this.queue.length < 5) {
      while (this.queue.length < 7) this.spawnRequest();
    } else if (this.queue.length < 10) {
      this.spawnRequest();
    }
  }

  step() {
    this.tick++;

    for (const t of this.threads) {
      if (t.status === 'idle' && this.queue.length > 0) {
        const req = this.queue.shift();
        t.request      = req;
        t.phaseIdx     = 0;
        t.phaseElapsed = 0;
        t.phaseRunWall = null;
        t.status       = 'incoming';
        t.receivedAt   = performance.now();
        this._events.emit(EVENTS.REQUEST_ASSIGNED, { thread: t, req });
      }
    }

    let waiting = 0, active = 0;
    const now = performance.now();

    for (const t of this.threads) {
      if (!t.request) { t.status = 'idle'; t.phaseRunWall = null; continue; }
      if (t.pendingUntil && now < t.pendingUntil) { active++; continue; }
      active++;
      const phase = t.request.def.phases[t.phaseIdx];

      if (phase.type === 'cpu') {
        if (this.gvlHolder === null || this.gvlHolder === t.id) {
          this.gvlHolder = t.id;
          if (t.status !== 'cpu') t.phaseRunWall = null;
          t.status       = 'cpu';
          t.phaseElapsed += TICK_MS;
          t.phaseRunWall  = now;
        } else {
          t.status       = 'gvl_wait';
          t.phaseRunWall = null;
          waiting++;
        }
      } else {
        if (this.gvlHolder === t.id) { this.gvlHolder = null; this._grantGVL(); }
        t.status       = 'io';
        t.phaseElapsed += TICK_MS;
        t.phaseRunWall  = now;
      }

      if (t.phaseElapsed >= phase.ms) {
        t.phaseIdx++;
        t.phaseElapsed = 0;
        t.phaseRunWall = null;
        if (t.phaseIdx >= t.request.def.phases.length) this._complete(t);
      }
    }

    if (this.gvlHolder === null) this._grantGVL();

    this._metrics.sample(waiting, active);
  }

  get throughputWindow() { return this._metrics.throughputWindow; }
  get overviewWindow()   { return this._metrics.overviewWindow; }
  get gvlWaitPct()       { return this._metrics.gvlWaitPct; }
  get totalActiveTicks() { return this._metrics.hasData; }
  get threadCost()       { return this.threads.length === 0 ? 0 : 100; }
  get threadName()       { return this.threads.length === 0 ? '🚀 Start your server' : '➕ Add Thread'; }
  get memUsed()          { return MEM_BASE + this.threads.length * THREAD_MEM; }
  get memPct()           { return this.memUsed / MEM_MAX; }
  get canAddThread()     { return MEM_BASE + (this.threads.length + 1) * THREAD_MEM <= MEM_MAX; }
  get gvlHolderThread()  { return this.threads.find(t => t.id === this.gvlHolder) ?? null; }

  _grantGVL() {
    const w = this.threads.find(t => t.status === 'gvl_wait');
    if (w) { this.gvlHolder = w.id; w.status = 'cpu'; w.phaseRunWall = performance.now(); }
  }

  _complete(t) {
    const req = t.request;
    this.money += req.def.reward;
    this.completed++;
    this._metrics.recordCompletion();
    this.recentDone.unshift({ emoji: req.def.emoji, sub: req.def.sub, reward: req.def.reward, id: req.id });
    if (this.recentDone.length > 14) this.recentDone.pop();
    if (this.gvlHolder === t.id) this.gvlHolder = null;
    t.request = null; t.status = 'idle'; t.phaseIdx = 0; t.phaseElapsed = 0; t.phaseRunWall = null;
    this._events.emit(EVENTS.REQUEST_COMPLETED, req);
  }
}
