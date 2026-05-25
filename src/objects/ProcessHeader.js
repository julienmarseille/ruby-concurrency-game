import { Container, Graphics, Text } from 'pixi.js';
import { C, LAYERS, SPACING, TEXT_STYLES } from '../config.js';

const ROW_H = 36;

export class ProcessHeader extends Container {
  constructor(x, y, width, processId) {
    super();
    this.x      = x;
    this.y      = y;
    this.zIndex = LAYERS.PROCESS_HDR;

    this._line = new Graphics();
    this.addChild(this._line);

    this._label = new Text({ text: `Process ${processId}`, style: TEXT_STYLES.section });
    this._label.x = 0;
    this._label.y = (ROW_H - 13) / 2;
    this.addChild(this._label);

    this._draw(width);
  }

  get cardHeight() { return ROW_H; }

  update(width) { this._draw(width); }
  setWidth(w)   { this._draw(w); }

  _draw(w) {
    this._line.clear();
    const lineY    = ROW_H / 2;
    const labelEnd = this._label.width + SPACING.md;
    this._line
      .moveTo(labelEnd, lineY)
      .lineTo(w, lineY)
      .stroke({ color: C.border, width: 1, alpha: 0.4 });
  }
}
