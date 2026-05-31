import { CH } from '../config.js';

const PHASE_COLORS = { cpu: 'rgba(210, 153, 34, 0.22)', io: 'rgba(66, 153, 225, 0.22)' };

function phaseGradient(phases) {
  const total = phases.reduce((sum, p) => sum + p.ms, 0);
  let pct = 0;
  const stops = [];
  for (const phase of phases) {
    const start = (pct / total * 100).toFixed(2);
    pct += phase.ms;
    const end   = (pct / total * 100).toFixed(2);
    const color = PHASE_COLORS[phase.type] ?? 'rgba(255,255,255,0)';
    stops.push(`${color} ${start}%`, `${color} ${end}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')}), ${CH.bg}`;
}

export class QueuePanel {
  constructor() {
    this._list     = document.getElementById('queue-list');
    this._rendered = new Set();
    this._leaving  = new Set();
  }

  getElement(reqId) {
    return this._list.querySelector(`[data-req-id="${reqId}"]`);
  }

  removeItem(reqId) {
    const key = String(reqId);
    if (this._leaving.has(key)) return;
    const el = this.getElement(reqId);
    if (!el) return;

    this._leaving.add(key);

    const height = el.offsetHeight;
    const cs     = getComputedStyle(el);

    el.animate([
      { height: height + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginBottom: cs.marginBottom, opacity: 1 },
      { height: '0px',         paddingTop: '0px',         paddingBottom: '0px',         marginBottom: '0px',            opacity: 0 },
    ], { duration: 280, easing: 'ease-out', fill: 'forwards' })
      .onfinish = () => {
        el.remove();
        this._rendered.delete(key);
        this._leaving.delete(key);
      };
  }

  update(queue) {
    const visibleIds = new Set(queue.map(r => String(r.id)));

    for (const child of [...this._list.children]) {
      const id = child.dataset.reqId;
      if (!visibleIds.has(id) && !this._leaving.has(id)) {
        child.remove();
        this._rendered.delete(id);
      }
    }

    queue.forEach((r, i) => {
      const key = String(r.id);
      if (!this._rendered.has(key)) {
        const item = document.createElement('div');
        item.className = `req-item ${r.def.cls} new`;
        item.dataset.reqId = key;
        item.style.background = phaseGradient(r.def.phases);
        item.innerHTML = `<div class="req-dot"></div><span>${r.def.label}</span><span class="req-reward">+$${r.def.reward}</span>`;
        item.addEventListener('animationend', () => item.classList.remove('new'), { once: true });
        this._list.insertBefore(item, this._list.children[i] ?? null);
        this._rendered.add(key);
      }
    });
  }
}
