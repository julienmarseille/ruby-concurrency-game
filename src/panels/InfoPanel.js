import { THREAD_MEM } from '../config.js';

export class InfoPanel {
  constructor(onBuyThread, onBuyUpgrade) {
    this._onBuyThread   = onBuyThread;
    this._onBuyUpgrade  = onBuyUpgrade;
    this._completedEl   = document.getElementById('completed-list');
    this._shopEl        = document.getElementById('shop');
    this._explanationEl = document.getElementById('explanation-box');
    this._completedSeen = new Set();
    this._shopKey       = null;

    this._shopEl.addEventListener('click', e => {
      const upgradeEl = e.target.closest('.upgrade-item');
      if (upgradeEl) { this._onBuyUpgrade(upgradeEl.dataset.upgradeId); return; }
      if (e.target.closest('#btn-buy-thread')) this._onBuyThread();
    });
  }

  setExplanation(title, body) {
    this._explanationEl.innerHTML = `<h3>${title}</h3>${body}`;
  }

  renderShop(canAdd, money, availableUpgrades = [], threadCost = 0, threadName = '🚀 Start your server') {
    const canAffordThread = money >= threadCost;
    const upgradeKey      = availableUpgrades.map(u => `${u.id}:${money >= u.cost}`).join(',');
    const key = `${canAdd}|${canAffordThread}|${threadName}|${upgradeKey}`;
    if (key === this._shopKey) return;
    this._shopKey = key;

    const upgradesHtml = availableUpgrades.map(u => {
      const canAfford = money >= u.cost;
      const costClass = canAfford ? 'cost-ok' : 'cost-no';
      return `
        <div class="shop-item upgrade-item" data-upgrade-id="${u.id}">
          <div class="shop-item-name">${u.name}</div>
          <div class="shop-item-desc">${u.desc}</div>
          <div class="shop-item-cost ${costClass}">💰 $${u.cost}</div>
        </div>`;
    }).join('');

    const locked    = !canAdd;
    const costStr   = threadCost === 0 ? '🎁 Free' : `💰 $${threadCost}`;
    const costClass = (threadCost === 0 || canAffordThread) ? 'cost-ok' : 'cost-no';

    this._shopEl.innerHTML = `
      ${upgradesHtml}
      <div class="shop-item ${locked ? 'locked' : ''}" id="btn-buy-thread">
        <div class="shop-item-name">${threadName}</div>
        <div class="shop-item-desc">One OS thread. Shares the GVL with all others. Uses ${THREAD_MEM}MB RAM.</div>
        <div class="shop-item-cost ${costClass}">${costStr}</div>
      </div>
      <div style="font-size:10px;color:#484f58;padding:6px 2px;line-height:1.5">Fibers &amp; Ractors → Phase 3 &amp; 4…</div>
    `;
  }

  addCompleted(recentDone) {
    for (const r of recentDone) {
      if (this._completedSeen.has(r.id)) continue;
      this._completedSeen.add(r.id);
      const item = document.createElement('div');
      item.className = 'completed-item new';
      item.innerHTML = `<span>${r.emoji}</span><span style="color:#8b949e">#${r.id} ${r.sub}</span><span class="completed-money">+$${r.reward}</span>`;
      item.addEventListener('animationend', () => item.classList.remove('new'), { once: true });
      this._completedEl.insertBefore(item, this._completedEl.firstChild);
      while (this._completedEl.children.length > 14) this._completedEl.removeChild(this._completedEl.lastChild);
    }
  }

  static flash(msg) {
    const el = document.createElement('div');
    el.className = 'alert-flash';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
}
