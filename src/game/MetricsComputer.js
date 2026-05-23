import { TRACE_TICKS, TRACE_SAMPLE_EVERY, OVERVIEW_AGGREGATE, OVERVIEW_TICKS } from '../config.js';

const OVERVIEW_ROLLING_W = 30; // 30 overview entries × 2s = 60s rolling window (matches recent graph)

export class MetricsComputer {
  constructor() {
    this._gvlWindow             = [];
    this._rawThroughputBuf      = [];
    this._throughputWindow      = [];
    this._completionsThisSample = 0;
    this._sampleTick            = 0;
    this._overviewAccum         = 0;
    this._overviewCount         = 0;
    this._overviewRawBuf        = [];
    this._overviewWindow        = [];
  }

  recordCompletion() {
    this._completionsThisSample++;
  }

  sample(waitingThreads, activeThreads) {
    this._sampleTick++;
    if (this._sampleTick % TRACE_SAMPLE_EVERY !== 0) return;

    this._gvlWindow.push({ waiting: waitingThreads, active: activeThreads });
    if (this._gvlWindow.length > TRACE_TICKS) this._gvlWindow.shift();

    this._overviewAccum += this._completionsThisSample;
    this._rawThroughputBuf.push(this._completionsThisSample);
    this._completionsThisSample = 0;
    if (this._rawThroughputBuf.length > TRACE_TICKS) this._rawThroughputBuf.shift();

    const reqPerMin = this._rawThroughputBuf.reduce((a, b) => a + b, 0);
    this._throughputWindow.push(reqPerMin);
    if (this._throughputWindow.length > TRACE_TICKS) this._throughputWindow.shift();

    this._overviewCount++;
    if (this._overviewCount >= OVERVIEW_AGGREGATE) {
      this._overviewRawBuf.push(this._overviewAccum);
      if (this._overviewRawBuf.length > OVERVIEW_ROLLING_W) this._overviewRawBuf.shift();

      const overviewReqPerMin = this._overviewRawBuf.reduce((a, b) => a + b, 0);
      this._overviewWindow.push(overviewReqPerMin);
      if (this._overviewWindow.length > OVERVIEW_TICKS) this._overviewWindow.shift();

      this._overviewAccum = 0;
      this._overviewCount = 0;
    }
  }

  get throughputWindow()  { return this._throughputWindow; }
  get overviewWindow()    { return this._overviewWindow; }

  get gvlWaitPct() {
    let totalWaiting = 0, totalActive = 0;
    for (const s of this._gvlWindow) { totalWaiting += s.waiting; totalActive += s.active; }
    return totalActive ? Math.round(totalWaiting / totalActive * 100) : 0;
  }

  get hasData() { return this._gvlWindow.length > 0; }
}
