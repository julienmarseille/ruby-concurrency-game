import { Graphics, Container } from 'pixi.js';
import { C, LAYERS, PIPE_ENTRY_Y, PIPE_TRAVEL_MS } from '../config.js';

export class PipeSystem {
  constructor(stage, trunkX, entryY = PIPE_ENTRY_Y) {
    this._stage     = stage;
    this._trunkX    = trunkX;
    this._entryY    = entryY;
    this._cards     = [];
    this._particles = [];
    this._pipeDirty = true;

    this._pipeGfx  = new Graphics();
    this._dotLayer = new Container();
    this._dotLayer.zIndex = LAYERS.PARTICLES;
    stage.addChild(this._pipeGfx);
    stage.addChild(this._dotLayer);
  }

  setCards(cards) { this._cards = cards; this._pipeDirty = true; }
  setTrunkX(x)    { this._trunkX = x;   this._pipeDirty = true; }

  spawnParticle(fromPos, toCard, reqType) {
    const color = reqType === 'DB_REQUEST' ? 0x4299e1 : reqType === 'MIXED' ? 0xe8a838 : 0xfc8181;
    const dot   = new Graphics();
    this._dotLayer.addChild(dot);
    this._particles.push({ fromPos, toCard, color, dot, elapsed: 0, duration: PIPE_TRAVEL_MS });
  }

  draw(deltaMS) {
    this._particles = this._particles.filter(p => {
      p.elapsed += deltaMS;
      const rawT  = Math.min(1, p.elapsed / p.duration);
      const eased = rawT < 0.5 ? 2 * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 2) / 2;
      const pos   = this._pathPoint(p, eased);

      p.dot.clear();
      p.dot.circle(pos.x, pos.y, 7.5).fill({ color: p.color, alpha: 0.2 });
      p.dot.circle(pos.x, pos.y, 4.5).fill({ color: p.color });
      p.dot.circle(pos.x, pos.y, 1.8).fill({ color: 0xffffff });

      if (rawT >= 1) { p.dot.destroy(); return false; }
      return true;
    });

    if (this._pipeDirty) {
      this._drawStaticPipes();
      this._pipeDirty = false;
    }
  }

  destroy() {
    for (const p of this._particles) p.dot.destroy();
    this._particles = [];
    this._pipeGfx.destroy();
    this._dotLayer.destroy({ children: true });
  }

  _pathPoint(p, t) {
    const { fromPos, toCard } = p;
    const trunkX  = this._trunkX;
    const entryY  = this._entryY;
    const branchY = toCard.y + toCard.cardHeight / 2;
    const toX     = toCard.x;

    const d01   = Math.hypot(-fromPos.x, entryY - fromPos.y);
    const d12   = trunkX;
    const d23   = Math.abs(branchY - entryY);
    const d34   = Math.abs(toX - trunkX);
    const total = d01 + d12 + d23 + d34 || 1;
    const d     = t * total;

    if (d <= d01) {
      const f = d01 > 0 ? d / d01 : 1;
      return { x: fromPos.x * (1 - f), y: fromPos.y + (entryY - fromPos.y) * f };
    } else if (d <= d01 + d12) {
      const f = d12 > 0 ? (d - d01) / d12 : 1;
      return { x: f * trunkX, y: entryY };
    } else if (d <= d01 + d12 + d23) {
      const f = d23 > 0 ? (d - d01 - d12) / d23 : 1;
      return { x: trunkX, y: entryY + (branchY - entryY) * f };
    } else {
      const f = d34 > 0 ? (d - d01 - d12 - d23) / d34 : 1;
      return { x: trunkX + (toX - trunkX) * f, y: branchY };
    }
  }

  _drawStaticPipes() {
    const gfx    = this._pipeGfx;
    const trunkX = this._trunkX;
    const entryY = this._entryY;
    gfx.clear();

    const hasCards = this._cards.length > 0;
    const bottomY  = hasCards
      ? Math.max(...this._cards.map(c => c.y + c.cardHeight / 2))
      : entryY + 20;

    gfx.moveTo(0, entryY).lineTo(trunkX, entryY)
      .stroke({ width: 2, color: C.pipe });
    gfx.moveTo(trunkX, entryY).lineTo(trunkX, bottomY)
      .stroke({ width: 2, color: C.pipe });

    for (const card of this._cards) {
      const branchY = card.y + card.cardHeight / 2;
      gfx.moveTo(trunkX, branchY).lineTo(card.x, branchY)
        .stroke({ width: 2, color: C.pipe });
    }
  }
}
