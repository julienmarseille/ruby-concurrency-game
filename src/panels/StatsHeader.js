export class StatsHeader {
  constructor() {
    this._moneyEl    = document.getElementById('hdr-money');
    this._gvlEl      = document.getElementById('hdr-gvl');
    this._gvlStatEl  = this._gvlEl?.closest('.stat');
    this._rpsEl      = document.getElementById('hdr-rps');
    this._rpsStatEl  = this._rpsEl?.closest('.stat');
  }

  update(gs) {
    this._moneyEl.textContent  = '$' + gs.money;
    this._moneyEl.style.color  = '#3fb950';

    this._gvlStatEl.style.display = gs.hasUpgrade('monitoring') ? '' : 'none';
    if (gs.hasUpgrade('monitoring')) {
      const pct = gs.gvlWaitPct;
      this._gvlEl.textContent = gs.totalActiveTicks ? pct + '% (1min avg)' : '—';
      this._gvlEl.style.color = pct > 60 ? '#f85149' : pct > 30 ? '#d29922' : '#9371e6';
    }

    this._rpsStatEl.style.display = gs.hasUpgrade('throughput_graph') ? '' : 'none';
    if (gs.hasUpgrade('throughput_graph')) {
      const win     = gs.throughputWindow;
      const current = win.length > 0 ? win[win.length - 1] : 0;
      this._rpsEl.textContent = current > 0 ? Math.round(current) + ' /min' : '—';
    }
  }
}
