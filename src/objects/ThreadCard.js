import { Container, Graphics, Text } from 'pixi.js';
import { C, LAYERS, TICK_MS } from '../config.js';

const CARD_H = 80;
const PAD    = 14;
const BAR_Y  = 44;
const BAR_H  = 20;

const STATUS_COLORS = {
  idle:     { border: C.border,  badge: 0x21262d, badgeText: '#484f58', label: 'idle'     },
  incoming: { border: C.green,   badge: 0x0a2a0d, badgeText: '#3fb950', label: 'incoming' },
  cpu:      { border: C.cpu,     badge: 0x3d2a00, badgeText: '#f0a500', label: 'CPU'      },
  io:       { border: C.io,      badge: 0x0a2540, badgeText: '#58b4ff', label: 'I/O'      },
  gvl_wait: { border: C.gvlWait, badge: 0x200d4a, badgeText: '#b490f5', label: 'GVL wait' },
};

const PHASE_COLORS = { cpu: C.cpu, io: C.io };

export class ThreadCard extends Container {
  constructor(x, y, width, thread) {
    super();
    this.x       = x;
    this.y       = y;
    this.zIndex  = LAYERS.CARDS;
    this._thread = thread;
    this._w      = width;
    this._particleArrivalAt = 0;

    this._bg = new Graphics();
    this.addChild(this._bg);

    this._nameText = new Text({ text: thread.label, style: {
      fontFamily: 'Courier New', fontSize: 13, fill: '#e6edf3', fontWeight: 'bold',
    }});
    this._nameText.x = PAD; this._nameText.y = 12;
    this.addChild(this._nameText);

    this._badgeBg   = new Graphics();
    this._badgeText = new Text({ text: '', style: { fontFamily: 'Courier New', fontSize: 10, fill: '#8b949e' }});
    this.addChild(this._badgeBg);
    this.addChild(this._badgeText);

    this._progBg   = new Graphics();
    this._progFill = new Graphics();
    this.addChild(this._progBg);
    this.addChild(this._progFill);

    this._gvlMask    = new Graphics();
    this._gvlOverlay = new Graphics();
    this._gvlOverlay.mask = this._gvlMask;
    this.addChild(this._gvlMask);
    this.addChild(this._gvlOverlay);

    this._lastStatus = null;
    this._lastGvlW   = 0;
  }

  get threadId()   { return this._thread.id; }
  get cardHeight() { return CARD_H; }

  setWidth(w) { this._w = w; }

  setIncoming(arrivalAt) {
    this._particleArrivalAt = arrivalAt;
  }

  update(now) {
    const t   = this._thread;
    const req = t.request;
    const def = req?.def;

    const isIncoming    = req && this._particleArrivalAt > 0 && now < this._particleArrivalAt;
    const displayStatus = isIncoming ? 'incoming' : t.status;

    if (this._particleArrivalAt > 0 && now >= this._particleArrivalAt) {
      this._particleArrivalAt = 0;
    }

    const sc         = STATUS_COLORS[displayStatus] ?? STATUS_COLORS.idle;
    const W          = this._w;
    const prevStatus = this._lastStatus;

    this.alpha = displayStatus === 'idle' ? 0.4 : 1.0;

    if (displayStatus !== prevStatus) {
      this._lastStatus = displayStatus;

      this._bg.clear();
      this._bg.roundRect(0, 0, W, CARD_H, 8)
        .fill({ color: C.card })
        .stroke({ color: C.border, width: 1 });

      const badgeW = sc.label.length * 6.2 + 14;
      const badgeX = W - PAD - badgeW;
      this._badgeBg.clear();
      this._badgeBg.roundRect(badgeX, 10, badgeW, 18, 9).fill({ color: sc.badge });
      this._badgeText.text       = sc.label;
      this._badgeText.style.fill = sc.badgeText;
      this._badgeText.x = badgeX + 7; this._badgeText.y = 12;
    }

    const isGvlWait = displayStatus === 'gvl_wait';
    if (isGvlWait !== (prevStatus === 'gvl_wait') || (isGvlWait && W !== this._lastGvlW)) {
      this._lastGvlW = W;
      this._gvlOverlay.clear();
      this._gvlMask.clear();
      if (isGvlWait) {
        this._gvlMask.roundRect(0, 0, W, CARD_H, 8).fill(0xffffff);
        const step = 16;
        const sw   = 8;
        for (let x = -sw; x < W + CARD_H + sw; x += step) {
          this._gvlOverlay.moveTo(x, -sw).lineTo(x - CARD_H - sw, CARD_H + sw)
            .stroke({ width: sw, color: C.gvlWait, alpha: 0.45 });
        }
      }
    }

    this._progBg.clear();
    this._progFill.clear();

    if (!isIncoming && def) {
      this._drawLifecycleBar(t, def, now, W);
    }
  }

  destroy() {
    this._gvlMask.destroy(true);
    this._gvlOverlay.destroy(true);
    super.destroy({ children: true });
  }

  _drawLifecycleBar(t, def, now, W) {
    const progW   = W - PAD * 2;
    const totalMs = def.phases.reduce((s, p) => s + p.ms, 0);

    let segX = 0;
    for (const p of def.phases) {
      const segW = (p.ms / totalMs) * progW;
      this._progBg.rect(PAD + segX, BAR_Y, segW, BAR_H)
        .fill({ color: PHASE_COLORS[p.type], alpha: 0.18 });
      segX += segW;
    }

    segX = 0;
    for (let i = 0; i < def.phases.length - 1; i++) {
      segX += (def.phases[i].ms / totalMs) * progW;
      this._progBg.rect(PAD + segX, BAR_Y, 2, BAR_H).fill({ color: 0x0d1117 });
    }

    this._progBg.roundRect(PAD, BAR_Y, progW, BAR_H, 4)
      .stroke({ color: 0x30363d, width: 1 });

    let totalElapsed = 0;
    for (let i = 0; i < t.phaseIdx; i++) totalElapsed += def.phases[i].ms;

    let curElapsed = t.phaseElapsed;
    if ((t.status === 'cpu' || t.status === 'io') && t.phaseRunWall) {
      curElapsed += Math.min(TICK_MS, now - t.phaseRunWall);
    }
    totalElapsed += curElapsed;

    let remaining = totalElapsed;
    segX = 0;
    for (const p of def.phases) {
      if (remaining <= 0) break;
      const segW      = (p.ms / totalMs) * progW;
      const fillW     = Math.min(segW, (remaining / p.ms) * segW);
      const isCurrent = remaining < p.ms;
      const fillColor = (t.status === 'gvl_wait' && isCurrent) ? C.gvlWait : PHASE_COLORS[p.type];

      this._progFill.rect(PAD + segX, BAR_Y + 2, fillW, BAR_H - 4).fill({ color: fillColor });

      remaining -= p.ms;
      segX += segW;
    }

    const cursorX   = PAD + Math.min(progW - 1, (totalElapsed / totalMs) * progW);
    const cursorCol = t.status === 'gvl_wait' ? C.gvlWait : 0xffffff;
    this._progFill.rect(cursorX - 1, BAR_Y + 1, 2, BAR_H - 2).fill({ color: cursorCol, alpha: 0.9 });
  }
}
