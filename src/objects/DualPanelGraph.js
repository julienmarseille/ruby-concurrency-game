import { Graphics, Text, Container } from 'pixi.js';
import { C, LAYERS, PAD, TEXT_STYLES, SPACING } from '../config.js';

const GAP = SPACING.sm;

export class DualPanelGraph {
  constructor(x, y, width) {
    this._x      = x;
    this._y      = y;
    this._width  = width;

    this._gfx = new Graphics();
    this._gfx.zIndex = LAYERS.TRACE;

    this._meta = new Container();
    this._meta.zIndex = LAYERS.TRACE_META;
  }

  addTo(parent) {
    parent.addChild(this._gfx);
    parent.addChild(this._meta);
  }

  setY(y)     { this._y = y; this._positionMeta(); }
  setWidth(w) { this._width = w; this._positionMeta(); }

  setVisible(v) {
    this._gfx.visible  = v;
    this._meta.visible = v;
  }

  destroy() {
    this._gfx.destroy();
    this._meta.destroy({ children: true });
  }

  _panelWidth() { return Math.floor((this._width - 2 * PAD - GAP) / 2); }

  _createLabel(text) {
    const t = new Text({ text, style: TEXT_STYLES.body });
    this._meta.addChild(t);
    return t;
  }

  _createYLabels(count) {
    return Array.from({ length: count + 1 }, () => {
      const t = new Text({ text: '', style: TEXT_STYLES.label });
      t.anchor.x = 1;
      this._meta.addChild(t);
      return t;
    });
  }

  _positionTitles() {
    const pW = this._panelWidth();
    this._titleRecent.x   = PAD;
    this._titleRecent.y   = this._y - 20;
    this._titleOverview.x = pW + GAP + PAD;
    this._titleOverview.y = this._y - 20;
  }

  _positionMeta() {
    this._positionTitles();
  }

  get totalHeight() { throw new Error('Implement totalHeight in subclass'); }
}
