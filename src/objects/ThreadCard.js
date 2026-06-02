import { Container, Graphics, Text } from 'pixi.js';
import { C, CH, LAYERS, SPACING, TEXT_STYLES, TICK_MS } from '../config.js';

const CARD_H   = 52;
const CARD_PAD = SPACING.md;
const NAME_W   = 80;
const BAR_H    = 18;
const BAR_Y    = (CARD_H - BAR_H) / 2;

const FIBER_ROW_H     = 12;
const FIBER_GAP       = 6;
const SECTION_H       = FIBER_ROW_H + FIBER_GAP;      // 18px per row
const ACTIVE_MAX_ROWS = 10;
const READY_MAX_ROWS  = 5;
const ACTIVE_ZONE_H   = ACTIVE_MAX_ROWS * SECTION_H;  // 180px
const DIVIDER_ROW_H   = 20;
const READY_ZONE_H    = READY_MAX_ROWS  * SECTION_H;  // 90px
const FIXED_CARD_H    = CARD_H + ACTIVE_ZONE_H + DIVIDER_ROW_H + READY_ZONE_H; // 342px
const TRANSITION_MS   = 250;

const STATUS_COLORS = {
  idle:       { border: C.border,  badge: C.surface,       text: CH.textDim,      label: 'idle'     },
  fiber_host: { border: C.border,  badge: C.surface,       text: CH.textDim,      label: 'fibers'   },
  cpu:        { border: C.cpu,     badge: C.cardCpuBadge,  text: CH.cpu,          label: 'CPU'      },
  io:         { border: C.io,      badge: C.cardIoBadge,   text: CH.io,           label: 'I/O'      },
  gvl_wait:   { border: C.gvlWait, badge: C.cardGvlBadge,  text: CH.gvlWaitLight, label: 'GVL wait' },
};

const FIBER_STATUS_COLORS = {
  cpu:      { border: C.cpu,    fill: C.cpu,    label: 'CPU'   },
  io:       { border: C.io,     fill: C.io,     label: 'I/O'   },
  queued:   { border: C.accent, fill: C.accent, label: 'ready' },
  incoming: { border: C.border, fill: C.surface, label: ''     },
  idle:     { border: C.border, fill: C.surface, label: ''     },
};

const PHASE_COLORS = { cpu: C.cpu, io: C.io };

export class ThreadCard extends Container {
  constructor(x, y, width, thread) {
    super();
    this.x      = x;
    this.y      = y;
    this.zIndex = LAYERS.CARDS;
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

    // Active fibers section
    this._activeGfx = new Graphics();
    this.addChild(this._activeGfx);

    // Ready queue section
    this._readyGfx = new Graphics();
    this.addChild(this._readyGfx);

    // Divider row + label — added AFTER sections so it renders on top
    this._dividerGfx = new Graphics();
    this._readyLabel = new Text({
      text:  '',
      style: { fontFamily: 'Courier New', fontSize: 9, fill: CH.text },
    });
    this.addChild(this._dividerGfx);
    this.addChild(this._readyLabel);

    // Transition tracking: fiberId → { startedAt, fiber, lastReadyY }
    this._transitions      = new Map();
    this._prevStartedIds   = new Set();
    this._prevReadyIndices = new Map(); // fiberId → index in ready array (previous frame)

    // Ready queue slide animations: fiberId → { fromY, toY, startedAt }
    this._readySlides = new Map();
    this._prevReadyY  = new Map(); // fiberId → y0 from previous frame

    this._lastStatus = null;
    this._lastW      = 0;
    this._lastGvlW   = 0;
  }

  get threadId()  { return this._thread.id; }
  get processId() { return this._thread.processId; }

  get cardHeight() {
    if (this._thread.fiberHost) return FIXED_CARD_H;
    return CARD_H;
  }

  get pipeTargetY() {
    if (this._thread.fiberHost) {
      const readyTop = this.y + CARD_H + ACTIVE_ZONE_H + DIVIDER_ROW_H;
      return readyTop + SECTION_H / 2;
    }
    return this.y + CARD_H / 2;
  }

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

    const effectiveStatus = (displayStatus === 'idle' && t.fiberHost) ? 'fiber_host' : displayStatus;
    const sc              = STATUS_COLORS[effectiveStatus] ?? STATUS_COLORS.idle;
    const W               = this._w;
    const prevStatus      = this._lastStatus;

    this.alpha = t.fiberHost ? 1.0 : (displayStatus === 'idle' ? 0.35 : 1.0);

    const totalH = this.cardHeight;

