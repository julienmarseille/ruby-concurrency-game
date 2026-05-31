import { C, PAD, TRACE_TICKS, OVERVIEW_TICKS, GRAPH_LABEL_W, THROUGHPUT_H, SPACING } from '../config.js';
import { DualPanelGraph } from './DualPanelGraph.js';

const LABEL_W = GRAPH_LABEL_W;
const GRAPH_H = THROUGHPUT_H;
const Y_TICKS = 4;
const GAP     = SPACING.sm;

export class ThroughputGraph extends DualPanelGraph {
  constructor(x, y, width) {
    super(x, y, width);
    this._yMaxRecent   = 0.5;
    this._yMaxOverview = 0.5;

    this._titleRecent   = this._createLabel('Throughput — last 1 min');
    this._titleOverview = this._createLabel('Throughput — last 10 min');

    this._yLabelsRecent   = this._createYLabels(Y_TICKS);
    this._yLabelsOverview = this._createYLabels(Y_TICKS);

    this._positionMeta();
  }

  draw(recentData, overviewData) {
    if (recentData.length > 0)   this._yMaxRecent   = Math.max(this._yMaxRecent,   Math.max(...recentData));
    if (overviewData.length > 0) this._yMaxOverview = Math.max(this._yMaxOverview, Math.max(...overviewData));

    const gfx = this._gfx;
    const pW  = this._panelWidth();
    gfx.clear();

    this._drawPanel(gfx, 0,        pW, recentData,   this._yMaxRecent,   TRACE_TICKS,    this._yLabelsRecent);
    this._drawPanel(gfx, pW + GAP, pW, overviewData, this._yMaxOverview, OVERVIEW_TICKS, this._yLabelsOverview);
  }

  _drawPanel(gfx, x0, pW, data, yMax, totalTicks, yLabels) {
    const y0    = this._y;
    const drawW = pW - LABEL_W;
    const tickW = drawW / totalTicks;

    gfx.rect(x0, y0, pW, GRAPH_H + 4).fill({ color: C.bg });

    for (let i = 0; i <= Y_TICKS; i++) {
      const frac  = i / Y_TICKS;
      const lineY = y0 + GRAPH_H - frac * GRAPH_H + 2;
      gfx.moveTo(x0 + LABEL_W, lineY).lineTo(x0 + pW, lineY)
        .stroke({ color: C.border, width: 1, alpha: i === 0 ? 1 : 0.3 });

      const label = yLabels[i];
      label.text  = Math.round(frac * yMax).toString();
      label.x     = x0 + LABEL_W - 4;
      label.y     = lineY - 5;
    }

    if (data.length > 1) {
      const pts = [x0 + LABEL_W, y0 + GRAPH_H + 2];
      for (let i = 0; i < data.length; i++) {
        pts.push(x0 + LABEL_W + i * tickW, y0 + GRAPH_H - (data[i] / yMax) * GRAPH_H + 2);
      }
      pts.push(x0 + LABEL_W + (data.length - 1) * tickW, y0 + GRAPH_H + 2);
      gfx.poly(pts).fill({ color: C.green, alpha: 0.15 });

      for (let i = 1; i < data.length; i++) {
        const x1 = x0 + LABEL_W + (i - 1) * tickW;
        const x2 = x0 + LABEL_W + i * tickW;
        const y1 = y0 + GRAPH_H - (data[i - 1] / yMax) * GRAPH_H + 2;
        const y2 = y0 + GRAPH_H - (data[i]     / yMax) * GRAPH_H + 2;
        gfx.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: C.green, width: 1.5 });
      }
    }

    const nowX = x0 + LABEL_W + data.length * tickW;
    gfx.moveTo(nowX, y0 + 2).lineTo(nowX, y0 + GRAPH_H + 2)
      .stroke({ color: C.accent, width: 1, alpha: 0.3 });

    gfx.moveTo(x0 + LABEL_W, y0).lineTo(x0 + LABEL_W, y0 + GRAPH_H + 4)
      .stroke({ color: C.border, width: 1 });
  }

  get totalHeight() { return GRAPH_H + 24; }
}
