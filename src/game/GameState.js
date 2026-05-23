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
    this.phase      = 1;
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
    return true;
  }

  availableUpgrades() {
    return Object.values(UPGRADES).filter(u => !this.upgrades.has(u.id));
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
    const pool = this.phase === 1
      ? ['DB_REQUEST', 'DB_REQUEST', 'DB_REQUEST']
      : ['DB_REQUEST', 'DB_REQUEST', 'MIXED', 'REPORT'];
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

    if (this.phase === 1 && this.money >= 100) {
      this.phase = 2;
      this._events.emit(EVENTS.PHASE_CHANGED, 2);
    }

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
