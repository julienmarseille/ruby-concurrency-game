import { Container, Graphics, Text } from 'pixi.js';
import { C, LAYERS } from '../config.js';

const BADGE_H        = 20;
const TOP_OFFSET     = BADGE_H / 2;
export const MIN_GROUP_SPAN = 80;

export class ProcessHeader extends Container {
  constructor(x, y, width, processId) {
    super();
    this.x      = x;
    this.y      = y;
    this.zIndex = LAYERS.CARDS - 1;

    this._border = new Graphics();
    this.addChild(this._border);

    const badgeBg = new Graphics();
    badgeBg.roundRect(0, 0, 96, BADGE_H, 4)
      .fill({ color: C.surface })
      .stroke({ color: C.border, width: 1 });

    const label = new Text({ text: `Process ${processId}`, style: {
      fontFamily: 'Courier New', fontSize: 10, fill: '#8b949e',
    }});
    label.resolution = 2;
    label.x = 10;
    label.y = (BADGE_H - 12) / 2;

    const badge = new Container();
    badge.addChild(badgeBg, label);
    badge.x = 14;
    badge.y = 0;
    this.addChild(badge);
  }

  get cardHeight() { return TOP_OFFSET + 18; }

  update(width, totalSpan) {
    const h = Math.max(MIN_GROUP_SPAN, totalSpan) - TOP_OFFSET;
    this._border.clear();
    this._border
      .roundRect(0, TOP_OFFSET, width, h, 8)
      .fill({ color: C.surface, alpha: 0.25 })
      .stroke({ color: C.border, width: 1 });
  }

  setWidth(w) {}
}
