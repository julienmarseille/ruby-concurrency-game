import { Graphics, Text, Container } from 'pixi.js';
import { C, LAYERS, PAD, TEXT_STYLES, TRACE_TICKS, OVERVIEW_TICKS, GRAPH_LABEL_W, PROCESS_GRAPH_H, SPACING } from '../config.js';

const LABEL_W = GRAPH_LABEL_W;
const GRAPH_H = PROCESS_GRAPH_H;
const GAP     = SPACING.sm;
const Y_TICKS = 2;

const SERIES = [
  { key: 'cpu', color: C.cpu,     label: 'CPU' },
  { key: 'gvl', color: C.gvlWait, label: 'GVL wait' },
];

export class ProcessGraph {
  constructor(stage, x, y, width) {
    this._stage  = stage;
    this._x      = x;
    this._y      = y;
    this._width  = width;

    this._gfx = new Graphics();
    this._gfx.zIndex = LAYERS.TRACE;
    stage.addChild(this._gfx);

    this._meta = new Container();
    this._meta.zIndex = LAYERS.TRACE_META;
    stage.addChild(this._meta);

    this._titleRecent   = this._makeText('Server Activity — last 1 min');
    this._titleOverview = this._makeText('Server Activity — last 10 min');

    this._yLabelsRecent   = this._makeYLabels();
    this._yLabelsOverview = this._makeYLabels();

    this._legend = SERIES.map(s => {
      const t = new Text({ text: s.label, style: { ...TEXT_STYLES.label, fill: s.color } });
      this._meta.addChild(t);
      return t;
    });

    this._positionMeta();
  }

  _makeText(text) {
    const t = new Text({ text, style: TEXT_STYLES.body });
    this._meta.addChild(t);
    return t;
  }

  _makeYLabels() {
    const labels = [];
    for (let i = 0; i <= Y_TICKS; i++) {
      const t = new Text({ text: '', style: TEXT_STYLES.label });
      t.anchor.x = 1;
      this._meta.addChild(t);
      labels.push(t);
    }
    return labels;
  }

  setY(y)     { this._y = y; this._positionMeta(); }
  setWidth(w) { this._width = w; this._positionMeta(); }

  _panelWidth() { return Math.floor((this._width - PAD - GAP) / 2); }

  _positionMeta() {
    const pW = this._panelWidth();
    this._titleRecent.x   = PAD;
    this._titleRecent.y   = this._y - 14;
    this._titleOverview.x = pW + GAP + PAD;
    this._titleOverview.y = this._y - 14;

    this._legend.forEach((t, i) => {
      t.x = PAD + LABEL_W + 4 + i * 56;
      t.y = this._y + GRAPH_H + 6;
    });
  }

  draw(recentData, overviewData) {
    const gfx = this._gfx;
    const pW  = this._panelWidth();
    gfx.clear();
    this._drawPanel(gfx, 0,        pW, recentData,   TRACE_TICKS,   this._yLabelsRecent);
    this._drawPanel(gfx, pW + GAP, pW, overviewData, OVERVIEW_TICKS, this._yLabelsOverview);
  }

  _drawPanel(gfx, x0, pW, data, totalTicks, yLabels) {
    const y0    = this._y;
    const drawW = pW - LABEL_W;
    const tickW = drawW / totalTicks;

    gfx.rect(x0, y0, pW, GRAPH_H + 4).fill({ color: C.bg });

    for (let i = 0; i <= Y_TICKS; i++) {
      const frac  = i / Y_TICKS;
      const lineY = y0 + GRAPH_H - frac * GRAPH_H + 2;
      gfx.moveTo(x0 + LABEL_W, lineY).lineTo(x0 + pW, lineY)
        .stroke({ color: C.border, width: 1, alpha: i === 0 ? 1 : 0.3 });
      yLabels[i].text = Math.round(frac * 100) + '%';
      yLabels[i].x    = x0 + LABEL_W - 4;
      yLabels[i].y    = lineY - 5;
    }

    for (const { key, color } of SERIES) {
      const series = data[key] ?? [];
      if (series.length < 2) continue;
      for (let i = 1; i < series.length; i++) {
        const x1 = x0 + LABEL_W + (i - 1) * tickW;
        const x2 = x0 + LABEL_W + i       * tickW;
        const y1 = y0 + GRAPH_H - (series[i - 1] / 100) * GRAPH_H + 2;
        const y2 = y0 + GRAPH_H - (series[i]     / 100) * GRAPH_H + 2;
        gfx.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, width: 1.5, alpha: 0.85 });
      }
    }

    const nowX = x0 + LABEL_W + (data.cpu?.length ?? 0) * tickW;
    gfx.moveTo(nowX, y0 + 2).lineTo(nowX, y0 + GRAPH_H + 2)
      .stroke({ color: C.accent, width: 1, alpha: 0.3 });

    gfx.moveTo(x0 + LABEL_W, y0).lineTo(x0 + LABEL_W, y0 + GRAPH_H + 4)
      .stroke({ color: C.border, width: 1 });
  }

  get totalHeight() { return GRAPH_H + 30; }

  setVisible(v) {
    this._gfx.visible  = v;
    this._meta.visible = v;
  }

  destroy() {
    this._gfx.destroy();
    this._meta.destroy({ children: true });
  }
}