    if (effectiveStatus !== prevStatus || W !== this._lastW) {
      this._lastStatus = effectiveStatus;
      this._lastW      = W;

      this._bg.clear();
      this._bg.roundRect(0, 0, W, totalH, SPACING.sm)
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

    if (t.fiberHost) {
      this._updateTransitions(now);
      this._drawFiberSections(now);
    }
  }

  onFiberCountChanged(cb) {
    this._onFiberCountChanged = cb;
  }

  destroy() {
    this._gvlMask.destroy(true);
    this._gvlOverlay.destroy(true);
    super.destroy({ children: true });
  }

  _updateTransitions(now) {
    const t = this._thread;
    const currentStartedIds = new Set(
      t.extraFibers
        .filter(f => f.phaseIdx > 0 || f.phaseElapsed > 0)
        .map(f => f.id)
    );
    const currentReady = t.extraFibers.filter(f => f.phaseIdx === 0 && f.phaseElapsed === 0);

    for (const id of currentStartedIds) {
      if (!this._prevStartedIds.has(id)) {
        const fiber        = t.extraFibers.find(f => f.id === id);
        const prevIdx      = this._prevReadyIndices.get(id) ?? 0;
        const readySectionY = CARD_H + ACTIVE_ZONE_H + DIVIDER_ROW_H;
        const lastReadyY   = readySectionY + FIBER_GAP + prevIdx * SECTION_H;
        if (fiber) this._transitions.set(id, { startedAt: now, fiber, lastReadyY });
      }
    }

    for (const [id, tr] of this._transitions) {
      if (now - tr.startedAt >= TRANSITION_MS) this._transitions.delete(id);
    }

    this._prevStartedIds   = currentStartedIds;
    this._prevReadyIndices = new Map(currentReady.map((f, i) => [f.id, i]));
  }

  _drawFiberSections(now) {
    const t      = this._thread;
    const W      = this._w;
    const active = t.extraFibers.filter(f => f.phaseIdx > 0 || f.phaseElapsed > 0);
    const ready  = t.extraFibers.filter(f => f.phaseIdx === 0 && f.phaseElapsed === 0);

    this._updateReadySlides(now, ready);
    this._drawActiveSection(active, W, now);
    this._drawDivider(ready.length, W);
    this._drawReadySection(ready, W, now);
  }

  _updateReadySlides(now, ready) {
    const sectionY = CARD_H + ACTIVE_ZONE_H + DIVIDER_ROW_H;

    for (let i = 0; i < ready.length; i++) {
      const fiber   = ready[i];
      const targetY = sectionY + FIBER_GAP + i * SECTION_H;
      const prevY   = this._prevReadyY.get(fiber.id);
      if (prevY !== undefined && prevY !== targetY && !this._readySlides.has(fiber.id)) {
        this._readySlides.set(fiber.id, { fromY: prevY, toY: targetY, startedAt: now });
      }
    }

    for (const [id, slide] of this._readySlides) {
      if (now - slide.startedAt >= TRANSITION_MS) this._readySlides.delete(id);
    }

    this._prevReadyY = new Map(ready.map((f, i) => [f.id, sectionY + FIBER_GAP + i * SECTION_H]));
  }

  _drawActiveSection(active, W, now) {
    const sectionY  = CARD_H;
    const sectionB  = sectionY + ACTIVE_ZONE_H;

    this._activeGfx.clear();

    for (let i = 0; i < active.length; i++) {
      const fiber  = active[i];
      const baseY  = sectionY + FIBER_GAP + i * SECTION_H;
      if (baseY >= sectionB) break;

      const tr     = this._transitions.get(fiber.id);
      const prog   = tr ? Math.min(1, (now - tr.startedAt) / TRANSITION_MS) : 1;
      const tAlpha = tr ? prog : 1;
      const yOff   = tr ? SECTION_H * (1 - prog) : 0;
      const y0     = baseY + yOff;

      if (y0 + FIBER_ROW_H <= sectionY || y0 >= sectionB) continue;
      this._drawFiberRow(this._activeGfx, fiber, y0, W, tAlpha, now);
    }
  }

  _drawDivider(readyCount, W) {
    const dividerY  = CARD_H + ACTIVE_ZONE_H;
    const labelText = `Ready queue  ${readyCount}`;
    const labelY    = dividerY + (DIVIDER_ROW_H - 9) / 2;

    this._readyLabel.text = labelText;
    this._readyLabel.x    = CARD_PAD;
    this._readyLabel.y    = labelY;

    const lineX = CARD_PAD + this._readyLabel.width + SPACING.sm;
    this._dividerGfx.clear();
    this._dividerGfx
      .rect(lineX, dividerY + DIVIDER_ROW_H / 2, W - CARD_PAD - lineX, 1)
      .fill({ color: C.border, alpha: 0.6 });
  }

