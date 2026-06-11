import { MAX_THREADS } from '../config.js';

const NODE_W      = 38;
const STEP        = 52;   // equal horizontal (52-38=14px) and vertical (52-38=14px) gap

// 7 columns at 52px spacing → 14px gap between adjacent nodes in both axes.
const COL_OBS     = 0;
const COL_TRAFFIC = 52;
const COL_CENTER  = 104;
const COL_PA      = 156;
const COL_PB      = 208;
const COL_TC      = 260;
const COL_TD      = 312;

// Layout overview (rows 0-4 = upper section, rows 5+ = threads/obs-leaves/marketing/runtime):
//
//  Row 0:  [large_vps  CTR ]
//  Row 1:  [med_vps    CTR ]
//  Row 2:  [proc_mon OBS] [mem+ TRF] [sm_vps CTR] [P8 PA] [P7 PB] [P6 TC] [P5 TD]
//  Row 3:  [Monitor OBS] [RAM TRF] [nano_vps CTR] [Start PA] [P2 PB] [P3 TC] [P4 TD]
//  Row 4:  [thread_1  CTR]   ← hub alone
//  Row 5:  [Tracing OBS]  [Chart TRF]  + T2-T5 (PA/PB/TC/TD)
//  Row 6+: marketing I-V (OBS), mixed/PDF (TRAFFIC), thread serpentine (PA/PB/TC/TD)
//  lastThreadRow-1: [Fibers OBS]  [Ractors TRF]  ← left of threads, not at the very bottom

const threadRowCount = Math.ceil((MAX_THREADS - 1) / 4);  // 8 for 32 threads
const lastThreadRow  = 4 + threadRowCount;                  // 12

const TREE_W = COL_TD + NODE_W + 4;   // 354
const TREE_H = 8 + (lastThreadRow + 1) * STEP + NODE_W + 16;

