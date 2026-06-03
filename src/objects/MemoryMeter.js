import { Graphics, Text } from 'pixi.js';
import { C, CH, LAYERS, PAD, SPACING, TEXT_STYLES, OOM_WARN_PCT } from '../config.js';

const BAR_H         = 7;
const LABEL_OFFSET  = 14;
const BREAKDOWN_GAP = 26;
const TITLE_OFFSET  = 16;  // px above the grid rect
const ROW_H         = 22;
const HEADER_H      = 18;
const MAX_ROWS      = 6;   // header + up to 5 data rows
const CELL_PAD      = 10;
const FONT_SIZE     = 11;
const FONT_DIM      = 9;

// Fixed column widths for count + memory cols; category col fills the rest
const COL2_W  = 68;
const COL3_W  = 104;
const TABLE_X = PAD;

// header row + up to 5 data rows; fibers row only appears when unlocked
export const MEM_METER_BREAKDOWN_H = BREAKDOWN_GAP + HEADER_H + 5 * ROW_H + 8;

const LERP_FACTOR = 0.12;

const DATA_ROWS_BASE   = ['base', 'processes', 'threads', 'requests'];
const DATA_ROWS_FIBERS = ['base', 'processes', 'threads', 'fibers', 'requests'];

// Same formula as DualPanelGraph._panelWidth()
function halfPanelW(width) {
  return Math.floor((width - 2 * PAD - SPACING.sm) / 2);
}

export class MemoryMeter {
  constructor() {
    this._bg    = new Graphics();
    this._fill  = new Graphics();
    this._grid  = new Graphics();   // static grid — redrawn only on layout change
    this._label = new Text({ text: '', style: TEXT_STYLES.body });

    const labelStyle = { fontFamily: 'Courier New', fontSize: FONT_SIZE, fill: CH.textDim };
    const valueStyle = { fontFamily: 'Courier New', fontSize: FONT_SIZE, fill: CH.text   };

    this._col1 = Array.from({ length: MAX_ROWS }, () => new Text({ text: '', style: { ...labelStyle } }));
    // col2 and col3: anchor.x=1 so x position is the RIGHT edge — never needs recalculating
    this._col2 = Array.from({ length: MAX_ROWS }, () => {
      const t = new Text({ text: '', style: { ...valueStyle } });
      t.anchor.set(1, 0);
      return t;
    });
    this._col3 = Array.from({ length: MAX_ROWS }, () => {
      const t = new Text({ text: '', style: { ...valueStyle } });
      t.anchor.set(1, 0);
      return t;
    });

    this._tableTitle = new Text({ text: 'Memory breakdown', style: TEXT_STYLES.body });
    this._tableTitle.zIndex = LAYERS.MEMORY_TEXT;
    this._tableTitle.visible = false;

    this._hasProfiler       = false;
    this._displayPct        = 0;
    this._displayUsed       = 0;
    this._lastStartY        = null;
    this._lastFibersEnabled = null;
    this._lastTableWidth    = null;

    this._bg.zIndex    = LAYERS.MEMORY_METER;
    this._fill.zIndex  = LAYERS.MEMORY_METER;
    this._grid.zIndex  = LAYERS.MEMORY_TEXT;
    this._label.zIndex = LAYERS.MEMORY_TEXT;
    for (const t of [...this._col1, ...this._col2, ...this._col3]) t.zIndex = LAYERS.MEMORY_TEXT;
  }

  setProfilerEnabled(v) {
    this._hasProfiler = v;
    if (!v) this._hideTable();
  }

  addTo(parent) {
    parent.addChild(this._bg, this._fill, this._grid, this._label, this._tableTitle);
    for (const t of [...this._col1, ...this._col2, ...this._col3]) parent.addChild(t);
  }

