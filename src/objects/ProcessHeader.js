import { Container, Graphics, Text } from 'pixi.js';
import { C, CH, LAYERS, SPACING, TEXT_STYLES } from '../config.js';

const ROW_H     = 36;
const BADGE_H   = 18;
const BADGE_PAD = SPACING.sm;

export class ProcessHeader extends Container {
  constructor(x, y, width, processId) {
    super();
    this.x          = x;
    this.y          = y;
    this.zIndex     = LAYERS.PROCESS_HDR;
    this._processId = processId;
    this._w         = width;

    this._line = new Graphics();
    this.addChild(this._line);

    this._label = new Text({ text: `Process ${processId}`, style: TEXT_STYLES.section });
    this._label.x = 0;
    this._label.y = (ROW_H - 13) / 2;
    this.addChild(this._label);

    this._badgeBg   = new Graphics();
    this._badgeText = new Text({ text: '', style: { ...TEXT_STYLES.bodyDim, fontSize: 9 } });
    this.addChild(this._badgeBg);
    this.addChild(this._badgeText);

    this._hasContention = undefined;
    this._draw(null);
  }

  get cardHeight() { return ROW_H; }

  setWidth(w) { this._w = w; this._draw(this._hasContention); }

  update(threads, showBadge) {
    if (this._hasContention === undefined) this._draw();
  }

  _draw() {
    this._badgeBg.clear();
    this._badgeText.text = '';
    this._hasContention  = null;

    this._line.clear();
    const lineY    = ROW_H / 2;
    const labelEnd = this._label.width + SPACING.md;
    this._line
      .moveTo(labelEnd, lineY)
      .lineTo(this._w, lineY)
      .stroke({ color: C.border, width: 1, alpha: 0.4 });
  }
}
