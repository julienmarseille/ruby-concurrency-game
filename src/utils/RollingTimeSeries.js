import { TRACE_TICKS, OVERVIEW_AGGREGATE, OVERVIEW_TICKS } from '../config.js';

export class RollingTimeSeries {
  constructor() {
    this._recent        = [];
    this._overviewBuf   = [];
    this._overviewAccum = 0;
    this._overviewCount = 0;
  }

  push(value) {
    this._recent.push(value);
    if (this._recent.length > TRACE_TICKS) this._recent.shift();

    this._overviewAccum += value;
    this._overviewCount++;
    if (this._overviewCount >= OVERVIEW_AGGREGATE) {
      this._overviewBuf.push(this._overviewAccum / this._overviewCount);
      if (this._overviewBuf.length > OVERVIEW_TICKS) this._overviewBuf.shift();
      this._overviewAccum = 0;
      this._overviewCount = 0;
    }
  }

  get recent()   { return this._recent; }
  get overview() { return this._overviewBuf; }
  get hasData()  { return this._recent.length > 0; }
}
