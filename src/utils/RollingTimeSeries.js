import { TRACE_TICKS, OVERVIEW_AGGREGATE, OVERVIEW_TICKS } from '../config.js';

export class RollingTimeSeries {
  constructor() {
    this._recent = [];
    this._ov     = [];
    this._oa     = 0;
    this._oc     = 0;
  }

  push(value) {
    this._recent.push(value);
    if (this._recent.length > TRACE_TICKS) this._recent.shift();

    this._oa += value;
    this._oc++;
    if (this._oc >= OVERVIEW_AGGREGATE) {
      this._ov.push(this._oa / this._oc);
      if (this._ov.length > OVERVIEW_TICKS) this._ov.shift();
      this._oa = 0;
      this._oc = 0;
    }
  }

  get recent()   { return this._recent; }
  get overview() { return this._ov; }
  get hasData()  { return this._recent.length > 0; }
}
