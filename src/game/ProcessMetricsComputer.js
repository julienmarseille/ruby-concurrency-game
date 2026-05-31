import { TRACE_SAMPLE_EVERY } from '../config.js';
import { RollingTimeSeries }  from '../utils/RollingTimeSeries.js';

const ALPHA = 0.6;

export class ProcessMetricsComputer {
  constructor() {
    this._cpuSeries = new RollingTimeSeries();
    this._gvlSeries = new RollingTimeSeries();
    this._tick = 0;
    this._ema  = { cpu: 0, gvl: 0 };
  }

  sampleAll(processes, threads, fibersEnabled = false) {
    this._tick++;
    if (this._tick % TRACE_SAMPLE_EVERY !== 0) return;

    let rawCpu, rawGvl;

    if (fibersEnabled) {
      const startedFibers = threads.flatMap(t => (t.extraFibers ?? []).filter(f => f.phaseIdx > 0 || f.phaseElapsed > 0));
      rawCpu = threads.length > 0
        ? threads.filter(t => t.cpuFiberId !== null).length / threads.length * 100
        : 0;
      rawGvl = startedFibers.length > 0
        ? startedFibers.filter(f => f.status === 'queued').length / startedFibers.length * 100
        : 0;
    } else {
      const active   = threads.filter(t => t.request !== null);
      const cpuProcs = processes.filter(p => p.gvlHolder !== null).length;
      rawCpu = processes.length > 0 ? cpuProcs / processes.length * 100 : 0;
      rawGvl = active.length > 0
        ? active.filter(t => t.status === 'gvl_wait').length / active.length * 100
        : 0;
    }

    this._ema.cpu = ALPHA * rawCpu + (1 - ALPHA) * this._ema.cpu;
    this._ema.gvl = ALPHA * rawGvl + (1 - ALPHA) * this._ema.gvl;
    this._cpuSeries.push(this._ema.cpu);
    this._gvlSeries.push(this._ema.gvl);
  }

  get recent()   { return { cpu: this._cpuSeries.recent, gvl: this._gvlSeries.recent }; }
  get overview() { return { cpu: this._cpuSeries.overview, gvl: this._gvlSeries.overview }; }
}
