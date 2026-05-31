import { CH } from '../config.js';

export class StatsHeader {
  constructor() {
    this._moneyEl       = document.getElementById('hdr-money');
    this._gvlEl         = document.getElementById('hdr-gvl');
    this._gvlStatEl     = this._gvlEl?.closest('.stat');
    this._gvlLabelEl    = this._gvlStatEl?.querySelector('.stat-label');
    this._rpsEl         = document.getElementById('hdr-rps');
    this._rpsStatEl     = this._rpsEl?.closest('.stat');
    this._incomingEl    = document.getElementById('hdr-incoming');
    this._incomingStatEl = this._incomingEl?.closest('.stat');
  }

  update(gs) {
    this._moneyEl.textContent = '$' + gs.money;
    this._moneyEl.style.color = CH.green;

    this._gvlStatEl.style.display = gs.hasUpgrade('monitoring') ? '' : 'none';
    if (gs.hasUpgrade('monitoring')) {
      const fibersEnabled = gs.hasUpgrade('fiber_scheduler');
      if (this._gvlLabelEl) this._gvlLabelEl.textContent = fibersEnabled ? 'CPU wait' : 'GVL wait';
      const pct = gs.gvlWaitPct;
      this._gvlEl.textContent = gs.totalActiveTicks ? pct + '% (1min avg)' : '—';
      this._gvlEl.style.color = pct > 60 ? CH.danger : pct > 30 ? CH.cpu : '#9371e6';
    }

    this._rpsStatEl.style.display = gs.hasUpgrade('throughput_graph') ? '' : 'none';
    if (gs.hasUpgrade('throughput_graph')) {
      const done = gs.completionsPerMin;
      this._rpsEl.textContent = done > 0 ? done : '—';
    }

    this._incomingStatEl.style.display = gs.hasUpgrade('request_tracing') ? '' : 'none';
    if (gs.hasUpgrade('request_tracing')) {
      this._incomingEl.textContent = gs.spawnsPerMin;
    }
  }
}
