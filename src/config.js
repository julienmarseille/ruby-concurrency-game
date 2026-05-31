// ─── Simulation ──────────────────────────────────────────────────────────────
export const TICK_MS          = 50;
export const SPAWN_MS         = 1000;
export const STATS_MS         = 1000;
export const PIPE_TRAVEL_MS   = 150;
export const MEM_BASE         = 200;
export const MEM_MAX          = 3072;
export const THREAD_MEM       = 50;
export const PROCESS_MEM      = 100;
export const THREAD_COST      = 100;
export const PROCESS_COST     = 150;
export const BASE_SPAWN_RATE  = 1;
export const FIBER_MEM        = 25;
export const MAX_THREADS      = 12;

// ─── Layout (shared by JS modules) ───────────────────────────────────────────
export const PAD              = 14;
export const PIPE_W           = 48;
export const PIPE_ENTRY_Y     = 20;
export const MEM_Y            = 20;
export const MEM_DISPLAY_MAX  = MEM_MAX;
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
export const GRAPH_LABEL_W      = 72;
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
  PROCESS_HDR:   14,
  PIPES:         7,
  PARTICLES:     10,
};

// ─── Colour palette (single source of truth) ─────────────────────────────────
// C  = PixiJS hex numbers (0xRRGGBB)
// CH = HTML/CSS hex strings ('#rrggbb')
// CSS :root vars in style.css mirror these values.
const PALETTE = {
  bg:           '#0d1117',
  card:         '#161b22',
  cardCpu:      '#1a1300',
  cardIo:       '#0a1929',
  cardWait:     '#140d2a',
  border:       '#30363d',
  surface:      '#21262d',
  pipe:         '#2d333b',
  accent:       '#58a6ff',
  cpu:          '#d29922',
  io:           '#4299e1',
  gvlWait:      '#6e40c9',
  gvlWaitLight: '#8957e5',
  idle:         '#1c2128',
  green:        '#3fb950',
  text:         '#e6edf3',
  textDim:      '#8b949e',
  danger:       '#f85149',
};

export const C  = Object.fromEntries(
  Object.entries(PALETTE).map(([k, v]) => [k, parseInt(v.slice(1), 16)])
);
export const CH = { ...PALETTE };

// ─── Text style registry ─────────────────────────────────────────────────────
export const TEXT_STYLES = {
  label:      { fontFamily: 'Courier New', fontSize: 9,  fill: CH.textDim },
  body:       { fontFamily: 'Courier New', fontSize: 10, fill: CH.text    },
  bodyDim:    { fontFamily: 'Courier New', fontSize: 10, fill: CH.textDim },
  threadName: { fontFamily: 'Courier New', fontSize: 11, fill: CH.textDim },
  section:    { fontFamily: 'Courier New', fontSize: 13, fill: CH.text, fontWeight: 'bold' },
};

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
    phases: [
      { type: 'cpu', ms: 800,  label: 'Route & parse'  },
      { type: 'io',  ms: 4800, label: 'SELECT query'   },
      { type: 'cpu', ms: 800,  label: 'Serialize JSON' },
    ],
    reward: 10,
  },

  DB_REQUEST_HEAVY_START: {
    label: 'GET /profile',
    sub: 'Fetch + process',
    cls: 'io',
    emoji: '🔷',
    color: 0x29b6f6,
    colorStr: '#29b6f6',
    phases: [
      { type: 'cpu', ms: 200,  label: 'Auth & route'      },
      { type: 'io',  ms: 4800, label: 'SELECT query'      },
      { type: 'cpu', ms: 1400, label: 'Process & respond' },
    ],
    reward: 10,
  },

  DB_REQUEST_FRAGMENTED: {
    label: 'POST /search',
    sub: 'Multi-query',
    cls: 'io',
    emoji: '💠',
    color: 0x26c6da,
    colorStr: '#26c6da',
    phases: [
      { type: 'cpu', ms: 400,  label: 'Parse query'    },
      { type: 'io',  ms: 1600, label: 'Index lookup'   },
      { type: 'cpu', ms: 400,  label: 'Filter results' },
      { type: 'io',  ms: 1600, label: 'Fetch records'  },
      { type: 'cpu', ms: 400,  label: 'Rank & sort'    },
      { type: 'io',  ms: 1600, label: 'Load relations' },
      { type: 'cpu', ms: 400,  label: 'Serialize'      },
    ],
    reward: 10,
  },

  MIXED: {
    label: 'POST /checkout',
    sub: 'Auth + DB write',
    cls: 'mixed',
    emoji: '🟡',
    color: 0xe8a838,
    colorStr: '#e8a838',
    phases: [
      { type: 'cpu', ms: 1000, label: 'Parse params'   },
      { type: 'io',  ms: 2000, label: 'Auth check'     },
      { type: 'cpu', ms: 1000, label: 'Business logic' },
      { type: 'io',  ms: 2000, label: 'DB write'       },
      { type: 'cpu', ms: 2000, label: 'Respond'        },
    ],
    reward: 18,
  },

  REPORT: {
    label: 'GET /export.pdf',
    sub: 'PDF generation',
    cls: 'cpu',
    emoji: '🔴',
    color: 0xfc8181,
    colorStr: '#fc8181',
    phases: [
      { type: 'cpu', ms: 2000, label: 'Validate input'  },
      { type: 'io',  ms: 400,  label: 'Fetch records'   },
      { type: 'cpu', ms: 3200, label: 'Render PDF'      },
      { type: 'io',  ms: 400,  label: 'Write to disk'   },
      { type: 'cpu', ms: 2000, label: 'Compress & send' },
    ],
    reward: 30,
  },
};
