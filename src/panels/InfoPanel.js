import { MAX_THREADS } from '../config.js';

const NODE_W      = 38;
const STEP        = 52;

const COL_OBS     = 0;
const COL_TRACE   = 50;
const COL_TRAFFIC = 100;
const COL_CENTER  = 156;
const COL_MR      = 212;
const COL_PROC    = 262;
const COL_MKT     = 312;

// Spine at rows 4-5-6 (vertical center).
// VPS chain goes UP from nano along D column (rows 0-2).
// Process chain goes UP-RIGHT from process_1 along F column (rows 5, 3, 1).
// Obs items branch LEFT from T1/request_tracing (rows 4-6).
// Threads serpentine 3-wide (E/F/G) below T1 (rows 7+).
// Marketing chain runs DOWN in A column (rows 7-12).
// Mixed/PDF in C column (rows 8, 10). Fibers at D,9.

const TREE_NODES = [
  // ── VPS chain: upward from Nano along center spine
  { id: 'large_vps',        x: COL_CENTER, y: 8 + STEP * 0,  tooltipAlign: 'center', short: 'Large',   cat: 'infra'     },
  { id: 'medium_vps',       x: COL_CENTER, y: 8 + STEP * 1,  tooltipAlign: 'center', short: 'Medium',  cat: 'infra'     },
  { id: 'small_vps',        x: COL_CENTER, y: 8 + STEP * 2,  tooltipAlign: 'center', short: 'Small',   cat: 'infra'     },

  // ── Process chain: F column, upward from process_1 (rows 5, 3, 1)
  { id: 'process_4',        x: COL_PROC,   y: 8 + STEP * 1,  tooltipAlign: 'right',  short: 'P4',      cat: 'scaling'   },
  { id: 'process_3',        x: COL_PROC,   y: 8 + STEP * 3,  tooltipAlign: 'right',  short: 'P3',      cat: 'scaling'   },

  // ── Row 4: obs left, mem profiler (C), nano center
  { id: 'process_monitor',  x: COL_OBS,    y: 8 + STEP * 4,  tooltipAlign: 'left',   short: 'Srv Mon', cat: 'obs'       },
  { id: 'memory_profiler',  x: COL_TRAFFIC,y: 8 + STEP * 4,  tooltipAlign: 'left',   short: 'Mem+',    cat: 'obs'       },
  { id: 'nano_vps',         x: COL_CENTER, y: 8 + STEP * 4,  tooltipAlign: 'center', short: 'Nano',    cat: 'infra'     },

  // ── Row 5: obs left, memory meter (C), process_1 center, process_2 right
  { id: 'monitoring',       x: COL_OBS,    y: 8 + STEP * 5,  tooltipAlign: 'left',   short: 'Monitor', cat: 'obs'       },
  { id: 'throughput_graph', x: COL_TRACE,  y: 8 + STEP * 5,  tooltipAlign: 'left',   short: 'Chart',   cat: 'obs'       },
  { id: 'memory_meter',     x: COL_TRAFFIC,y: 8 + STEP * 5,  tooltipAlign: 'left',   short: 'RAM',     cat: 'obs'       },
  { id: 'process_1',        x: COL_CENTER, y: 8 + STEP * 5,  tooltipAlign: 'center', short: 'Start',   cat: 'core'      },
  { id: 'process_2',        x: COL_PROC,   y: 8 + STEP * 5,  tooltipAlign: 'right',  short: 'P2',      cat: 'scaling'   },

  // ── Row 6: tracing left, T1 center (the "sun")
  { id: 'request_tracing',  x: COL_TRACE,  y: 8 + STEP * 6,  tooltipAlign: 'left',   short: 'Tracing', cat: 'obs'       },
  { id: 'thread_1',         x: COL_CENTER, y: 8 + STEP * 6,  tooltipAlign: 'center', short: 'T1',      cat: 'scaling'   },

  // ── Row 7: marketing I (A), thread serpentine row 1
  { id: 'marketing_1',      x: COL_OBS,    y: 8 + STEP * 7,  tooltipAlign: 'left',   short: 'I',       cat: 'marketing' },

  // ── Row 8: marketing II (A), Mixed (C)
  { id: 'marketing_2',      x: COL_OBS,    y: 8 + STEP * 8,  tooltipAlign: 'left',   short: 'II',      cat: 'marketing' },
  { id: 'mixed_requests',   x: COL_TRAFFIC,y: 8 + STEP * 8,  tooltipAlign: 'left',   short: 'Mixed',   cat: 'traffic'   },

  // ── Row 9: marketing III (A)
  { id: 'marketing_3',      x: COL_OBS,    y: 8 + STEP * 9,  tooltipAlign: 'left',   short: 'III',     cat: 'marketing' },

  // ── Row 10: marketing IV (A), PDF (C)
  { id: 'marketing_4',      x: COL_OBS,    y: 8 + STEP * 10, tooltipAlign: 'left',   short: 'IV',      cat: 'marketing' },
  { id: 'report_requests',  x: COL_TRAFFIC,y: 8 + STEP * 10, tooltipAlign: 'left',   short: 'PDF',     cat: 'traffic'   },

  // ── Row 11: Fibers (D), Ractors (E) — same level, independent paths from thread_1
  { id: 'fiber_scheduler',  x: COL_TRAFFIC,y: 8 + STEP * 12, tooltipAlign: 'left',   short: 'Fibers',  cat: 'runtime'   },
  { id: 'ractors',          x: COL_MR,     y: 8 + STEP * 12, tooltipAlign: 'right',  short: 'Ractors', cat: 'runtime'   },

  // ── Row 12: marketing V (A)
  { id: 'marketing_5',      x: COL_OBS,    y: 8 + STEP * 12, tooltipAlign: 'left',   short: 'V',       cat: 'marketing' },

  // ── Thread serpentine: 3-wide (E/F/G), row pairs starting at row 7
  // Pattern per 6 threads: E,F,G (row N) then G,F,E (row N+1), then repeat
  ...Array.from({ length: MAX_THREADS - 1 }, (_, i) => {
    const group     = Math.floor(i / 6);
    const pos       = i % 6;
    const cols      = [COL_MR, COL_PROC, COL_MKT, COL_MKT, COL_PROC, COL_MR];
    const rowOffset = pos < 3 ? 0 : 1;
    return {
      id:           `thread_${i + 2}`,
      x:            cols[pos],
      y:            8 + (7 + group * 2 + rowOffset) * STEP,
      tooltipAlign: 'right',
      short:        `T${i + 2}`,
      cat:          'scaling',
    };
  }),
];