const TREE_NODES = [
  // ── VPS chain: center spine, rows 0-3
  { id: 'large_vps',        x: COL_CENTER, y: 8 + STEP * 0,  tooltipAlign: 'center', short: 'Large',   cat: 'infra'     },
  { id: 'medium_vps',       x: COL_CENTER, y: 8 + STEP * 1,  tooltipAlign: 'center', short: 'Medium',  cat: 'infra'     },
  { id: 'small_vps',        x: COL_CENTER, y: 8 + STEP * 2,  tooltipAlign: 'center', short: 'Small',   cat: 'infra'     },
  { id: 'nano_vps',         x: COL_CENTER, y: 8 + STEP * 3,  tooltipAlign: 'center', short: 'Nano',    cat: 'infra'     },

  // ── Process chain: 2-row serpentine (PA/PB/TC/TD)
  // Row 2 (right→left): P5(TD)  P6(TC)  P7(PB)  P8(PA)  — P5 directly above P4
  { id: 'process_5',        x: COL_TD,     y: 8 + STEP * 2,  tooltipAlign: 'right',  short: 'P5',      cat: 'scaling'   },
  { id: 'process_6',        x: COL_TC,     y: 8 + STEP * 2,  tooltipAlign: 'right',  short: 'P6',      cat: 'scaling'   },
  { id: 'process_7',        x: COL_PB,     y: 8 + STEP * 2,  tooltipAlign: 'right',  short: 'P7',      cat: 'scaling'   },
  { id: 'process_8',        x: COL_PA,     y: 8 + STEP * 2,  tooltipAlign: 'right',  short: 'P8',      cat: 'scaling'   },
  // Row 3 (left→right): Start(PA)  P2(PB)  P3(TC)  P4(TD)  — nano_vps→Start short rightward edge
  { id: 'process_2',        x: COL_PB,     y: 8 + STEP * 3,  tooltipAlign: 'right',  short: 'P2',      cat: 'scaling'   },
  { id: 'process_3',        x: COL_TC,     y: 8 + STEP * 3,  tooltipAlign: 'right',  short: 'P3',      cat: 'scaling'   },
  { id: 'process_4',        x: COL_TD,     y: 8 + STEP * 3,  tooltipAlign: 'right',  short: 'P4',      cat: 'scaling'   },

  // ── Row 2: top obs tier alongside small_vps + process chain (P5-P8 at TD/TC/PB/PA)
  { id: 'process_monitor',  x: COL_OBS,    y: 8 + STEP * 2,  tooltipAlign: 'left',   short: 'ProcMon', cat: 'obs'       },
  { id: 'memory_profiler',  x: COL_TRAFFIC,y: 8 + STEP * 2,  tooltipAlign: 'left',   short: 'Mem+',    cat: 'obs'       },

  // ── Row 3: mid obs tier + nano_vps + process chain (Start/PA, P2/PB, P3/TC, P4/TD)
  { id: 'monitoring',       x: COL_OBS,    y: 8 + STEP * 3,  tooltipAlign: 'left',   short: 'Monitor', cat: 'obs'       },
  { id: 'memory_meter',     x: COL_TRAFFIC,y: 8 + STEP * 3,  tooltipAlign: 'left',   short: 'RAM',     cat: 'obs'       },
  // process_1 is a visual root (always visible) — no edge points to it; unlocked by game logic
  { id: 'process_1',        x: COL_PA,     y: 8 + STEP * 3,  tooltipAlign: 'right',  short: 'Start',   cat: 'core'      },

  // ── Row 4: thread_1 alone — no same-row neighbors
  { id: 'thread_1',         x: COL_CENTER, y: 8 + STEP * 4,  tooltipAlign: 'center', short: 'T1',      cat: 'scaling'   },

  // ── Row 5: Tracing/Chart back on left (OBS/TRAFFIC), shares row with T2-T5 (different cols)
  // T1→Tracing uses a short down-left mid-split (midY=261, just above row5 top at 268 — no crossing)
  // process_1→T1: down-left mid-split (PA/row3 → CTR/row4)
  { id: 'request_tracing',  x: COL_OBS,    y: 8 + STEP * 5,  tooltipAlign: 'left',   short: 'Tracing', cat: 'obs'       },
  { id: 'throughput_graph', x: COL_TRAFFIC,y: 8 + STEP * 5,  tooltipAlign: 'left',   short: 'Chart',   cat: 'obs'       },

  // ── Marketing chain: COL_OBS, rows 6-10
  { id: 'marketing_1',      x: COL_OBS,    y: 8 + STEP * 6,  tooltipAlign: 'left',   short: 'I',       cat: 'marketing' },
  { id: 'marketing_2',      x: COL_OBS,    y: 8 + STEP * 7,  tooltipAlign: 'left',   short: 'II',      cat: 'marketing' },
  { id: 'marketing_3',      x: COL_OBS,    y: 8 + STEP * 8,  tooltipAlign: 'left',   short: 'III',     cat: 'marketing' },
  { id: 'marketing_4',      x: COL_OBS,    y: 8 + STEP * 9,  tooltipAlign: 'left',   short: 'IV',      cat: 'marketing' },
  { id: 'marketing_5',      x: COL_OBS,    y: 8 + STEP * 10, tooltipAlign: 'left',   short: 'V',       cat: 'marketing' },

  // ── Traffic: COL_TRAFFIC, rows 6 and 8 (interleaved with marketing)
  { id: 'mixed_requests',   x: COL_TRAFFIC,y: 8 + STEP * 6,  tooltipAlign: 'left',   short: 'Mixed',   cat: 'traffic'   },
  { id: 'report_requests',  x: COL_TRAFFIC,y: 8 + STEP * 8,  tooltipAlign: 'left',   short: 'PDF',     cat: 'traffic'   },

  // ── Runtime: fibers at last thread row, ractors one below — left of threads
  { id: 'fiber_scheduler',  x: COL_OBS,    y: 8 + lastThreadRow * STEP,       tooltipAlign: 'left',  short: 'Fibers',  cat: 'runtime' },
  { id: 'ractors',          x: COL_TRAFFIC,y: 8 + (lastThreadRow + 1) * STEP, tooltipAlign: 'left',  short: 'Ractors', cat: 'runtime' },

  // ── Thread serpentine: 4-wide (PA/PB/TC/TD), rows 5-12 (shares rows 5+ with left-col nodes)
  ...Array.from({ length: MAX_THREADS - 1 }, (_, i) => {
    const row  = Math.floor(i / 4);
    const pos  = i % 4;
    const lr   = [COL_PA, COL_PB, COL_TC, COL_TD];
    const rl   = [COL_TD, COL_TC, COL_PB, COL_PA];
    const cols = (row % 2 === 0) ? lr : rl;
    return {
      id:           `thread_${i + 2}`,
      x:            cols[pos],
      y:            8 + (5 + row) * STEP,
      tooltipAlign: 'right',
      short:        `T${i + 2}`,
      cat:          'scaling',
    };
  }),
];

