// ─── Simulation ──────────────────────────────────────────────────────────────
export const TICK_MS    = 50;
export const MEM_BASE   = 200;
export const MEM_MAX    = 512;
export const THREAD_MEM = 50;

// ─── Layout (shared by JS modules) ───────────────────────────────────────────
export const PAD             = 14;
export const PIPE_W          = 48;
export const PIPE_ENTRY_Y    = 20;
export const MEM_Y           = 20;
export const MEM_DISPLAY_MAX = MEM_BASE + THREAD_MEM * 6;

// ─── Graph dimensions (shared by TraceGraph + ThroughputGraph) ───────────────
export const TRACE_TICKS        = 300;
export const TRACE_SAMPLE_EVERY = 4;
export const GRAPH_LABEL_W      = 72;
export const TRACE_ROW_H        = 22;
export const THROUGHPUT_H       = 44;

// ─── Z-index layers ──────────────────────────────────────────────────────────
export const LAYERS = {
  MEMORY_METER:  1,
  MEMORY_TEXT:   2,
  TRACE:         3,
  TRACE_LABELS:  4,
  CARDS:         5,
  TRACE_META:    6,
  PIPES:         7,
  PARTICLES:    10,
};

// ─── Colour palette ───────────────────────────────────────────────────────────
export const C = {
  bg:       0x0d1117,
  card:     0x161b22,
  cardCpu:  0x1a1300,
  cardIo:   0x0a1929,
  cardWait: 0x140d2a,
  border:   0x30363d,
  surface:  0x21262d,
  pipe:     0x2d333b,
  accent:   0x58a6ff,
  cpu:      0xd29922,
  io:       0x4299e1,
  gvlWait:  0x6e40c9,
  idle:     0x1c2128,
  green:    0x3fb950,
  text:     0xe6edf3,
  textDim:  0x8b949e,
  danger:   0xf85149,
};

export const CH = {
  cpu:     '#d29922',
  io:      '#4299e1',
  gvlWait: '#6e40c9',
  idle:    '#1c2128',
  textDim: '#8b949e',
  accent:  '#58a6ff',
};

// ─── Events ───────────────────────────────────────────────────────────────────
export const EVENTS = {
  THREAD_ADDED:      'threadAdded',
  REQUEST_SPAWNED:   'requestSpawned',
  REQUEST_ASSIGNED:  'requestAssigned',
  REQUEST_COMPLETED: 'requestCompleted',
  PHASE_CHANGED:     'phaseChanged',
  UPGRADE_UNLOCKED:  'upgradeUnlocked',
};

// ─── Request types ────────────────────────────────────────────────────────────
// IO% = sum(io phases) / total
// Saturation at N threads when IO% >= (N-1)/N
export const REQ_TYPES = {
  DB_REQUEST: {
    label: 'GET /users',
    sub: 'DB query',
    cls: 'io',
    emoji: '🔵',
    color: 0x4299e1,
    colorStr: '#4299e1',
    phases: [
      { type: 'cpu', ms: 1000, label: 'Route & parse'  },
      { type: 'io',  ms: 6000, label: 'SELECT query'   },
      { type: 'cpu', ms: 1000, label: 'Serialize JSON' },
    ],
    // IO = 6000 / 8000 = 75% → saturates at 4 threads
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
      { type: 'cpu', ms: 400,  label: 'Parse params'   },
      { type: 'io',  ms: 1200, label: 'Auth check'     },
      { type: 'cpu', ms: 800,  label: 'Business logic' },
      { type: 'io',  ms: 1800, label: 'DB write'       },
      { type: 'cpu', ms: 400,  label: 'Respond'        },
    ],
    // IO = 3000 / 4600 ≈ 65% → saturates at 2–3 threads
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
      { type: 'cpu', ms: 1500, label: 'Validate input'  },
      { type: 'io',  ms: 1000, label: 'Fetch records'   },
      { type: 'cpu', ms: 4500, label: 'Render PDF'      },
      { type: 'io',  ms: 500,  label: 'Write to disk'   },
      { type: 'cpu', ms: 1500, label: 'Compress & send' },
    ],
    // IO = 1500 / 9000 ≈ 17% → barely 1 thread useful
    reward: 30,
  },
};
