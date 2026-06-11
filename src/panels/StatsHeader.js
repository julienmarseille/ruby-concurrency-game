import { CH, GVL_ALERT, GVL_WARNING } from '../config.js';

export class StatsHeader {
  constructor() {
    this._moneyEl       = document.getElementById('hdr-money');
    this._moneyStatEl   = this._moneyEl?.closest('.stat');
    this._gvlEl         = document.getElementById('hdr-gvl');
    this._gvlStatEl     = this._gvlEl?.closest('.stat');
    this._gvlLabelEl    = this._gvlStatEl?.querySelector('.stat-label');
    this._rpsEl         = document.getElementById('hdr-rps');
    this._rpsStatEl     = this._rpsEl?.closest('.stat');
    this._incomingEl    = document.getElementById('hdr-incoming');
    this._incomingStatEl = this._incomingEl?.closest('.stat');
  }

  spawnMoneyPop(amount) {
    if (!this._moneyStatEl) return;
    const w   = this._moneyStatEl.offsetWidth;
    const pop = document.createElement('span');
    pop.className   = 'money-pop';
    pop.textContent = '+$' + amount;
    pop.style.left  = Math.floor(Math.random() * Math.max(1, w - 40)) + 'px';
    this._moneyStatEl.appendChild(pop);
    pop.addEventListener('animationend', () => pop.remove());
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
      this._gvlEl.style.color = pct > GVL_ALERT ? CH.danger : pct > GVL_WARNING ? CH.cpu : CH.gvlNormal;
    }

    if (this._rpsStatEl) this._rpsStatEl.style.display = gs.hasUpgrade('throughput_graph') ? '' : 'none';
    if (gs.hasUpgrade('throughput_graph')) {
      const done = gs.completionsPerMin;
      this._rpsEl.textContent = done > 0 ? done : '—';
    }

    if (this._incomingStatEl) this._incomingStatEl.style.display = gs.hasUpgrade('request_tracing') ? '' : 'none';
    if (gs.hasUpgrade('request_tracing')) {
      this._incomingEl.textContent = gs.spawnsPerMin;
    }
  }
}
