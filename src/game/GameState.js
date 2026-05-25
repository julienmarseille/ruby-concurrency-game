import { TICK_MS, MEM_BASE, MEM_MAX, THREAD_MEM, PROCESS_MEM, EVENTS } from '../config.js';
import { UPGRADES }        from '../UpgradeConfig.js';
import { MetricsComputer } from './MetricsComputer.js';
import { GVLScheduler }    from './GVLScheduler.js';
import { RequestFactory }  from './RequestFactory.js';
import { SpawnStrategy }   from './SpawnStrategy.js';

const THREAD_COST  = 100;
const PROCESS_COST = 150;

export class GameState {
  _nextProcessId = 0;
  _nextThreadId  = 0;

  constructor(events) {
    this._events         = events;
    this._gvl            = new GVLScheduler();
    this._requestFactory = new RequestFactory();
    this._spawnStrategy  = new SpawnStrategy();
    this._metrics        = new MetricsComputer();

    this.money      = 1000;
    this.completed  = 0;
    this.tick       = 0;
    this.threads    = [];
    this.queue      = [];
    this.recentDone = [];
    this.processes  = [];
    this.upgrades   = new Set();
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
    const proc = { id: ++this._nextProcessId, gvlHolder: null };
    this.processes.push(proc);
    this._events.emit(EVENTS.PROCESS_ADDED, proc);
    return true;
  }

  addProcess() {
    if (this.processes.length >= 3) return false;
    if (this.money < PROCESS_COST) return false;
    if (this.memUsed + PROCESS_MEM > MEM_MAX) return false;
    this.money -= PROCESS_COST;
    const proc = { id: ++this._nextProcessId, gvlHolder: null };
    this.processes.push(proc);
    this._redistributeThreads();
    this._events.emit(EVENTS.PROCESS_ADDED, proc);
    return true;
  }

  addThread(free = false, processId = null) {
    if (this.memUsed + THREAD_MEM > MEM_MAX) return false;
    if (!free && this.money < THREAD_COST) return false;
    if (!free) this.money -= THREAD_COST;

    const pid    = processId ?? this._leastLoadedProcessId();
    const id     = ++this._nextThreadId;
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

  spawnRequest() {
    if (this.queue.length > 12) return null;
    const pool = this._spawnStrategy.buildPool(this.upgrades);
    const req  = this._requestFactory.createRandom(pool);
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
    const now = performance.now();

    for (const t of this.threads) {
      if (t.status === 'idle' && this.queue.length > 0) {
        const req      = this.queue.shift();
        t.request      = req;
        t.phaseIdx     = 0;
        t.phaseElapsed = 0;
        t.phaseRunWall = null;
        t.status       = 'incoming';
        t.receivedAt   = now;
        this._events.emit(EVENTS.REQUEST_ASSIGNED, { thread: t, req });
      }
    }

    let waiting = 0, active = 0;

    for (const t of this.threads) {
      if (!t.request) { t.status = 'idle'; t.phaseRunWall = null; continue; }
      if (t.pendingUntil && now < t.pendingUntil) { active++; continue; }
      active++;

      const phase = t.request.def.phases[t.phaseIdx];
      const proc  = this.processes.find(p => p.id === t.processId);
      const canAdvance = this._gvl.stepThread(t, phase, proc);

      if (!canAdvance) { waiting++; continue; }

      t.phaseElapsed += TICK_MS;
      t.phaseRunWall  = now;

      if (t.phaseElapsed >= phase.ms) {
        t.phaseIdx++;
        t.phaseElapsed = 0;
        t.phaseRunWall = null;
        if (t.phaseIdx >= t.request.def.phases.length) this._complete(t);
      }
    }

    this._gvl.postStep(this.processes, this.threads, now);
    this._metrics.sample(waiting, active);
  }

  get throughputWindow() { return this._metrics.throughputWindow; }
  get overviewWindow()   { return this._metrics.overviewWindow; }
  get gvlWaitPct()       { return this._metrics.gvlWaitPct; }
  get totalActiveTicks() { return this._metrics.hasData; }
  get threadCost()       { return this.threads.length === 0 ? 0 : THREAD_COST; }
  get threadName()       { return this.threads.length === 0 ? '🚀 Start your server' : '➕ Add Thread'; }
  get memUsed()          { return MEM_BASE + Math.max(0, this.processes.length - 1) * PROCESS_MEM + this.threads.length * THREAD_MEM; }
  get memPct()           { return this.memUsed / MEM_MAX; }
  get canAddThread()     { return this.memUsed + THREAD_MEM <= MEM_MAX; }

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

  _leastLoadedProcessId() {
    if (this.processes.length === 0) return 1;
    let minCount = Infinity, minId = this.processes[0].id;
    for (const proc of this.processes) {
      const count = this.threads.filter(t => t.processId === proc.id).length;
      if (count < minCount) { minCount = count; minId = proc.id; }
    }
    return minId;
  }

  _injectRequests(type, count) {
    for (let i = 0; i < count; i++) {
      const req = this._requestFactory.create(type);
      this.queue.push(req);
      this._events.emit(EVENTS.REQUEST_SPAWNED, req);
    }
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
