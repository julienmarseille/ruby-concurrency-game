// ─── Simulation ──────────────────────────────────────────────────────────────
export const TICK_MS          = 50;
export const SPAWN_MS         = 1000;
export const STATS_MS         = 1000;
export const PIPE_TRAVEL_MS   = 150;
export const MEM_BASE         = 200;
export const MEM_NANO         = 512;
export const MEM_SMALL        = 1024;
export const MEM_MEDIUM       = 2048;
export const MEM_LARGE        = 4096;
export const THREAD_MEM       = 18;
export const PROCESS_MEM      = 50;
// Thread costs: groups of 4 matching the 4 threads-per-process model
export const THREAD_COSTS  = [
  100, 100, 100, 100,   // process 1
  150, 150, 150, 150,   // process 2
  200, 200, 200, 200,   // process 3
  250, 250, 250, 250,   // process 4
  300, 300, 300, 300,   // process 5
  350, 350, 350, 350,   // process 6
  400, 400, 400, 400,   // process 7
  450, 450, 450, 450,   // process 8
];
export function threadCostFor(n) {
  return THREAD_COSTS[Math.min(n - 1, THREAD_COSTS.length - 1)];
}

// Process costs escalate per additional process (process_1 is free)
export const PROCESS_COSTS = [0, 0, 200, 300, 400, 500, 600, 700, 800];
export function processCostFor(n) {
  return PROCESS_COSTS[Math.min(n, PROCESS_COSTS.length - 1)] ?? 800;
}
export const BASE_SPAWN_RATE  = 0.5;
export const FIBER_MEM        = 0.5;
export const MAX_THREADS      = 32;

// ─── Layout (shared by JS modules) ───────────────────────────────────────────
export const PAD              = 14;
export const PIPE_W           = 48;
export const PIPE_ENTRY_Y     = 20;
export const MEM_Y            = 20;
export const MONITOR_MIN_H    = 150;

// ─── Spacing scale (8px base) ────────────────────────────────────────────────
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
};

// ─── Graph dimensions (shared by TraceGraph + ThroughputGraph) ───────────────
export const TRACE_TICKS        = 300;
export const TRACE_SAMPLE_EVERY = 4;
export const GRAPH_LABEL_W      = 36;
export const TRACE_LABEL_W      = 90;
export const TRACE_ROW_H        = 22;
export const THROUGHPUT_H       = 88;
export const PROCESS_GRAPH_H    = 128;
export const TRACE_VISIBLE_ROWS = 4;
export const OVERVIEW_AGGREGATE = 10;
export const OVERVIEW_TICKS     = 300;

// ─── Z-index layers ──────────────────────────────────────────────────────────
export const LAYERS = {
  MEMORY_METER:  1,
  MEMORY_TEXT:   2,
  TRACE:         3,
  TRACE_LABELS:  4,
  CARDS:         5,
  TRACE_META:    6,
  RACTOR_HDR:    8,
  PROCESS_HDR:   14,
  PIPES:         7,
  PARTICLES:     10,
};

// ─── Colour palette (single source of truth) ─────────────────────────────────
// C  = PixiJS hex numbers (0xRRGGBB)
// CH = HTML/CSS hex strings ('#rrggbb')
// CSS :root vars in style.css mirror these values.
const PALETTE = {
  bg:             '#0f0f1a',  // slightly lifted dark indigo — projector-safe
  card:           '#141e30',  // darker blue-tinted card — creates elevation vs bg
  cardCpu:        '#1a1200',  // warm tint for CPU-state thread cards
  cardIo:         '#001525',  // cool tint for I/O-state thread cards
  cardWait:       '#1a0018',  // magenta tint for GVL-wait thread cards
  cardCpuBadge:   '#3a2800',
  cardIoBadge:    '#00253d',
  cardGvlBadge:   '#3a0020',
  border:         '#2e3f60',  // visible blue-tinted border (was near-invisible dark gray)
  surface:        '#1c2840',  // panel surfaces — lighter than card
  pipe:           '#1c2840',
  accent:         '#00d4ff',  // cyan — replaces blue, unifies with io color
  cpu:            '#ffaa00',  // bright amber — was too muted (#d29922)
  io:             '#00d4ff',  // bright cyan — was too similar to accent blue
  gvlWait:        '#ff0055',  // HOT MAGENTA — was purple, now unmistakably alarming
  gvlWaitLight:   '#ff4488',  // lighter magenta for secondary GVL indicators
  gvlNormal:      '#cc0044',  // darker magenta for resolved GVL state
  idle:           '#141e30',  // same as card — idle threads recede
  green:          '#00e676',  // brighter green — was too dim for projector
  text:           '#e6edf3',  // keep
  textDim:        '#8b949e',  // keep
  danger:         '#ff4444',  // bright red — reserved for OOM crash only (not GVL)
};

export const C  = Object.fromEntries(
  Object.entries(PALETTE).map(([k, v]) => [k, parseInt(v.slice(1), 16)])
);
export const CH = { ...PALETTE };

