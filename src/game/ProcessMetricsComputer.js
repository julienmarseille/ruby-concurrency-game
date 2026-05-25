import { TRACE_SAMPLE_EVERY } from '../config.js';
import { RollingTimeSeries }  from '../utils/RollingTimeSeries.js';

export class ProcessMetricsComputer {
  constructor() {
    this._cpuSeries = new RollingTimeSeries();
    this._gvlSeries = new RollingTimeSeries();
    this._tick = 0;
    this._ema  = { cpu: 0, gvl: 0 };
  }

  sampleAll(processes, threads) {
    this._tick++;
    if (this._tick % TRACE_SAMPLE_EVERY !== 0) return;

    const alpha    = 0.3;
    const active   = threads.filter(t => t.request !== null);
    const cpuProcs = processes.filter(p => p.gvlHolder !== null).length;
    const rawCpu   = processes.length > 0 ? cpuProcs / processes.length * 100 : 0;
    const rawGvl   = active.length > 0
      ? active.filter(t => t.status === 'gvl_wait').length / active.length * 100
      : 0;

    this._ema.cpu = alpha * rawCpu + (1 - alpha) * this._ema.cpu;
    this._ema.gvl = alpha * rawGvl + (1 - alpha) * this._ema.gvl;

    this._cpuSeries.push(this._ema.cpu);
    this._gvlSeries.push(this._ema.gvl);
  }

  get recent()   { return { cpu: this._cpuSeries.recent, gvl: this._gvlSeries.recent }; }
  get overview() { return { cpu: this._cpuSeries.overview, gvl: this._gvlSeries.overview }; }
}
