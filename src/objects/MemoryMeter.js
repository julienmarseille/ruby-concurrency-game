import { Graphics, Text } from 'pixi.js';
import { C, CH, LAYERS, PAD, TEXT_STYLES } from '../config.js';

export class MemoryMeter {
  constructor(stage) {
    this._bg   = new Graphics();
    this._fill = new Graphics();
    this._text = new Text({ text: '', style: TEXT_STYLES.body });
    this._bg.zIndex   = LAYERS.MEMORY_METER;
    this._fill.zIndex = LAYERS.MEMORY_METER;
    this._text.zIndex = LAYERS.MEMORY_TEXT;
    stage.addChild(this._bg);
    stage.addChild(this._fill);
    stage.addChild(this._text);
  }

  draw(y, width, pct, memUsed, memMax) {
    const mW = width - PAD * 2;

    this._bg.clear();
    this._bg.rect(PAD, y, mW, 7).fill({ color: C.surface });

    this._fill.clear();
    const fc = pct > 0.8 ? C.danger : pct > 0.6 ? C.cpu : C.green;
    this._fill.rect(PAD, y, Math.max(4, mW * pct), 7).fill({ color: fc });

    this._text.text = `Memory  ${memUsed} / ${memMax} MB`;
    this._text.x = PAD;
    this._text.y = y - 14;
  }

  setVisible(v) {
    this._bg.visible   = v;
    this._fill.visible = v;
    this._text.visible = v;
  }

  destroy() {
    this._bg.destroy();
    this._fill.destroy();
    this._text.destroy();
  }
}