const TREE_EDGES = [
  // VPS chain (upward from nano)
  ['nano_vps',        'small_vps'],
  ['small_vps',       'medium_vps'],
  ['medium_vps',      'large_vps'],
  // Spine
  ['nano_vps',        'process_1'],
  ['process_1',       'thread_1'],
  // Process chain (right of spine, upward)
  ['process_1',       'process_2'],
  ['process_2',       'process_3'],
  ['process_3',       'process_4'],
  // Obs cluster (left of spine, upward)
  ['thread_1',        'request_tracing'],
  ['request_tracing', 'throughput_graph'],
  ['request_tracing', 'monitoring'],
  ['monitoring',      'process_monitor'],
  // Memory cluster (C column, from T1 upward)
  ['thread_1',     'memory_meter'],
  ['memory_meter', 'memory_profiler'],
  // Traffic (below T1)
  ['thread_1',        'mixed_requests'],
  ['mixed_requests',  'report_requests'],
  // Fibers + Ractors (below T1, shared trunk — split at destination row)
  ['thread_1',        'fiber_scheduler', 'bottom'],
  ['thread_1',        'ractors',         'bottom'],
  // Thread serpentine
  ['thread_1',        'thread_2'],
  ...Array.from({ length: MAX_THREADS - 2 }, (_, i) => [`thread_${i + 2}`, `thread_${i + 3}`]),
  // Marketing chain (A column, downward)
  ['thread_1',        'marketing_1'],
  ['marketing_1',     'marketing_2'],
  ['marketing_2',     'marketing_3'],
  ['marketing_3',     'marketing_4'],
  ['marketing_4',     'marketing_5'],
];