  draw(y, width, pct, memUsed, memMax, breakdown) {
    this._displayPct  += (pct     - this._displayPct)  * LERP_FACTOR;
    this._displayUsed += (memUsed - this._displayUsed) * LERP_FACTOR;

    const smoothPct  = this._displayPct;
    const smoothUsed = Math.round(this._displayUsed);
    const mW = width - PAD * 2;

    this._bg.clear();
    this._bg.rect(PAD, y, mW, BAR_H).fill({ color: C.surface });

    this._fill.clear();
    const fc       = smoothPct > 0.8 ? C.danger : smoothPct > 0.6 ? C.cpu : C.green;
    const pulse    = pct > OOM_WARN_PCT ? 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 250)) : 1;
    this._fill.rect(PAD, y, Math.max(4, mW * smoothPct), BAR_H).fill({ color: fc, alpha: pulse });

    this._label.text = `Memory  ${smoothUsed} / ${memMax} MB`;
    this._label.x    = PAD;
    this._label.y    = y - LABEL_OFFSET;

    if (this._hasProfiler && breakdown) {
      const startY    = y + BAR_H + BREAKDOWN_GAP;
      const fibersOn  = breakdown.fibersEnabled;
      const tableW    = halfPanelW(width);
      if (startY !== this._lastStartY || fibersOn !== this._lastFibersEnabled || tableW !== this._lastTableWidth) {
        this._drawGrid(startY, fibersOn, tableW);
        this._lastStartY        = startY;
        this._lastFibersEnabled = fibersOn;
        this._lastTableWidth    = tableW;
      }
      this._updateValues(breakdown);
    } else {
      this._hideTable();
    }
  }

  // Grid is static — only redrawn on layout change or when fibers toggle
  _drawGrid(startY, fibersEnabled, tableW) {
    const defs   = fibersEnabled ? DATA_ROWS_FIBERS : DATA_ROWS_BASE;
    const dataH  = defs.length * ROW_H;
    const tH     = HEADER_H + dataH;
    const col1W  = tableW - COL2_W - COL3_W;
    const x1     = TABLE_X + col1W;
    const x2     = x1 + COL2_W;
    const col2R  = x1 + COL2_W - CELL_PAD;
    const col3R  = x2 + COL3_W - CELL_PAD;

    this._tableTitle.x       = TABLE_X;
    this._tableTitle.y       = startY - TITLE_OFFSET;
    this._tableTitle.visible = true;

    this._grid.clear();

    // Outer border
    this._grid.rect(TABLE_X, startY, tableW, tH).stroke({ color: C.border, width: 1 });

    // Vertical dividers (full height)
    this._grid.moveTo(x1, startY).lineTo(x1, startY + tH).stroke({ color: C.border, width: 1 });
    this._grid.moveTo(x2, startY).lineTo(x2, startY + tH).stroke({ color: C.border, width: 1 });

    // Header bottom border
    this._grid.moveTo(TABLE_X, startY + HEADER_H).lineTo(TABLE_X + tableW, startY + HEADER_H)
      .stroke({ color: C.border, width: 1 });

    // Data row dividers
    for (let i = 1; i < defs.length; i++) {
      const ry = startY + HEADER_H + i * ROW_H;
      this._grid.moveTo(TABLE_X, ry).lineTo(TABLE_X + tableW, ry).stroke({ color: C.border, width: 1 });
    }

    // Header text (row 0)
    const hTextY = Math.floor((HEADER_H - FONT_DIM) / 2);
    this._col1[0].text            = 'category';
    this._col1[0].style.fill      = CH.textDim;
    this._col1[0].style.fontSize  = FONT_DIM;
    this._col1[0].x               = TABLE_X + CELL_PAD;
    this._col1[0].y               = startY + hTextY;
    this._col1[0].visible         = true;

    this._col2[0].text            = 'count';
    this._col2[0].style.fill      = CH.textDim;
    this._col2[0].style.fontSize  = FONT_DIM;
    this._col2[0].x               = col2R;
    this._col2[0].y               = startY + hTextY;
    this._col2[0].visible         = true;

    this._col3[0].text            = 'memory';
    this._col3[0].style.fill      = CH.textDim;
    this._col3[0].style.fontSize  = FONT_DIM;
    this._col3[0].x               = col3R;
    this._col3[0].y               = startY + hTextY;
    this._col3[0].visible         = true;

    // Position data rows (1..N)
    const textY = Math.floor((ROW_H - FONT_SIZE) / 2);
    for (let i = 0; i < defs.length; i++) {
      const row = i + 1;
      const ry  = startY + HEADER_H + i * ROW_H;
      this._col1[row].style.fontSize = FONT_SIZE;
      this._col1[row].x = TABLE_X + CELL_PAD;
      this._col1[row].y = ry + textY;
      this._col2[row].x = col2R;
      this._col2[row].y = ry + textY;
      this._col3[row].x = col3R;
      this._col3[row].y = ry + textY;
    }

    // Hide unused rows beyond current defs length
    for (let i = defs.length + 1; i < MAX_ROWS; i++) {
      this._col1[i].visible = this._col2[i].visible = this._col3[i].visible = false;
    }
  }

  // Only updates text content — positions never touched
  _updateValues(bd) {
    const defs = bd.fibersEnabled ? DATA_ROWS_FIBERS : DATA_ROWS_BASE;
    const data = this._buildData(bd, defs);

    for (let i = 0; i < defs.length; i++) {
      const row = data[i];
      const idx = i + 1;
      this._col1[idx].text       = row.label;
      this._col1[idx].style.fill = CH.textDim;
      this._col1[idx].visible    = true;
      this._col2[idx].text       = row.count;
      this._col2[idx].style.fill = CH.text;
      this._col2[idx].visible    = true;
      this._col3[idx].text       = row.mb !== null ? `${row.mb} MB` : '';
      this._col3[idx].style.fill = CH.text;
      this._col3[idx].visible    = true;
    }
  }

  _buildData(bd, defs) {
    return defs.map(key => {
      switch (key) {
        case 'base':
          return { label: 'base',      count: '',                                                mb: bd.base };
        case 'threads':
          return { label: 'threads',   count: bd.threadCount > 0  ? `×${bd.threadCount}`  : '', mb: bd.threadsMb || null };
        case 'processes':
          return { label: 'processes', count: bd.processCount > 0 ? `×${bd.processCount}` : '', mb: bd.processesMb || null };
        case 'fibers': {
          if (bd.fiberCount === 0) return { label: 'fibers', count: '', mb: null };
          return { label: 'fibers', count: `×${bd.fiberCount}`, mb: Math.max(1, bd.fibersMb) };
        }
        case 'requests': {
          const active = bd.fibersEnabled ? bd.fiberActiveCount > 0 : bd.requestsMb > 0;
          const count  = bd.fibersEnabled ? `×${bd.fiberActiveCount}` : '';
          return { label: 'requests', count: active ? count : '', mb: active ? bd.requestsMb : null };
        }
        default: return { label: key, count: '', mb: null };
      }
    });
  }

  _hideTable() {
    this._grid.clear();
    this._tableTitle.visible = false;
    this._lastStartY         = null;
    this._lastFibersEnabled  = null;
    this._lastTableWidth     = null;
    for (const t of [...this._col1, ...this._col2, ...this._col3]) { t.text = ''; t.visible = false; }
  }

  setVisible(v) {
    this._bg.visible    = v;
    this._fill.visible  = v;
    this._label.visible = v;
    if (!v) this._hideTable();
  }

  destroy() {
    this._bg.destroy();
    this._fill.destroy();
    this._grid.destroy();
    this._label.destroy();
    this._tableTitle.destroy();
    for (const t of [...this._col1, ...this._col2, ...this._col3]) t.destroy();
  }
}
