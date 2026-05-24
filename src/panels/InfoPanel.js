const NODE_W      = 34;
const MAX_THREADS = 12;
const STEP        = 48;
const COL_OBS     = 0;
const COL_THRUPUT = 58;
const COL_CENTER  = 130;
const COL_THREAD  = 220;
const PROC_X      = 294;

const TREE_NODES = [
  { id: 'process_1',        x: COL_CENTER, y: 8,               tooltipAlign: 'center' },
  { id: 'thread_1',         x: COL_CENTER, y: 8 + STEP,        tooltipAlign: 'center' },
  { id: 'request_tracing',  x: COL_OBS,    y: 8 + STEP * 2,   tooltipAlign: 'left'   },
  { id: 'mixed_requests',   x: COL_CENTER, y: 8 + STEP * 2,    tooltipAlign: 'center' },
  ...Array.from({ length: MAX_THREADS - 1 }, (_, i) => ({
    id:           `thread_${i + 2}`,
    x:            COL_THREAD,
    y:            8 + (i + 2) * STEP,
    tooltipAlign: 'left',
  })),
  { id: 'monitoring',       x: COL_OBS,    y: 8 + STEP * 3,   tooltipAlign: 'left'   },
  { id: 'throughput_graph', x: COL_THRUPUT,y: 8 + STEP * 3,   tooltipAlign: 'left'   },
  { id: 'report_requests',  x: COL_CENTER, y: 8 + STEP * 3,    tooltipAlign: 'center' },
  { id: 'process_2',        x: PROC_X,     y: 8 + STEP * 2,    tooltipAlign: 'right'  },
  { id: 'process_3',        x: PROC_X,     y: 8 + STEP * 3,    tooltipAlign: 'right'  },
];

const TREE_EDGES = [
  ['process_1',       'thread_1'],
  ['thread_1',        'request_tracing'],
  ['thread_1',        'mixed_requests'],
  ['thread_1',        'thread_2'],
  ['request_tracing', 'monitoring'],
  ['request_tracing', 'throughput_graph'],
  ['mixed_requests',  'report_requests'],
  ['thread_1',        'process_2'],
  ['process_2',       'process_3'],
  ...Array.from({ length: MAX_THREADS - 2 }, (_, i) => [`thread_${i + 2}`, `thread_${i + 3}`]),
];

function edgePath(from, to) {
  if (from.y === to.y) {
    const hy = from.y + NODE_W / 2;
    return `M ${from.x + NODE_W} ${hy} L ${to.x} ${hy}`;
  }
  const x1 = from.x + NODE_W / 2, y1 = from.y + NODE_W;
  const x2 = to.x   + NODE_W / 2, y2 = to.y;
  if (Math.abs(x1 - x2) < 2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`;
}

const TREE_W = PROC_X + NODE_W + 4;
const TREE_H = 8 + (MAX_THREADS + 1) * STEP + NODE_W + 4;

export class InfoPanel {
  constructor(onBuyThread, onBuyUpgrade, onBuyProcess) {
    this._onBuyThread   = onBuyThread;
    this._onBuyUpgrade  = onBuyUpgrade;
    this._onBuyProcess  = onBuyProcess;
    this._completedEl   = document.getElementById('completed-list');
    this._shopEl        = document.getElementById('shop');
    this._explanationEl = document.getElementById('explanation-box');
    this._completedSeen = new Set();
    this._shopKey       = null;

    this._shopEl.addEventListener('click', e => {
      const node = e.target.closest('[data-action]');
      if (!node) return;
      if (node.dataset.action === 'upgrade') this._onBuyUpgrade(node.dataset.id);
      if (node.dataset.action === 'thread')  this._onBuyThread();
      if (node.dataset.action === 'process') this._onBuyProcess(node.dataset.id);
    });
  }

  setExplanation(title, body) {
    this._explanationEl.innerHTML = `<h3>${title}</h3>${body}`;
  }

  renderShop(items) {
    const key = items.map(u => `${u.id}:${u.owned}:${u.affordable}:${u.unlocked}`).join(',');
    if (key === this._shopKey) return;
    this._shopKey = key;

    const byId = Object.fromEntries(items.map(u => [u.id, u]));

    const svgEdges = TREE_EDGES.map(([fromId, toId]) => {
      const fromPos  = TREE_NODES.find(n => n.id === fromId);
      const toPos    = TREE_NODES.find(n => n.id === toId);
      if (!fromPos || !toPos) return '';
      const fromItem = byId[fromId];
      const toItem   = byId[toId];
      const done   = fromItem?.owned && toItem?.owned;
      const active = fromItem?.owned && toItem && !toItem.owned;
      const cls    = done ? 'tree-edge tree-edge--done' : active ? 'tree-edge tree-edge--active' : 'tree-edge';
      return `<path class="${cls}" d="${edgePath(fromPos, toPos)}" fill="none"/>`;
    }).join('');

    const svg = `<svg class="tree-svg" width="${TREE_W}" height="${TREE_H}">${svgEdges}</svg>`;

    const nodes = TREE_NODES.map(nodePos => {
      const item = byId[nodePos.id];
      if (!item) return '';

      let stateCls = '';
      let icon     = item.icon ?? '🧵';
      let badge    = '';

      if (item.owned) {
        stateCls = 'tree-node--owned';
        badge    = '<span class="tree-node-badge">✓</span>';
      } else if (!item.unlocked) {
        stateCls = 'tree-node--locked';
        icon     = '🔒';
      } else if (item.affordable) {
        stateCls = 'tree-node--affordable';
      }

      const action  = item.isThread ? 'thread' : item.isProcess ? 'process' : 'upgrade';
      const cost    = item.isFree || item.cost === 0 ? 'Free' : `$${item.cost}`;
      const tooltip = `
        <div class="tree-tooltip tree-tooltip--${nodePos.tooltipAlign}">
          <div class="tree-tooltip-name">${item.name}</div>
          <div class="tree-tooltip-cost ${item.affordable || item.owned ? 'cost-ok' : 'cost-no'}">${item.owned ? '✓ owned' : cost}</div>
          <div class="tree-tooltip-desc">${item.desc ?? ''}</div>
        </div>`;

      return `
        <div class="tree-node ${stateCls}"
             style="left:${nodePos.x}px;top:${nodePos.y}px"
             data-action="${item.owned || !item.unlocked ? '' : action}"
             data-id="${item.id}">
          <span class="tree-node-icon">${icon}</span>
          ${badge}
          ${tooltip}
        </div>`;
    }).join('');

    this._shopEl.innerHTML = `<div class="tree-wrap" style="height:${TREE_H}px;width:${TREE_W}px">${svg}${nodes}</div>`;
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
