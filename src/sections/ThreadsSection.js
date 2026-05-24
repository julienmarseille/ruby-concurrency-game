import { ThreadCard }    from '../objects/ThreadCard.js';
import { ProcessHeader } from '../objects/ProcessHeader.js';
import { PipeSystem }    from '../objects/PipeSystem.js';
import { PAD, PIPE_W, PIPE_ENTRY_Y } from '../config.js';

const CARDS_START_Y  = PIPE_ENTRY_Y + 30;
const CARD_GAP       = 8;
const GROUP_GAP      = 24;

export class ThreadsSection {
  constructor(threadsApp) {
    this._app     = threadsApp;
    this._stage   = threadsApp.stage;
    this._areaEl  = document.getElementById('threads-area');
    this._innerEl = document.getElementById('threads-inner');
    this._cards   = [];
    this._headers = [];
    this._isDragging = false;

    this._pipes = new PipeSystem(this._stage, PIPE_W / 2, PIPE_ENTRY_Y);

    this._resizeCanvas();
    new ResizeObserver(() => { if (!this._isDragging) this._resizeAndLayout(); })
      .observe(this._areaEl);
  }

  addCard(thread) {
    const cardW = this._app.screen.width - PIPE_W - PAD;
    const card  = new ThreadCard(PIPE_W, 0, cardW, thread);
    this._stage.addChild(card);
    this._cards.push(card);
    this._resizeAndLayout();
    return card;
  }

  addProcessHeader(processId) {
    const w      = this._app.screen.width - PIPE_W - PAD;
    const header = new ProcessHeader(PIPE_W, 0, w, processId);
    this._stage.addChild(header);
    this._headers.push({ processId, header });
    this._resizeAndLayout();
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

  relayout() {
    this._resizeAndLayout();
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

    const headerPids  = this._headers.map(h => h.processId);
    const cardPids    = this._cards.map(c => c._thread.processId);
    const processIds  = [...new Set([...headerPids, ...cardPids])];
    const showHeaders = this._headers.length > 0;

    for (const pid of processIds) {
      const groupEntry = showHeaders ? this._headers.find(h => h.processId === pid) : null;

      if (groupEntry) {
        groupEntry.header.x = PIPE_W;
        groupEntry.header.y = y;
        groupEntry.header.setWidth(cardW);
        y += groupEntry.header.cardHeight;
      }

      const procCards = this._cards.filter(c => c._thread.processId === pid);
      for (const card of procCards) {
        card.x = PIPE_W;
        card.y = y;
        card.setWidth(cardW);
        y += card.cardHeight + CARD_GAP;
      }

      y += showHeaders ? GROUP_GAP : CARD_GAP;
    }

    this._pipes.setCards(this._cards);
    this._pipes.draw(0, []);
  }

  _resizeCanvas() {
    const W = this._areaEl.clientWidth;
    if (W === 0) return;

    const allItems = [
      ...this._cards,
      ...this._headers.map(h => h.header),
    ];
    const lastItem = allItems.reduce((last, item) => {
      return (!last || item.y > last.y) ? item : last;
    }, null);

    const contentH = lastItem
      ? lastItem.y + (lastItem.cardHeight ?? 96) + 20
      : CARDS_START_Y + 50;
    const H = Math.max(contentH, this._areaEl.clientHeight);

    this._innerEl.style.height = H + 'px';
    this._app.renderer.resize(W, H);
  }
}
