import { TRACE_TICKS, TRACE_SAMPLE_EVERY, OVERVIEW_AGGREGATE, OVERVIEW_TICKS } from '../config.js';

export class ProcessMetricsComputer {
  constructor() {
    this._recent   = { cpu: [], gvl: [] };
    this._overview = { cpu: [], gvl: [] };
    this._tick     = 0;
    this._oa       = { cpu: 0, gvl: 0, count: 0 };
    this._ema      = { cpu: 0, gvl: 0 };
  }

  sampleAll(processes, threads) {
    this._tick++;
    if (this._tick % TRACE_SAMPLE_EVERY !== 0) return;

    const alpha  = 0.3;
    const active    = threads.filter(t => t.request !== null);
    const cpuProcs  = processes.filter(p => p.gvlHolder !== null).length;
    const rawCpu    = processes.length > 0 ? cpuProcs / processes.length * 100 : 0;
    const rawGvl    = active.length > 0
      ? active.filter(t => t.status === 'gvl_wait').length / active.length * 100
      : 0;

    this._ema.cpu = alpha * rawCpu + (1 - alpha) * this._ema.cpu;
    this._ema.gvl = alpha * rawGvl + (1 - alpha) * this._ema.gvl;
    const cpu = this._ema.cpu;
    const gvl = this._ema.gvl;

    const push = (arr, v) => { arr.push(v); if (arr.length > TRACE_TICKS) arr.shift(); };
    push(this._recent.cpu, cpu);
    push(this._recent.gvl, gvl);

    this._oa.cpu += cpu; this._oa.gvl += gvl; this._oa.count++;
    if (this._oa.count >= OVERVIEW_AGGREGATE) {
      const n = this._oa.count;
      const pushOv = (arr, sum) => { arr.push(sum / n); if (arr.length > OVERVIEW_TICKS) arr.shift(); };
      pushOv(this._overview.cpu, this._oa.cpu);
      pushOv(this._overview.gvl, this._oa.gvl);
      this._oa = { cpu: 0, gvl: 0, count: 0 };
    }
  }

  get recent()   { return this._recent; }
  get overview() { return this._overview; }
}
