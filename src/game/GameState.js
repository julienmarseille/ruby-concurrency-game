import { TICK_MS, MEM_BASE, MEM_NANO, THREAD_MEM, PROCESS_MEM, threadCostFor, processCostFor, BASE_SPAWN_RATE, FIBER_MEM, EVENTS, OOM_RESTART_TICKS } from '../config.js';
import { UPGRADES } from '../UpgradeConfig.js';

const VPS_TIERS = ['large_vps', 'medium_vps', 'small_vps', 'nano_vps'];
import { MetricsComputer }         from './MetricsComputer.js';
import { ProcessMetricsComputer }  from './ProcessMetricsComputer.js';
import { GVLScheduler }            from './GVLScheduler.js';
import { RequestFactory }          from './RequestFactory.js';
import { SpawnStrategy }           from './SpawnStrategy.js';

export class GameState {
  _nextProcessId  = 0;
  _nextThreadId   = 0;
  _nextFiberId    = 1000;
  _fibersEnabled  = false;
  _ractorsEnabled = false;
  _restartTicks   = 0;
  _maxThreadsEver  = 0;
  _spawnFracAccum  = 0;

  constructor(events) {
    this._events          = events;
    this._gvl             = new GVLScheduler();
    this._requestFactory  = new RequestFactory();
    this._spawnStrategy   = new SpawnStrategy();
    this._metrics         = new MetricsComputer();
    this._processMetrics  = new ProcessMetricsComputer();

    this.money      = 100;
    this.completed  = 0;
    this.tick       = 0;
    this.threads    = [];
    this.queue      = [];
    this.recentDone = [];
    this.processes  = [];
    this.upgrades   = new Set();
    this.memMax     = MEM_NANO;
  }

  hasUpgrade(id) { return this.upgrades.has(id); }

  buyUpgrade(id) {
    const def = UPGRADES[id];
    if (!def || this.upgrades.has(id)) return false;
    if (this.money < def.cost) return false;
    this.money -= def.cost;
    this.upgrades.add(id);
    this._events.emit(EVENTS.UPGRADE_UNLOCKED, id);
    if (id === 'mixed_requests')   this._injectRequests('MIXED',  30);
    if (id === 'report_requests')  this._injectRequests('REPORT', 30);
    if (id === 'fiber_scheduler')  this._enableFibers();
    if (id === 'ractors')          this._enableRactors();
    return true;
  }

  addFirstProcess() {
    if (this.processes.length > 0) return false;
    const proc = { id: ++this._nextProcessId, gvlHolder: null };
    this.processes.push(proc);
    this._events.emit(EVENTS.PROCESS_ADDED, proc);
    return true;
  }

  get coreCount() {
    for (const id of VPS_TIERS) {
      if (this.upgrades.has(id)) return UPGRADES[id].cores;
    }
    return 0;
  }

  addProcess() {
    if (this.processes.length >= 4) return false;
    if (this.processes.length >= this.coreCount) return false;
    const procCost = processCostFor(this.processes.length + 1);
    if (this.money < procCost) return false;
    if (this.memUsed + PROCESS_MEM > this.memMax) return false;
    this.money -= procCost;
    const proc = { id: ++this._nextProcessId, gvlHolder: null };
    this.processes.push(proc);
    this._redistributeThreads();
    this._events.emit(EVENTS.PROCESS_ADDED, proc);
    // In fiber mode, each process gets 1 thread — restore for free if already paid for
    if (this._fibersEnabled && this.threads.length < this._maxThreadsEver) {
      this.addThread(true, proc.id);
    }
    return true;
  }

