import { ThreadCard } from '../objects/ThreadCard.js';
import { PipeSystem } from '../objects/PipeSystem.js';
import { PAD, PIPE_W, PIPE_ENTRY_Y } from '../config.js';

const CARDS_START_Y = PIPE_ENTRY_Y + 30;

export class ThreadsSection {
  constructor(threadsApp) {
    this._app     = threadsApp;
    this._stage   = threadsApp.stage;
    this._areaEl  = document.getElementById('threads-area');
    this._innerEl = document.getElementById('threads-inner');
    this._cards   = [];
    this._isDragging = false;

    this._pipes = new PipeSystem(this._stage, PIPE_W / 2, PIPE_ENTRY_Y);

    this._resizeCanvas();
    new ResizeObserver(() => { if (!this._isDragging) this._resizeAndLayout(); })
      .observe(this._areaEl);
  }

  addCard(thread) {
    const cardW = this._app.screen.width - PIPE_W - PAD;
    const y     = CARDS_START_Y + this._cards.length * (120 + 8);
    const card  = new ThreadCard(PIPE_W, y, cardW, thread);
    this._stage.addChild(card);
    this._cards.push(card);
    this._resizeAndLayout();
    return card;
  }

  spawnParticleFor(thread, req, queueItemEl) {
    const card = this._cards.find(c => c.threadId === thread.id);
    if (!card) return;

    let fromPos = null;
    if (queueItemEl) {
      const r          = queueItemEl.getBoundingClientRect();
      const canvasRect = this._app.canvas.getBoundingClientRect();
      fromPos = {
        x: r.right  - canvasRect.left,
        y: r.top + r.height / 2 - canvasRect.top,
      };
    }

    if (fromPos) {
      const arrivalAt = performance.now() + 300;
      thread.pendingUntil = arrivalAt;
      card.setIncoming(arrivalAt);
      this._pipes.spawnParticle(fromPos, card, req.type);
    }
  }

  update(threads, deltaMS) {
    const now = performance.now();
    for (const card of this._cards) card.update(now);
    this._pipes.draw(deltaMS, threads);
  }

  setDragging(isDragging) {
    this._isDragging = isDragging;
    if (!isDragging) this._resizeAndLayout();
  }

  _resizeAndLayout() {
    this._repositionCards();
    this._resizeCanvas();
  }

  _repositionCards() {
    const W     = this._app.screen.width;
    const cardW = W - PIPE_W - PAD;
    let y = CARDS_START_Y;

    this._pipes.setTrunkX(PIPE_W / 2);

    for (const card of this._cards) {
      card.x = PIPE_W;
      card.y = y;
      card.setWidth(cardW);
      y += card.cardHeight + 8;
    }

    this._pipes.setCards(this._cards);
    this._pipes.draw(0, []);
  }

  _resizeCanvas() {
    const W = this._areaEl.clientWidth;
    if (W === 0) return;

    const lastCard  = this._cards[this._cards.length - 1];
    const contentH  = lastCard
      ? lastCard.y + lastCard.cardHeight + 20
      : CARDS_START_Y + 50;
    const H = Math.max(contentH, this._areaEl.clientHeight);

    this._innerEl.style.height = H + 'px';
    this._app.renderer.resize(W, H);
  }
}
