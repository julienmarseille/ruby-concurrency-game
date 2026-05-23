import { Graphics, Text, Container } from 'pixi.js';
import { C, CH, LAYERS, PAD, TRACE_TICKS, GRAPH_LABEL_W, THROUGHPUT_H } from '../config.js';

const LABEL_W = GRAPH_LABEL_W;
const GRAPH_H = THROUGHPUT_H;

export class ThroughputGraph {
  constructor(stage, x, y, width) {
    this._stage   = stage;
    this._x       = x;
    this._y       = y;
    this._width   = width;
    this._visible = true;
    this._yMax    = 0.5; // req/s — sticky, only grows

    this._gfx = new Graphics();
    this._gfx.zIndex = LAYERS.TRACE;
    stage.addChild(this._gfx);

    this._metaContainer = new Container();
    this._metaContainer.zIndex = LAYERS.TRACE_META;
    stage.addChild(this._metaContainer);

    this._titleText = new Text({ text: 'THROUGHPUT (req / min)', style: {
      fontFamily: 'Courier New', fontSize: 9, fill: CH.textDim,
    }});
    this._metaContainer.addChild(this._titleText);

    this._positionMeta();
  }

  setY(y)     { this._y = y; this._positionMeta(); }
  setWidth(w) { this._width = w; this._positionMeta(); }

  _positionMeta() {
    this._titleText.x = PAD;
    this._titleText.y = this._y - 14;
  }

  draw(smoothed) {
    if (smoothed.length > 0) {
      this._yMax = Math.max(this._yMax, Math.max(...smoothed));
    }

    const gfx   = this._gfx;
    const W     = this._width;
    const drawW = W - LABEL_W - PAD;
    const x0    = this._x;
    const y0    = this._y;
    const tickW = drawW / TRACE_TICKS;

    gfx.clear();
    gfx.rect(x0, y0, W - PAD, GRAPH_H + 4).fill({ color: C.bg });

    if (smoothed.length > 1) {
      const pts = [x0 + LABEL_W, y0 + GRAPH_H + 2];
      for (let i = 0; i < smoothed.length; i++) {
        pts.push(
          x0 + LABEL_W + i * tickW,
          y0 + GRAPH_H - (smoothed[i] / this._yMax) * GRAPH_H + 2,
        );
      }
      pts.push(x0 + LABEL_W + (smoothed.length - 1) * tickW, y0 + GRAPH_H + 2);
      gfx.poly(pts).fill({ color: C.green, alpha: 0.15 });

      for (let i = 1; i < smoothed.length; i++) {
        const x1 = x0 + LABEL_W + (i - 1) * tickW;
        const x2 = x0 + LABEL_W + i * tickW;
        const y1 = y0 + GRAPH_H - (smoothed[i - 1] / this._yMax) * GRAPH_H + 2;
        const y2 = y0 + GRAPH_H - (smoothed[i]     / this._yMax) * GRAPH_H + 2;
        gfx.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: C.green, width: 1.5 });
      }
    }

    const nowX = x0 + LABEL_W + smoothed.length * tickW;
    gfx.moveTo(nowX, y0 + 2).lineTo(nowX, y0 + GRAPH_H + 2)
      .stroke({ color: C.accent, width: 1, alpha: 0.3 });

    gfx.moveTo(x0 + LABEL_W, y0).lineTo(x0 + LABEL_W, y0 + GRAPH_H + 4)
      .stroke({ color: C.border, width: 1 });

  }

  setVisible(v) {
    this._visible               = v;
    this._gfx.visible           = v;
    this._metaContainer.visible = v;
  }

  destroy() {
    this._gfx.destroy();
    this._metaContainer.destroy({ children: true });
  }

  get totalHeight() { return GRAPH_H + 24; }
}
