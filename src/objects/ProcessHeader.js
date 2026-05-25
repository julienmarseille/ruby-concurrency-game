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
    const active = threads.filter(t => t.processId === this._processId && t.request !== null);

    let state = null;
    if (showBadge) {
      if      (active.some(t => t.status === 'gvl_wait')) state = 'gvl_wait';
      else if (active.some(t => t.status === 'cpu'))      state = 'cpu';
      else if (active.length > 0)                         state = 'io';
    }

    if (state === this._hasContention) return;
    this._hasContention = state;
    this._draw(state);
  }

  _draw(state) {
    this._badgeBg.clear();
    this._badgeText.text = '';

    let lineEnd = this._w;

    if (state) {
      const { label, color, textColor } = {
        io:       { label: 'I/O',      color: C.io,      textColor: CH.io           },
        cpu:      { label: 'CPU',      color: C.cpu,     textColor: CH.cpu          },
        gvl_wait: { label: 'GVL wait', color: C.gvlWait, textColor: CH.gvlWaitLight },
      }[state];

      const badgeW = label.length * 6 + BADGE_PAD * 2;
      const badgeX = this._w - badgeW;
      const badgeY = (ROW_H - BADGE_H) / 2;

      this._badgeBg
        .roundRect(badgeX, badgeY, badgeW, BADGE_H, SPACING.xs)
        .fill({ color, alpha: 0.12 })
        .roundRect(badgeX, badgeY, badgeW, BADGE_H, SPACING.xs)
        .stroke({ color, width: 1, alpha: 0.5 });

      this._badgeText.text       = label;
      this._badgeText.style.fill = textColor;
      this._badgeText.x          = badgeX + BADGE_PAD;
      this._badgeText.y          = (ROW_H - 9) / 2;

      lineEnd = badgeX - SPACING.sm;
    }

    this._line.clear();
    const lineY    = ROW_H / 2;
    const labelEnd = this._label.width + SPACING.md;
    this._line
      .moveTo(labelEnd, lineY)
      .lineTo(lineEnd, lineY)
      .stroke({ color: C.border, width: 1, alpha: 0.4 });
  }
}
