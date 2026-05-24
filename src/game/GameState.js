import { TICK_MS, MEM_BASE, MEM_MAX, THREAD_MEM, PROCESS_MEM, REQ_TYPES, EVENTS } from '../config.js';
import { UPGRADES } from '../UpgradeConfig.js';
import { MetricsComputer } from './MetricsComputer.js';

export class GameState {
  constructor(events) {
    this._events     = events;
    this.money       = 1000;
    this.completed   = 0;
    this.tick        = 0;
    this.threads     = [];
    this.queue       = [];
    this.recentDone  = [];
    this.processes   = [];
    this._reqId      = 0;
    this._threadId   = 0;
    this._processId  = 0;
    this.upgrades    = new Set();
    this._metrics    = new MetricsComputer();
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

  addFirstProcess() {
    if (this.processes.length > 0) return false;
    const proc = { id: ++this._processId, gvlHolder: null };
    this.processes.push(proc);
    this._events.emit(EVENTS.PROCESS_ADDED, proc);
    return true;
  }

  addProcess() {
    if (this.processes.length >= 3) return false;
    const cost = 150;
    if (this.money < cost) return false;
    if (this.memUsed + PROCESS_MEM > MEM_MAX) return false;
    this.money -= cost;
    const proc = { id: ++this._processId, gvlHolder: null };
    this.processes.push(proc);
    this._redistributeThreads();
    this._events.emit(EVENTS.PROCESS_ADDED, proc);
    return true;
  }

  _redistributeThreads() {
    const n     = this.processes.length;
    const total = this.threads.length;
    const base  = Math.floor(total / n);
    const extra = total % n;
    let idx = 0;
    for (let pi = 0; pi < n; pi++) {
      const count = base + (pi < extra ? 1 : 0);
      const pid   = this.processes[pi].id;
      for (let j = 0; j < count; j++) {
        if (idx < total) this.threads[idx++].processId = pid;
      }
    }
    for (const proc of this.processes) proc.gvlHolder = null;
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
    const MAX_THREADS  = 12;
    const hasProcess1  = this.processes.length >= 1;
    const threadNodes  = Array.from({ length: MAX_THREADS }, (_, i) => {
      const n     = i + 1;
      const owned = this.threads.length >= n;
      const ramOk = this.memUsed + THREAD_MEM <= MEM_MAX;
      const cost  = 100;
      return {
        id:         `thread_${n}`,
        name:       `Thread ${n}`,
        icon:       '🧵',
        desc:       `OS thread · shares the GVL · uses ${THREAD_MEM}MB RAM`,
        cost,
        isThread:   true,
        isFree:     false,
        owned,
        unlocked:   hasProcess1 && (this.threads.length >= n - 1) && (owned || ramOk),
        affordable: owned || this.money >= cost,
        moneyPct:   Math.min(1, this.money / cost),
      };
    });
    const hasThread1 = this.threads.length >= 1;
    const upgrades = Object.values(UPGRADES).map(u => {
      const requiresMet = !u.requires || this.upgrades.has(u.requires);
      const parentMet   = (u.id === 'request_tracing' || u.id === 'mixed_requests') ? hasThread1 : true;
      return {
        ...u,
        isThread:   false,
        owned:      this.upgrades.has(u.id),
        unlocked:   requiresMet && parentMet,
        affordable: this.money >= u.cost,
        moneyPct:   Math.min(1, this.money / u.cost),
      };
    });
    const processNodes = [1, 2, 3].map(n => {
      const owned  = this.processes.length >= n;
      const isFree = n === 1;
      const cost   = isFree ? 0 : 150;
      const ramOk  = n === 1 ? true : this.memUsed + PROCESS_MEM <= MEM_MAX;
      return {
        id:         `process_${n}`,
        name:       n === 1 ? 'Start Server' : `Process ${n}`,
        icon:       '⚙️',
        desc:       n === 1
          ? 'Create your Ruby process — the server entry point.'
          : `Fork a new process — own GVL, no CPU contention. +${PROCESS_MEM}MB RAM.`,
        cost,
        isProcess:  true,
        isFree:     isFree,
        owned,
        unlocked:   n === 1 ? true : (this.threads.length >= 1 && this.processes.length >= n - 1 && (owned || ramOk)),
        affordable: owned || isFree || this.money >= cost,
        moneyPct:   cost > 0 ? Math.min(1, this.money / cost) : 1,
      };
    });
    return [...processNodes, ...threadNodes, ...upgrades];
  }

  addThread(free = false, processId = null) {
    if (this.memUsed + THREAD_MEM > MEM_MAX) return false;
    if (!free && this.money < 100) return false;
    if (!free) this.money -= 100;

    const pid = processId ?? this._leastLoadedProcessId();
    const id  = ++this._threadId;
    const thread = {
      id,
      processId:    pid,
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

  _leastLoadedProcessId() {
    if (this.processes.length === 0) return 1;
    let minCount = Infinity, minId = this.processes[0].id;
    for (const proc of this.processes) {
      const count = this.threads.filter(t => t.processId === proc.id).length;
      if (count < minCount) { minCount = count; minId = proc.id; }
    }
    return minId;
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
      const proc  = this.processes.find(p => p.id === t.processId);

      if (phase.type === 'cpu') {
        if (proc.gvlHolder === null || proc.gvlHolder === t.id) {
          proc.gvlHolder = t.id;
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
        if (proc.gvlHolder === t.id) { proc.gvlHolder = null; this._grantGVL(proc); }
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

    for (const proc of this.processes) {
      if (proc.gvlHolder === null) this._grantGVL(proc);
    }

    this._metrics.sample(waiting, active);
  }

  get throughputWindow() { return this._metrics.throughputWindow; }
  get overviewWindow()   { return this._metrics.overviewWindow; }
  get gvlWaitPct()       { return this._metrics.gvlWaitPct; }
  get totalActiveTicks() { return this._metrics.hasData; }
  get threadCost()       { return this.threads.length === 0 ? 0 : 100; }
  get threadName()       { return this.threads.length === 0 ? '🚀 Start your server' : '➕ Add Thread'; }
  get memUsed()          { return MEM_BASE + Math.max(0, this.processes.length - 1) * PROCESS_MEM + this.threads.length * THREAD_MEM; }
  get memPct()           { return this.memUsed / MEM_MAX; }
  get canAddThread()     { return this.memUsed + THREAD_MEM <= MEM_MAX; }
  get gvlHolder()        { return this.processes[0]?.gvlHolder ?? null; }
  get gvlHolderThread()  { return this.threads.find(t => t.id === this.gvlHolder) ?? null; }

  _grantGVL(proc) {
    const w = this.threads.find(t => t.processId === proc.id && t.status === 'gvl_wait');
    if (w) { proc.gvlHolder = w.id; w.status = 'cpu'; w.phaseRunWall = performance.now(); }
  }

  _complete(t) {
    const req  = t.request;
    const proc = this.processes.find(p => p.id === t.processId);
    this.money += req.def.reward;
    this.completed++;
    this._metrics.recordCompletion();
    this.recentDone.unshift({ emoji: req.def.emoji, sub: req.def.sub, reward: req.def.reward, id: req.id });
    if (this.recentDone.length > 14) this.recentDone.pop();
    if (proc && proc.gvlHolder === t.id) proc.gvlHolder = null;
    t.request = null; t.status = 'idle'; t.phaseIdx = 0; t.phaseElapsed = 0; t.phaseRunWall = null;
    this._events.emit(EVENTS.REQUEST_COMPLETED, req);
  }
}
