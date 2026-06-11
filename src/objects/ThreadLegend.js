import { Container, Graphics, Text } from 'pixi.js';
import { C, CH, LAYERS, SPACING, TEXT_STYLES } from '../config.js';

const RACTOR_TEAL = 0x34d399;
const DOT_R       = 5;
const ROW_H       = 20;

const BASE_ITEMS = [
  { color: C.cpu,     label: 'CPU'      },
  { color: C.io,      label: 'I/O'      },
  { color: C.gvlWait, label: 'GVL wait' },
];

export class ThreadLegend extends Container {
  constructor(x, y) {
    super();
    this.x      = x;
    this.y      = y;
    this.zIndex = LAYERS.PROCESS_HDR;

    this._items   = [];
    this._ractors = false;
    this._build();
  }

  get cardHeight() { return ROW_H; }

  setWidth() {}

  setRactorsEnabled(enabled) {
    if (this._ractors === enabled) return;
    this._ractors = enabled;
    this._build();
  }

  _build() {
    this.removeChildren();
    this._items = [];

    const items = this._ractors
      ? [...BASE_ITEMS, { color: RACTOR_TEAL, label: 'Ractors' }]
      : BASE_ITEMS;

    let x = 0;
    for (const { color, label } of items) {
      const dot = new Graphics();
      dot.circle(DOT_R, ROW_H / 2, DOT_R).fill({ color });
      dot.x = x;
      this.addChild(dot);

      const txt = new Text({ text: label, style: { ...TEXT_STYLES.label, fill: CH.textDim } });
      txt.x = x + DOT_R * 2 + SPACING.xs;
      txt.y = (ROW_H - txt.height) / 2;
      this.addChild(txt);

      x += DOT_R * 2 + SPACING.xs + txt.width + SPACING.lg;
      this._items.push({ dot, txt });
    }
  }
}