const TREE_EDGES = [
  // VPS chain (upward)
  ['nano_vps',        'small_vps'],
  ['small_vps',       'medium_vps'],
  ['medium_vps',      'large_vps'],
  // nano_vps(CTR/row3) → process_1(PA/row3): short rightward edge (14px gap)
  ['nano_vps',        'process_1'],
  // process_1 → thread_1: down-right (PA/row3 → CTR/row4)
  ['process_1',       'thread_1'],
  // Process chain: 2-row serpentine
  // Row 3 left→right: Start(PA)→P2(PB)→P3(TC)→P4(TD)
  ['process_1',       'process_2'],   // same row, rightward (PA→PB)
  ['process_2',       'process_3'],   // same row, rightward (PB→TC)
  ['process_3',       'process_4'],   // same row, rightward (TC→TD)
  // Turn: P4(TD/row3) → P5(TD/row2): same col, upward
  ['process_4',       'process_5'],
  // Row 2 right→left: P5(TD)→P6(TC)→P7(PB)→P8(PA)
  ['process_5',       'process_6'],   // same row, leftward
  ['process_6',       'process_7'],   // same row, leftward
  ['process_7',       'process_8'],   // same row, leftward
  // Obs cluster
  // T1→Tracing: down-left, midY=261 — just above row5 top (268), so no crossing with row5 nodes
  ['thread_1',        'request_tracing'],
  ['request_tracing', 'throughput_graph'],  // same row → (OBS→TRAFFIC)
  ['request_tracing', 'monitoring'],        // same col (OBS), upward
  ['monitoring',      'process_monitor'],   // same col (OBS), upward
  ['thread_1',        'memory_meter'],      // up-left (CTR/row4 → TRAFFIC/row3)
  ['memory_meter',    'memory_profiler'],   // same col (TRAFFIC), upward
  // Traffic — 'bottom': straight down at x=123 then hook left, clears row5 Tracing/Chart
  ['thread_1',        'mixed_requests',   'bottom'],
  ['mixed_requests',  'report_requests'],
  // Fibers + Ractors — 'bottom': same vertical at x=123, clear of all thread/obs cols
  ['thread_1',        'fiber_scheduler', 'bottom'],
  ['thread_1',        'ractors',         'bottom'],
  // Thread serpentine — 'bottom': T1 to T2 goes straight down then hooks right into PA col
  ['thread_1',        'thread_2',        'bottom'],
  ...Array.from({ length: MAX_THREADS - 2 }, (_, i) => [`thread_${i + 2}`, `thread_${i + 3}`]),
  // Marketing chain — 'bottom': straight down then hook left, clears row5 Tracing/Chart
  ['thread_1',        'marketing_1',     'bottom'],
  ['marketing_1',     'marketing_2'],
  ['marketing_2',     'marketing_3'],
  ['marketing_3',     'marketing_4'],
  ['marketing_4',     'marketing_5'],
];

function edgePath(from, to, splitMode = 'mid') {
  if (from.y === to.y) {
    const hy = from.y + NODE_W / 2;
    if (from.x > to.x) return `M ${from.x} ${hy} H ${to.x + NODE_W}`;
    return `M ${from.x + NODE_W} ${hy} H ${to.x}`;
  }

  const goingUp = to.y < from.y;

  if (goingUp && to.x < from.x) {
    const sx = from.x;
    const sy = from.y + NODE_W / 2;
    const ex = to.x + NODE_W / 2;
    const ey = to.y + NODE_W;
    return `M ${sx} ${sy} H ${ex} V ${ey}`;
  }

  if (goingUp && to.x > from.x) {
    const sx = from.x + NODE_W;
    const sy = from.y + NODE_W / 2;
    const ex = to.x + NODE_W / 2;
    const ey = to.y + NODE_W;
    return `M ${sx} ${sy} H ${ex} V ${ey}`;
  }

  const x1 = from.x + NODE_W / 2;
  const y1 = goingUp ? from.y         : from.y + NODE_W;
  const x2 = to.x   + NODE_W / 2;
  const y2 = goingUp ? to.y + NODE_W  : to.y;
  if (Math.abs(x1 - x2) < 2) return `M ${x1} ${y1} V ${y2}`;
  if (splitMode === 'bottom') {
    const midDestY = to.y + NODE_W / 2;
    const edgeX = x2 < x1 ? to.x + NODE_W : to.x;
    return `M ${x1} ${y1} V ${midDestY} H ${edgeX}`;
  }
  const midY = Math.round((y1 + y2) / 2);
  return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`;
}

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