  addThread(free = false, processId = null) {
    if (this.memUsed + THREAD_MEM > this.memMax) return false;
    const cost = threadCostFor(this.threads.length + 1);
    if (!free && this.money < cost) return false;
    if (!free) this.money -= cost;

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
      extraFibers:  [],
      cpuFiberId:   null,
      fiberHost:    this._fibersEnabled,
      ractorHost:   this._ractorsEnabled,
    };
    this.threads.push(thread);
    if (!free) this._maxThreadsEver = Math.max(this._maxThreadsEver, this.threads.length);
    this._events.emit(EVENTS.THREAD_ADDED, thread);
    return true;
  }

  spawnRequest() {
    if (this.queue.length > 100) return null;
    const pool = this._spawnStrategy.buildPool(this.upgrades);
    const req  = this._requestFactory.createRandom(pool);
    this.queue.push(req);
    this._events.emit(EVENTS.REQUEST_SPAWNED, req);
    return req;
  }

  autoSpawnRequests() {
    this._spawnFracAccum += this.spawnRate;
    const n = Math.floor(this._spawnFracAccum);
    this._spawnFracAccum -= n;
    for (let i = 0; i < n; i++) this.spawnRequest();
  }

  get spawnRate() {
    for (let i = 5; i >= 1; i--) {
      if (this.upgrades.has(`marketing_${i}`)) return UPGRADES[`marketing_${i}`].spawnPerInterval;
    }
    return BASE_SPAWN_RATE;
  }

  step() {
    this.tick++;
    if (this._restartTicks > 0) {
      this._restartTicks--;
      return;
    }
    const now = performance.now();
    this._assignRequests(now);
    const { waiting, active } = this._advancePhases(now);
    this._gvl.postStep(this.processes, this.threads, now);
    this._metrics.sample(waiting, active);
    this._processMetrics.sampleAll(this.processes, this.threads, this._fibersEnabled);
    if (this.memUsed > this.memMax) this._oomCrash();
  }

  get isRestarting() { return this._restartTicks > 0; }

  get throughputWindow()  { return this._metrics.throughputWindow; }
  get completionsPerMin() { return this._metrics.completionsPerMin; }
  get spawnsPerMin()      { return this.spawnRate * 60; }
  get overviewWindow()    { return this._metrics.overviewWindow; }
  get gvlWaitPct()       { return this._metrics.gvlWaitPct; }
  get totalActiveTicks() { return this._metrics.hasData; }
  get threadCost()       { return this.threads.length === 0 ? 0 : threadCostFor(this.threads.length + 1); }
  get nextProcessCost()  { return processCostFor(this.processes.length + 1); }
  get threadName()       { return this.threads.length === 0 ? '🚀 Start your server' : '➕ Add Thread'; }
  // All fibers with their stack allocated (created but not yet started or actively running).
  get activeFiberCount()  { return this.threads.reduce((sum, t) => sum + t.extraFibers.length, 0); }

  // Fibers that have actually started executing (phaseIdx > 0 or elapsed > 0).
  // Request working-set memory (AR records, response buffer) only accumulates once code runs.
  get startedFiberCount() {
    return this.threads.reduce((sum, t) =>
      sum + t.extraFibers.filter(f => f.phaseIdx > 0 || f.phaseElapsed > 0).length, 0);
  }

  get activeRequestMem()  {
    if (this._fibersEnabled) {
      return this.threads.flatMap(t => t.extraFibers)
        .filter(f => f.phaseIdx > 0 || f.phaseElapsed > 0)
        .reduce((sum, f) => sum + (f.request?.def?.memMB ?? 0), 0);
    }
    return this.threads
      .filter(t => t.request != null)
      .reduce((sum, t) => sum + (t.request?.def?.memMB ?? 0), 0);
  }
  get memUsed()           {
    const infra = MEM_BASE
      + Math.max(0, this.processes.length - 1) * PROCESS_MEM
      + this.threads.length * THREAD_MEM
      + this.activeFiberCount * FIBER_MEM;
    return infra + this.activeRequestMem;
  }
  get memPct()            { return this.memUsed / this.memMax; }
  get canAddThread()      { return this.memUsed + THREAD_MEM <= this.memMax; }
  get processMetrics()   { return this._processMetrics; }

  _assignRequests(now) {
    if (this._fibersEnabled) {
      this._assignFibers(now);
      return;
    }

    for (const t of this.threads) {
      if (t.status === 'idle' && this.queue.length > 0) {
        const req = this.queue[0];
        this.queue.shift();
        t.request      = req;
        t.phaseIdx     = 0;
        t.phaseElapsed = 0;
        t.phaseRunWall = null;
        t.status       = 'incoming';
        t.receivedAt   = now;
        this._events.emit(EVENTS.REQUEST_ASSIGNED, { thread: t, req });
      }
    }
  }

  _assignFibers(now) {
    if (this.threads.length === 0) return;
    while (this.queue.length > 0) {
      // Least-loaded thread gets the next request (simulates OS distributing connections)
      const t   = this.threads.reduce((min, th) =>
        th.extraFibers.length < min.extraFibers.length ? th : min
      );
      const req   = this.queue.shift();
      const fiber = {
        id:           ++this._nextFiberId,
        request:      req,
        phaseIdx:     0,
        phaseElapsed: 0,
        phaseRunWall: null,
        status:       'incoming',
        ioResumed:    false,
      };
      t.extraFibers.push(fiber);
      this._events.emit(EVENTS.REQUEST_ASSIGNED, { thread: t, req, isFiber: true });
    }
  }

  _advancePhases(now) {
    let waiting = 0, active = 0;

    for (const t of this.threads) {
      const proc = this.processes.find(p => p.id === t.processId);

      if (!t.request) {
        t.status = 'idle';
        t.phaseRunWall = null;
      } else if (t.pendingUntil && now < t.pendingUntil) {
        active++;
      } else {
        active++;
        const phase      = t.request.def.phases[t.phaseIdx];
        const canAdvance = this._gvl.stepThread(t, phase, proc);
        if (!canAdvance) {
          waiting++;
        } else {
          t.phaseElapsed += TICK_MS;
          t.phaseRunWall  = now;
          if (t.phaseElapsed >= phase.ms) {
            t.phaseIdx++;
            t.phaseElapsed = 0;
            t.phaseRunWall = null;
            if (t.phaseIdx >= t.request.def.phases.length) this._complete(t);
          }
        }
      }

      if (this._fibersEnabled && t.extraFibers.length > 0) {
        const fb = this._advanceFibersOnThread(t, proc, now);
        waiting += fb.waiting;
        active  += fb.active;
      }
    }

    return { waiting, active };
  }

  _advanceFibersOnThread(t, proc, now) {
    // Fibers within a Ractor still share its GVL — cooperative CPU scheduling applies
    // regardless of Ractor mode. True parallelism comes from multiple threads (Ractors)
    // running simultaneously, not from fibers within a single Ractor.
    this._updateFiberCpuHolder(t);

    let waiting = 0, active = 0;
    const toComplete = [];

    for (const fiber of t.extraFibers) {
      if (!fiber.request) continue;
      const started = fiber.phaseIdx > 0 || fiber.phaseElapsed > 0;
      const phase = fiber.request.def.phases[fiber.phaseIdx];

      let didAdvance;
      if (phase.type === 'io') {
        fiber.status = 'io';
        didAdvance   = true;
      } else if (t.cpuFiberId === fiber.id) {
        fiber.status = 'cpu';
        didAdvance   = true;
      } else {
        fiber.status = 'queued';
        didAdvance   = false;
      }

      if (started) {
        active++;
        if (!didAdvance) waiting++;
      }

      if (didAdvance) {
        fiber.phaseElapsed += TICK_MS;
        fiber.phaseRunWall  = now;
        if (fiber.phaseElapsed >= phase.ms) {
          const wasIO = phase.type === 'io';
          fiber.phaseIdx++;
          fiber.phaseElapsed = 0;
          fiber.phaseRunWall = null;
          const nextPhase = fiber.request.def.phases[fiber.phaseIdx];
          if (wasIO && nextPhase?.type === 'cpu') fiber.ioResumed = true;
          if (fiber.phaseIdx >= fiber.request.def.phases.length) toComplete.push(fiber);
        }
      }
    }

    for (const fiber of toComplete) this._completeFiber(t, fiber);
    t.extraFibers = t.extraFibers.filter(f => f.request !== null);
    this._updateFiberCpuHolder(t);
    return { waiting, active };
  }

  _oomCrash() {
    for (const t of this.threads) {
      t.request      = null;
      t.status       = 'idle';
      t.phaseIdx     = 0;
      t.phaseElapsed = 0;
      t.phaseRunWall = null;
      t.extraFibers  = [];
      t.cpuFiberId   = null;
    }
    for (const proc of this.processes) proc.gvlHolder = null;
    this._restartTicks = OOM_RESTART_TICKS;
    this._events.emit(EVENTS.OOM_CRASH);
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
    this._events.emit(EVENTS.THREADS_REDISTRIBUTED, n);
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

  // Remove the last thread (free, no refund).
  removeLastThread() {
    if (this.threads.length === 0) return false;
    const thread = this.threads[this.threads.length - 1];
    const proc = this.processes.find(p => p.id === thread.processId);
    if (proc && proc.gvlHolder === thread.id) proc.gvlHolder = null;
    thread.request = null; thread.status = 'idle';
    thread.extraFibers = []; thread.cpuFiberId = null;
    this.threads = this.threads.slice(0, -1);
    this._events.emit(EVENTS.THREAD_REMOVED, thread);
    return true;
  }

  // Remove the last process (free, no refund). Redistributes threads.
  removeLastProcess() {
    if (this.processes.length <= 1) return false;
    const proc = this.processes[this.processes.length - 1];
    this.processes = this.processes.slice(0, -1);
    this._redistributeThreads();
    this._events.emit(EVENTS.PROCESS_REMOVED, proc);
    return true;
  }

  // Remove a marketing upgrade (free, no refund).
  removeUpgrade(id) {
    if (!this.upgrades.has(id)) return false;
    this.upgrades.delete(id);
    return true;
  }

  get fibersEnabled()  { return this._fibersEnabled; }
  get ractorsEnabled() { return this._ractorsEnabled; }

  get memBreakdown() {
    const allFibers     = this._fibersEnabled ? this.activeFiberCount : 0;
    const startedFibers = this._fibersEnabled ? this.startedFiberCount : 0;
    return {
      base:          MEM_BASE - PROCESS_MEM,
      threadCount:   this.threads.length,
      threadsMb:     this.threads.length * THREAD_MEM,
      processCount:  this.processes.length,
      processesMb:   this.processes.length * PROCESS_MEM,
      requestsMb:    Math.round(this.activeRequestMem),
      fibersEnabled: this._fibersEnabled,
      fiberCount:    allFibers,
      fibersMb:      Math.round(allFibers * FIBER_MEM),
      fiberActiveCount: startedFibers,
      available:     Math.round(this.memMax - this.memUsed),
    };
  }

  // Determine which fiber holds the cooperative CPU slot for this thread.
  // IO-resumed fibers (just finished IO, now need CPU) get priority — mirroring
  // Falcon's fiber.transfer() which resumes IO-completed fibers inline before
  // new fibers that are still in the ready queue.
  _updateFiberCpuHolder(t) {
    const fibers = t.extraFibers;

    // Release slot if current holder no longer needs CPU
    if (t.cpuFiberId !== null) {
      const holder = fibers.find(f => f.id === t.cpuFiberId);
      if (!holder || !holder.request) {
        t.cpuFiberId = null;
      } else {
        const phase = holder.request.def.phases[holder.phaseIdx];
        if (!phase || phase.type !== 'cpu') t.cpuFiberId = null;
      }
    }

    if (t.cpuFiberId !== null) return;

    // Priority 1: fiber that just completed IO (mirrors fiber.transfer() inline resume)
    const ioResumed = fibers.find(f => f.request && f.ioResumed && f.request.def.phases[f.phaseIdx]?.type === 'cpu');
    if (ioResumed) {
      t.cpuFiberId = ioResumed.id;
      ioResumed.ioResumed = false;
      return;
    }

    // Priority 2: next fiber in ready queue (FIFO by insertion order)
    const next = fibers.find(f => f.request && f.request.def.phases[f.phaseIdx]?.type === 'cpu');
    if (next) t.cpuFiberId = next.id;
  }

  _enableRactors() {
    this._ractorsEnabled = true;
    this._gvl.ractorsEnabled = true;

    // Ractors replace multi-process CPU parallelism — collapse to 1 process
    const toRemove = this.processes.slice(1);
    this.processes = this.processes.slice(0, 1);
    if (toRemove.length > 0) this._redistributeThreads();

    for (const proc of this.processes) proc.gvlHolder = null;
    for (const t of this.threads) {
      t.cpuFiberId = null;
      t.ractorHost = true;
    }

    for (const proc of toRemove) {
      this._events.emit(EVENTS.PROCESS_REMOVED, proc);
    }

    // If fibers already enabled, Falcon had collapsed threads. Restore up to max ever bought.
    if (this._fibersEnabled && this._maxThreadsEver > 0) {
      while (this.threads.length < this._maxThreadsEver && this.memUsed + THREAD_MEM <= this.memMax) {
        this.addThread(true);
      }
    }
  }

  _enableFibers() {
    this._fibersEnabled = true;
    // In Ractor mode each thread is its own GVL domain — keep all of them,
    // each gets its own fiber scheduler. Without Ractors, Falcon model applies:
    // keep only 1 thread per process.
    const toRemove = [];
    if (!this._ractorsEnabled) {
      const seenProcesses = new Set();
      for (const t of this.threads) {
        if (seenProcesses.has(t.processId)) {
          toRemove.push(t);
        } else {
          seenProcesses.add(t.processId);
        }
      }
    }
    for (const t of this.threads) {
      t.request    = null;
      t.status     = 'idle';
      t.fiberHost  = true;
      if (this._ractorsEnabled) t.cpuFiberId = null;
    }
    for (const t of toRemove) {
      this.threads = this.threads.filter(th => th.id !== t.id);
      this._events.emit(EVENTS.THREAD_REMOVED, t);
    }
  }

  _recordCompletion(req, proc, entityId) {
    this.money += req.def.reward;
    this.completed++;
    this._metrics.recordCompletion();
    this.recentDone.unshift({ emoji: req.def.emoji, sub: req.def.sub, reward: req.def.reward, id: req.id });
    if (this.recentDone.length > 14) this.recentDone.pop();
    if (proc && proc.gvlHolder === entityId) proc.gvlHolder = null;
  }

  _completeFiber(t, fiber) {
    if (t.cpuFiberId === fiber.id) t.cpuFiberId = null;
    const req  = fiber.request;
    const proc = this.processes.find(p => p.id === t.processId);
    this._recordCompletion(req, proc, fiber.id);
    t.extraFibers = t.extraFibers.filter(f => f.id !== fiber.id);
    this._events.emit(EVENTS.REQUEST_COMPLETED, req);
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
    this._recordCompletion(req, proc, t.id);
    t.request = null; t.status = 'idle'; t.phaseIdx = 0; t.phaseElapsed = 0; t.phaseRunWall = null;
    this._events.emit(EVENTS.REQUEST_COMPLETED, req);
  }
}
