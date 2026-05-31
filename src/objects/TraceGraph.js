import { Graphics, Text, Container } from 'pixi.js';
import { C, LAYERS, PAD, TEXT_STYLES, TRACE_TICKS, TRACE_SAMPLE_EVERY, GRAPH_LABEL_W, TRACE_ROW_H } from '../config.js';

const COLORS  = { cpu: C.cpu, io: C.io, gvl_wait: C.gvlWait, idle: C.idle };
const LABEL_W = GRAPH_LABEL_W;
const ROW_H   = TRACE_ROW_H;

const LEGEND_ITEMS = [
  { color: C.cpu,     label: 'CPU'      },
  { color: C.io,      label: 'I/O'      },
  { color: C.gvlWait, label: 'GVL wait' },
  { color: C.idle,    label: 'Idle'     },
];

export class TraceGraph {
  constructor(x, y, width) {
    this._x           = x;
    this._y           = y;
    this._width       = width;
    this._buffers     = {};
    this._tickCount   = 0;
    this._threadOrder = [];
    this._visible     = true;
    this._threadLabels = {};

    this._gfx = new Graphics();
    this._gfx.zIndex = LAYERS.TRACE;

    this._metaContainer = new Container();
    this._metaContainer.zIndex = LAYERS.TRACE_META;

    this._labelsContainer = new Container();
    this._labelsContainer.zIndex = LAYERS.TRACE_LABELS;

    this._buildTitleAndLegend();
  }

  addTo(parent) {
    parent.addChild(this._gfx);
    parent.addChild(this._metaContainer);
    parent.addChild(this._labelsContainer);
  }

  _buildTitleAndLegend() {
    this._titleText = new Text({ text: 'Thread Activity Timeline', style: TEXT_STYLES.body });
    this._metaContainer.addChild(this._titleText);

    this._legendDots  = [];
    this._legendTexts = [];
    for (const item of LEGEND_ITEMS) {
      const dot = new Graphics();
      dot.rect(0, 0, 10, 10).fill({ color: item.color });
      this._metaContainer.addChild(dot);
      this._legendDots.push(dot);

      const txt = new Text({ text: item.label, style: TEXT_STYLES.body });
      this._metaContainer.addChild(txt);
      this._legendTexts.push(txt);
    }

    this._positionMeta();
  }

  addThread(thread) {
    this._buffers[thread.id] = [];
    this._threadOrder.push(thread.id);

    const label = new Text({ text: thread.label, style: TEXT_STYLES.body });
    this._labelsContainer.addChild(label);
    this._threadLabels[thread.id] = label;

    this._positionMeta();
  }

  removeThread(threadId) {
    delete this._buffers[threadId];
    this._threadOrder = this._threadOrder.filter(id => id !== threadId);
    const label = this._threadLabels[threadId];
    if (label) {
      this._labelsContainer.removeChild(label);
      label.destroy();
      delete this._threadLabels[threadId];
    }
    this._positionMeta();
  }

  sample(threads) {
    this._tickCount++;
    if (this._tickCount % TRACE_SAMPLE_EVERY !== 0) return;
    for (const t of threads) {
      const buf = this._buffers[t.id];
      if (!buf) continue;
      buf.push(t.status);
      if (buf.length > TRACE_TICKS) buf.shift();
    }
  }

  draw(threads) {
    const gfx   = this._gfx;
    const W     = this._width;
    const drawW = W - LABEL_W - PAD;
    const x0    = this._x;
    const y0    = this._y;

    gfx.clear();
    gfx.rect(x0, y0, W - PAD, threads.length * ROW_H + 4).fill({ color: C.bg });

    const tickW = drawW / TRACE_TICKS;

    threads.forEach((t, row) => {
      const buf = this._buffers[t.id] || [];
      const ry  = y0 + row * ROW_H + 2;

      buf.forEach((status, i) => {
        const color = COLORS[status] ?? COLORS.idle;
        gfx.rect(x0 + LABEL_W + i * tickW, ry, Math.ceil(tickW) + 0.5, ROW_H - 4).fill({ color });
      });

      const nowX = x0 + LABEL_W + buf.length * tickW;
      gfx.moveTo(nowX, ry).lineTo(nowX, ry + ROW_H - 4)
        .stroke({ color: C.accent, width: 1, alpha: 0.3 });
    });

    gfx.moveTo(x0 + LABEL_W, y0).lineTo(x0 + LABEL_W, y0 + threads.length * ROW_H + 4)
      .stroke({ color: C.border, width: 1 });
  }

  setY(y)     { this._y = y; this._positionMeta(); }
  setWidth(w) { this._width = w; this._positionMeta(); }

  _positionMeta() {
    const headerY = this._y - 16;

    this._titleText.x = PAD;
    this._titleText.y = headerY;

    let lx = 220;
    for (let i = 0; i < this._legendDots.length; i++) {
      this._legendDots[i].x  = lx;      this._legendDots[i].y  = headerY;
      this._legendTexts[i].x = lx + 13; this._legendTexts[i].y = headerY;
      lx += 80;
    }

    this._threadOrder.forEach((id, i) => {
      const label = this._threadLabels[id];
      if (label) { label.x = PAD; label.y = this._y + i * ROW_H + 6; }
    });
  }

  setVisible(v) {
    this._visible                 = v;
    this._gfx.visible             = v;
    this._metaContainer.visible   = v;
    this._labelsContainer.visible = v;
  }

  destroy() {
    this._gfx.destroy();
    this._metaContainer.destroy({ children: true });
    this._labelsContainer.destroy({ children: true });
  }

  get rowHeight()   { return ROW_H; }
  get totalHeight() { return Object.keys(this._buffers).length * ROW_H + 24; }
}