  _drawReadySection(ready, W, now) {
    const sectionY = CARD_H + ACTIVE_ZONE_H + DIVIDER_ROW_H;
    const sectionB = sectionY + READY_ZONE_H;

    this._readyGfx.clear();

    for (let i = 0; i < ready.length; i++) {
      const fiber   = ready[i];
      const targetY = sectionY + FIBER_GAP + i * SECTION_H;
      if (targetY >= sectionB) break;

      const slide = this._readySlides.get(fiber.id);
      let y0;
      if (slide) {
        const prog  = Math.min(1, (now - slide.startedAt) / TRANSITION_MS);
        const eased = 1 - Math.pow(1 - prog, 3);
        y0 = slide.fromY + (slide.toY - slide.fromY) * eased;
      } else {
        y0 = targetY;
      }
      if (y0 + FIBER_ROW_H <= sectionY || y0 >= sectionB) continue;
      this._drawFiberRow(this._readyGfx, fiber, y0, W, 1, now);
    }

    // Exit ghosts: fading out while sliding up toward divider
    for (const [, tr] of this._transitions) {
      if (tr.lastReadyY === undefined) continue;
      const prog  = Math.min(1, (now - tr.startedAt) / TRANSITION_MS);
      const y0    = tr.lastReadyY - SECTION_H * prog;
      if (y0 + FIBER_ROW_H <= sectionY || y0 >= sectionB) continue;
      this._drawFiberRow(this._readyGfx, tr.fiber, y0, W, 1 - prog, now);
    }
  }

  _drawFiberRow(gfx, fiber, y0, W, tAlpha, now) {
    const sc = FIBER_STATUS_COLORS[fiber.status] ?? FIBER_STATUS_COLORS.idle;

    gfx.roundRect(CARD_PAD, y0, W - CARD_PAD * 2, FIBER_ROW_H, 2)
      .fill({ color: C.card, alpha: tAlpha })
      .stroke({ color: sc.border, width: 1, alpha: 0.5 * tAlpha });

    gfx.rect(CARD_PAD, y0, 3, FIBER_ROW_H)
      .fill({ color: sc.border, alpha: tAlpha });

    const req = fiber.request;
    if (!req?.def) return;

    const def    = req.def;
    const barX   = CARD_PAD + 5;
    const barEnd = W - CARD_PAD;
    const progW  = barEnd - barX;
    const barH   = FIBER_ROW_H - 4;
    const barY   = y0 + 2;
    if (progW <= 0) return;

    const totalMs = def.phases.reduce((s, p) => s + p.ms, 0);

    let segX = 0;
    for (const p of def.phases) {
      const segW = (p.ms / totalMs) * progW;
      gfx.rect(barX + segX, barY, segW, barH)
        .fill({ color: PHASE_COLORS[p.type] ?? C.surface, alpha: 0.15 * tAlpha });
      segX += segW;
    }

    segX = 0;
    for (let pi = 0; pi < def.phases.length - 1; pi++) {
      segX += (def.phases[pi].ms / totalMs) * progW;
      gfx.rect(barX + segX, barY, 1, barH).fill({ color: C.bg, alpha: tAlpha });
    }

    let totalElapsed = 0;
    for (let pi = 0; pi < fiber.phaseIdx; pi++) totalElapsed += def.phases[pi].ms;
    let curElapsed = fiber.phaseElapsed;
    if ((fiber.status === 'cpu' || fiber.status === 'io') && fiber.phaseRunWall) {
      curElapsed += Math.min(TICK_MS, now - fiber.phaseRunWall);
    }
    totalElapsed += curElapsed;

    let remaining = totalElapsed;
    segX = 0;
    for (const p of def.phases) {
      if (remaining <= 0) break;
      const segW      = (p.ms / totalMs) * progW;
      const fillW     = Math.min(segW, (remaining / p.ms) * segW);
      const isCurrent = remaining < p.ms;
      const fillColor = (fiber.status === 'queued' && isCurrent) ? C.accent : (PHASE_COLORS[p.type] ?? C.surface);
      gfx.rect(barX + segX, barY, fillW, barH).fill({ color: fillColor, alpha: tAlpha });
      remaining -= p.ms;
      segX += segW;
    }

    const cursorX   = barX + Math.min(progW - 1, (totalElapsed / totalMs) * progW);
    const cursorCol = fiber.status === 'queued' ? C.accent : 0xffffff;
    gfx.rect(cursorX - 1, barY, 2, barH).fill({ color: cursorCol, alpha: 0.9 * tAlpha });
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