// ─── Text style registry ─────────────────────────────────────────────────────
export const TEXT_STYLES = {
  label:      { fontFamily: 'Courier New', fontSize: 12, fill: CH.textDim },
  body:       { fontFamily: 'Courier New', fontSize: 14, fill: CH.text    },
  bodyDim:    { fontFamily: 'Courier New', fontSize: 14, fill: CH.textDim },
  threadName: { fontFamily: 'Courier New', fontSize: 14, fill: CH.textDim },
  section:    { fontFamily: 'Courier New', fontSize: 16, fill: CH.text, fontWeight: 'bold' },
};

// ─── GVL thresholds ───────────────────────────────────────────────────────────
export const GVL_ALERT   = 60;
export const GVL_WARNING = 30;

// ─── Memory pressure ─────────────────────────────────────────────────────────
export const OOM_WARN_PCT      = 0.90;  // memory bar starts pulsing
export const OOM_RESTART_TICKS = 40;   // 2s downtime at 50ms/tick

// ─── Events ───────────────────────────────────────────────────────────────────
export const EVENTS = {
  THREAD_ADDED:          'threadAdded',
  THREAD_REMOVED:        'threadRemoved',
  PROCESS_ADDED:         'processAdded',
  REQUEST_SPAWNED:       'requestSpawned',
  REQUEST_ASSIGNED:      'requestAssigned',
  REQUEST_COMPLETED:     'requestCompleted',
  UPGRADE_UNLOCKED:      'upgradeUnlocked',
  THREADS_REDISTRIBUTED: 'threadsRedistributed',
  OOM_CRASH:             'oomCrash',
  PROCESS_REMOVED:       'processRemoved',
};

// ─── Request types ────────────────────────────────────────────────────────────
export const REQ_TYPES = {
  DB_REQUEST: {
    label: 'GET /users',
    sub: 'DB query',
    cls: 'io',
    emoji: '🔵',
    color: 0x4299e1,
    colorStr: '#4299e1',
    memMB: 20,
    phases: [
      { type: 'cpu', ms: 800,  label: 'Route & parse'  },
      { type: 'io',  ms: 4800, label: 'SELECT query'   },
      { type: 'cpu', ms: 800,  label: 'Serialize JSON' },
    ],
    reward: 15,
  },

  DB_REQUEST_HEAVY_START: {
    label: 'GET /profile',
    sub: 'Fetch + process',
    cls: 'io',
    emoji: '🔷',
    color: 0x29b6f6,
    colorStr: '#29b6f6',
    memMB: 25,
    phases: [
      { type: 'cpu', ms: 200,  label: 'Auth & route'      },
      { type: 'io',  ms: 4800, label: 'SELECT query'      },
      { type: 'cpu', ms: 1400, label: 'Process & respond' },
    ],
    reward: 15,
  },

  DB_REQUEST_FRAGMENTED: {
    label: 'POST /search',
    sub: 'Multi-query',
    cls: 'io',
    emoji: '💠',
    color: 0x26c6da,
    colorStr: '#26c6da',
    memMB: 30,
    phases: [
      { type: 'cpu', ms: 400,  label: 'Parse query'    },
      { type: 'io',  ms: 1600, label: 'Index lookup'   },
      { type: 'cpu', ms: 400,  label: 'Filter results' },
      { type: 'io',  ms: 1600, label: 'Fetch records'  },
      { type: 'cpu', ms: 400,  label: 'Rank & sort'    },
      { type: 'io',  ms: 1600, label: 'Load relations' },
      { type: 'cpu', ms: 400,  label: 'Serialize'      },
    ],
    reward: 18,
  },

  MIXED: {
    label: 'POST /checkout',
    sub: 'Auth + DB write',
    cls: 'mixed',
    emoji: '🟡',
    color: 0xe8a838,
    colorStr: '#e8a838',
    memMB: 35,
    phases: [
      { type: 'cpu', ms: 1000, label: 'Parse params'   },
      { type: 'io',  ms: 2000, label: 'Auth check'     },
      { type: 'cpu', ms: 1000, label: 'Business logic' },
      { type: 'io',  ms: 2000, label: 'DB write'       },
      { type: 'cpu', ms: 2000, label: 'Respond'        },
    ],
    reward: 27,
  },

  REPORT: {
    label: 'GET /export.pdf',
    sub: 'PDF generation',
    cls: 'cpu',
    emoji: '🔴',
    color: 0xfc8181,
    colorStr: '#fc8181',
    memMB: 70,
    phases: [
      { type: 'cpu', ms: 2000, label: 'Validate input'  },
      { type: 'io',  ms: 400,  label: 'Fetch records'   },
      { type: 'cpu', ms: 3200, label: 'Render PDF'      },
      { type: 'io',  ms: 400,  label: 'Write to disk'   },
      { type: 'cpu', ms: 2000, label: 'Compress & send' },
    ],
    reward: 45,
  },
};
