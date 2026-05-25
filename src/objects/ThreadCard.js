import { Container, Graphics, Text } from 'pixi.js';
import { C, LAYERS, SPACING, TEXT_STYLES, TICK_MS } from '../config.js';

const CARD_H = 52;
const CARD_PAD = SPACING.md;
const NAME_W = 80;
const BAR_H  = 18;
const BAR_Y  = (CARD_H - BAR_H) / 2;

const STATUS_COLORS = {
  idle:     { border: C.border,  badge: 0x21262d, text: '#8b949e', label: 'idle'     },
  cpu:      { border: C.cpu,     badge: 0x3a2800, text: '#d29922', label: 'CPU'      },
  io:       { border: C.io,      badge: 0x0a2540, text: '#4299e1', label: 'I/O'      },
  gvl_wait: { border: C.gvlWait, badge: 0x1e1040, text: '#8957e5', label: 'GVL wait' },
};

const PHASE_COLORS = { cpu: C.cpu, io: C.io };

export class ThreadCard extends Container {
  constructor(x, y, width, thread) {
    super();
    this.x       = x;
    this.y       = y;
    this.zIndex  = LAYERS.CARDS;
    this._thread            = thread;
    this._w                 = width;
    this._particleArrivalAt = 0;

    this._bg = new Graphics();
    this.addChild(this._bg);

    this._nameText = new Text({ text: thread.label, style: TEXT_STYLES.threadName });
    this._nameText.x = CARD_PAD;
    this._nameText.y = (CARD_H - 11) / 2;
    this.addChild(this._nameText);

    this._badgeBg   = new Graphics();
    this._badgeText = new Text({ text: '', style: { ...TEXT_STYLES.bodyDim } });
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
    this._lastW      = 0;
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
    const displayStatus = (isIncoming || t.status === 'incoming') ? 'idle' : t.status;

    if (this._particleArrivalAt > 0 && now >= this._particleArrivalAt) {
      this._particleArrivalAt = 0;
    }

    const sc = STATUS_COLORS[displayStatus] ?? STATUS_COLORS.idle;
    const W          = this._w;
    const prevStatus = this._lastStatus;

    this.alpha = displayStatus === 'idle' ? 0.35 : 1.0;

    if (displayStatus !== prevStatus || W !== this._lastW) {
      this._lastStatus = displayStatus;
      this._lastW      = W;

      this._bg.clear();
      this._bg.roundRect(0, 0, W, CARD_H, SPACING.sm)
        .fill({ color: C.card })
        .stroke({ color: sc.border, width: 1 });

      const badgeW = sc.label.length * 6.2 + SPACING.lg;
      const badgeX = W - CARD_PAD - badgeW;
      this._badgeBg.clear();
      this._badgeBg.roundRect(badgeX, (CARD_H - 18) / 2, badgeW, 18, SPACING.xs).fill({ color: sc.badge });
      this._badgeText.text       = sc.label;
      this._badgeText.style.fill = sc.text;
      this._badgeText.x          = badgeX + SPACING.sm;
      this._badgeText.y          = (CARD_H - 10) / 2;
    }

    const isGvlWait = displayStatus === 'gvl_wait';
    if (isGvlWait !== (prevStatus === 'gvl_wait') || (isGvlWait && W !== this._lastGvlW)) {
      this._lastGvlW = W;
      this._gvlOverlay.clear();
      this._gvlMask.clear();
      if (isGvlWait) {
        this._gvlMask.roundRect(0, 0, W, CARD_H, SPACING.sm).fill(0xffffff);
        const step = SPACING.lg;
        const sw   = SPACING.sm;
        for (let x = -sw; x < W + CARD_H + sw; x += step) {
          this._gvlOverlay.moveTo(x, -sw).lineTo(x - CARD_H - sw, CARD_H + sw)
            .stroke({ width: sw, color: C.gvlWait, alpha: 0.45 });
        }
      }
    }

    this._progBg.clear();
    this._progFill.clear();

    if (!isIncoming && def) {
      const badgeW = sc.label.length * 6.2 + SPACING.lg;
      this._drawLifecycleBar(t, def, now, W, badgeW);
    }
  }

  destroy() {
    this._gvlMask.destroy(true);
    this._gvlOverlay.destroy(true);
    super.destroy({ children: true });
  }

  _drawLifecycleBar(t, def, now, W, badgeW) {
    const barX   = CARD_PAD + NAME_W;
    const barEnd = W - CARD_PAD - badgeW - SPACING.sm;
    const progW  = barEnd - barX;
    if (progW <= 0) return;

    const totalMs = def.phases.reduce((s, p) => s + p.ms, 0);

    let segX = 0;
    for (const p of def.phases) {
      const segW = (p.ms / totalMs) * progW;
      this._progBg.rect(barX + segX, BAR_Y, segW, BAR_H)
        .fill({ color: PHASE_COLORS[p.type], alpha: 0.15 });
      segX += segW;
    }

    segX = 0;
    for (let i = 0; i < def.phases.length - 1; i++) {
      segX += (def.phases[i].ms / totalMs) * progW;
      this._progBg.rect(barX + segX, BAR_Y, 1, BAR_H).fill({ color: C.bg });
    }

    this._progBg.roundRect(barX, BAR_Y, progW, BAR_H, SPACING.xs)
      .stroke({ color: C.border, width: 1 });

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
      this._progFill.rect(barX + segX, BAR_Y + 2, fillW, BAR_H - 4).fill({ color: fillColor });
      remaining -= p.ms;
      segX += segW;
    }

    const cursorX   = barX + Math.min(progW - 1, (totalElapsed / totalMs) * progW);
    const cursorCol = t.status === 'gvl_wait' ? C.gvlWait : 0xffffff;
    this._progFill.rect(cursorX - 1, BAR_Y + 2, 2, BAR_H - 4).fill({ color: cursorCol, alpha: 0.8 });
  }
}
