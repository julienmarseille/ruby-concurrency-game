import { TRACE_TICKS, TRACE_SAMPLE_EVERY } from '../config.js';

export class MetricsComputer {
  constructor() {
    this._gvlWindow             = [];
    this._rawThroughputBuf      = [];
    this._throughputWindow      = [];
    this._completionsThisSample = 0;
    this._sampleTick            = 0;
  }

  recordCompletion() {
    this._completionsThisSample++;
  }

  sample(waitingThreads, activeThreads) {
    this._sampleTick++;
    if (this._sampleTick % TRACE_SAMPLE_EVERY !== 0) return;

    this._gvlWindow.push({ waiting: waitingThreads, active: activeThreads });
    if (this._gvlWindow.length > TRACE_TICKS) this._gvlWindow.shift();

    this._rawThroughputBuf.push(this._completionsThisSample);
    this._completionsThisSample = 0;
    if (this._rawThroughputBuf.length > TRACE_TICKS) this._rawThroughputBuf.shift();

    const reqPerMin = this._rawThroughputBuf.reduce((a, b) => a + b, 0);
    this._throughputWindow.push(reqPerMin);
    if (this._throughputWindow.length > TRACE_TICKS) this._throughputWindow.shift();
  }

  get throughputWindow() { return this._throughputWindow; }

  get gvlWaitPct() {
    let totalWaiting = 0, totalActive = 0;
    for (const s of this._gvlWindow) { totalWaiting += s.waiting; totalActive += s.active; }
    return totalActive ? Math.round(totalWaiting / totalActive * 100) : 0;
  }

  get hasData() { return this._gvlWindow.length > 0; }
}
