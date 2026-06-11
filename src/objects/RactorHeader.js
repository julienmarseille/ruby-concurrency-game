import { Container, Graphics, Text } from 'pixi.js';
import { C, CH, LAYERS, SPACING, TEXT_STYLES } from '../config.js';

const RACTOR_TEAL   = 0x34d399;
const RACTOR_TEAL_S = '#34d399';

const ROW_H     = 28;
const BADGE_H   = 16;
const BADGE_PAD = SPACING.sm;
const LEFT_BAR  = 3;

export class RactorHeader extends Container {
  constructor(x, y, width, ractorId) {
    super();
    this.x         = x;
    this.y         = y;
    this.zIndex    = LAYERS.RACTOR_HDR;
    this._ractorId = ractorId;
    this._w        = width;

    this._bg = new Graphics();
    this.addChild(this._bg);

    this._label = new Text({
      text:  `⚗️ Ractor ${ractorId}`,
      style: { ...TEXT_STYLES.body, fill: RACTOR_TEAL_S, fontWeight: 'bold' },
    });
    this._label.x = LEFT_BAR + SPACING.sm;
    this._label.y = (ROW_H - 10) / 2;
    this.addChild(this._label);

    this._badgeBg   = new Graphics();
    this._badgeText = new Text({ text: '', style: { ...TEXT_STYLES.label } });
    this.addChild(this._badgeBg);
    this.addChild(this._badgeText);

    this._lastState = undefined;
    this._draw(null);
  }

  get cardHeight() { return ROW_H; }

  setWidth(w) {
    if (w === this._w) return;
    this._w = w;
    this._draw(this._lastState);
  }

  update(thread) {
    if (!thread) return;
    const state = thread.status === 'cpu' ? 'cpu'
                : thread.status === 'io'  ? 'io'
                : null;
    if (state === this._lastState) return;
    this._lastState = state;
    this._draw(state);
  }

  _draw(state) {
    this._bg.clear();
    this._bg.rect(0, 0, LEFT_BAR, ROW_H).fill({ color: RACTOR_TEAL, alpha: 0.9 });
    this._bg.rect(LEFT_BAR, 0, this._w - LEFT_BAR, ROW_H).fill({ color: RACTOR_TEAL, alpha: 0.05 });

    this._badgeBg.clear();
    this._badgeText.text = '';

    if (state) {
      const { label, color, textColor } = state === 'cpu'
        ? { label: 'CPU', color: C.cpu, textColor: CH.cpu }
        : { label: 'I/O', color: C.io,  textColor: CH.io  };

      const badgeW = label.length * 6 + BADGE_PAD * 2;
      const badgeX = this._w - badgeW - SPACING.sm;
      const badgeY = (ROW_H - BADGE_H) / 2;

      this._badgeBg
        .roundRect(badgeX, badgeY, badgeW, BADGE_H, SPACING.xs)
        .fill({ color, alpha: 0.15 })
        .roundRect(badgeX, badgeY, badgeW, BADGE_H, SPACING.xs)
        .stroke({ color, width: 1, alpha: 0.5 });

      this._badgeText.text       = label;
      this._badgeText.style.fill = textColor;
      this._badgeText.x          = badgeX + BADGE_PAD;
      this._badgeText.y          = (ROW_H - 9) / 2;
    }
  }
}