function edgePath(from, to, splitMode = 'mid') {
  // Same row
  if (from.y === to.y) {
    const hy = from.y + NODE_W / 2;
    if (from.x > to.x) {
      // Leftward: exit left edge of from, enter right edge of to
      return `M ${from.x} ${hy} H ${to.x + NODE_W}`;
    }
    // Rightward: exit right edge of from, enter left edge of to
    return `M ${from.x + NODE_W} ${hy} H ${to.x}`;
  }

  const goingUp = to.y < from.y;

  if (goingUp && to.x < from.x) {
    // Going up-left: exit from left-mid of from-node to avoid routing through spine
    const sx = from.x;
    const sy = from.y + NODE_W / 2;
    const ex = to.x + NODE_W / 2;
    const ey = to.y + NODE_W;
    return `M ${sx} ${sy} H ${ex} V ${ey}`;
  }

  const x1 = from.x + NODE_W / 2;
  const y1 = goingUp ? from.y           : from.y + NODE_W;
  const x2 = to.x   + NODE_W / 2;
  const y2 = goingUp ? to.y + NODE_W   : to.y;
  if (Math.abs(x1 - x2) < 2) return `M ${x1} ${y1} V ${y2}`;
  if (splitMode === 'bottom') {
    const midDestY = to.y + NODE_W / 2;
    // Enter from the side at the vertical center of the destination node
    const edgeX = x2 < x1 ? to.x + NODE_W : to.x;
    return `M ${x1} ${y1} V ${midDestY} H ${edgeX}`;
  }
  const midY = Math.round((y1 + y2) / 2);
  return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`;
}

const TREE_W = COL_MKT + NODE_W + 4;
const lastThreadRow = MAX_THREADS > 1
  ? 7 + Math.floor((MAX_THREADS - 2) / 6) * 2 + ((MAX_THREADS - 2) % 6 >= 3 ? 1 : 0)
  : 7;
const marketingLastRow = 12;
const TREE_H = 8 + Math.max(lastThreadRow, marketingLastRow) * STEP + NODE_W + 16;

export class InfoPanel {
  constructor(onBuyThread, onBuyUpgrade, onBuyProcess, onRemove) {
    this._onBuyThread  = onBuyThread;
    this._onBuyUpgrade = onBuyUpgrade;
    this._onBuyProcess = onBuyProcess;
    this._onRemove     = onRemove;
    this._shopEl       = document.getElementById('shop');
    this._shopKey      = null;

    this._shopEl.addEventListener('click', e => {
      const node = e.target.closest('[data-action]');
      if (!node) return;
      if (node.dataset.action === 'upgrade') this._onBuyUpgrade(node.dataset.id);
      if (node.dataset.action === 'thread')  this._onBuyThread();
      if (node.dataset.action === 'process') this._onBuyProcess(node.dataset.id);
      if (node.dataset.action === 'remove')  this._onRemove(node.dataset.id);
    });
  }

  renderShop(items) {
    const key = items.map(u => `${u.id}:${u.owned}:${u.removable}:${u.affordable}:${u.unlocked}`).join(',');
    if (key === this._shopKey) return;
    this._shopKey = key;

    const byId = Object.fromEntries(items.map(u => [u.id, u]));

    // A node is visible if it is owned, directly adjacent to an owned node, or a root (no parent edge)
    const ownedIds = new Set(items.filter(u => u.owned).map(u => u.id));
    const visibleIds = new Set(ownedIds);
    for (const [fromId, toId] of TREE_EDGES) {
      if (ownedIds.has(fromId)) visibleIds.add(toId);
      if (ownedIds.has(toId))   visibleIds.add(fromId);
    }
    const allChildIds = new Set(TREE_EDGES.map(([, toId]) => toId));
    for (const node of TREE_NODES) {
      if (!allChildIds.has(node.id)) visibleIds.add(node.id);
    }

    const svgEdges = TREE_EDGES.map(([fromId, toId, splitMode]) => {
      if (!visibleIds.has(fromId) || !visibleIds.has(toId)) return '';
      const fromPos  = TREE_NODES.find(n => n.id === fromId);
      const toPos    = TREE_NODES.find(n => n.id === toId);
      if (!fromPos || !toPos) return '';
      const fromItem = byId[fromId];
      const toItem   = byId[toId];
      const done   = fromItem?.owned && toItem?.owned;
      const active = fromItem?.owned && toItem && !toItem.owned;
      const cls    = done ? 'tree-edge tree-edge--done' : active ? 'tree-edge tree-edge--active' : 'tree-edge';
      return `<path class="${cls}" d="${edgePath(fromPos, toPos, splitMode)}" fill="none"/>`;
    }).join('');

    const svg = `<svg class="tree-svg" width="${TREE_W}" height="${TREE_H}">${svgEdges}</svg>`;

    const nodes = TREE_NODES.map(nodePos => {
      const item = byId[nodePos.id];
      if (!item) return '';
      if (!visibleIds.has(nodePos.id)) return '';

      let stateCls = '';
      let icon     = item.icon ?? '🧵';
      let badge    = '';
      let action   = '';

      if (item.owned && item.removable) {
        stateCls = 'tree-node--removable';
        badge    = '<span class="tree-node-badge tree-node-badge--remove">×</span>';
        action   = 'remove';
      } else if (item.owned) {
        stateCls = 'tree-node--owned';
        badge    = '<span class="tree-node-badge">✓</span>';
      } else if (!item.unlocked) {
        stateCls = 'tree-node--locked';
        icon     = '🔒';
      } else {
        if (item.affordable) stateCls = 'tree-node--affordable';
        action = item.isThread ? 'thread' : item.isProcess ? 'process' : 'upgrade';
      }

      const cost    = item.isFree || item.cost === 0 ? 'Free' : `$${item.cost}`;
      const tooltip = `
        <div class="tree-tooltip tree-tooltip--${nodePos.tooltipAlign}">
          <div class="tree-tooltip-name">${item.name}</div>
          <div class="tree-tooltip-cost ${item.affordable || item.owned ? 'cost-ok' : 'cost-no'}">${item.owned && item.removable ? '× click to remove' : item.owned ? '✓ owned' : cost}</div>
          <div class="tree-tooltip-desc">${item.desc ?? ''}</div>
        </div>`;

      return `
        <div class="tree-node ${stateCls}"
             style="left:${nodePos.x}px;top:${nodePos.y}px"
             data-action="${action}"
             data-id="${item.id}"
             data-cat="${nodePos.cat ?? 'core'}">
          <span class="tree-node-icon">${icon}</span>
          <span class="tree-node-name">${nodePos.short ?? ''}</span>
          ${badge}
          ${tooltip}
        </div>`;
    }).join('');

    this._shopEl.innerHTML = `<div class="tree-wrap" style="height:${TREE_H}px;width:${TREE_W}px">${svg}${nodes}</div>`;
  }

  static flash(msg) {
    const el = document.createElement('div');
    el.className = 'alert-flash';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
}
