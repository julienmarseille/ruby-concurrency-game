import { EVENTS }    from '../config.js';
import { GameEvents } from '../core/GameEvents.js';
import { GameTimer }  from '../core/GameTimer.js';
import { GameState }  from '../game/GameState.js';
import { ThreadsSection }       from '../sections/ThreadsSection.js';
import { MonitorSection }       from '../sections/MonitorSection.js';
import { DragResizeController } from '../sections/DragResizeController.js';
import { QueuePanel }   from '../panels/QueuePanel.js';
import { InfoPanel }    from '../panels/InfoPanel.js';
import { StatsHeader }  from '../panels/StatsHeader.js';
import { NARRATIVE }    from '../NarrativeConfig.js';

export class GameScene {
  constructor(threadsApp, monitorApp) {
    this._threadsApp = threadsApp;

    this._events = new GameEvents();
    this.gs      = new GameState(this._events);
    this._timer  = new GameTimer();

    this._queue  = new QueuePanel();
    this._header = new StatsHeader();
    this._info   = new InfoPanel(
      ()  => this._buyThread(),
      id  => this._buyUpgrade(id),
    );

    this._threads = new ThreadsSection(threadsApp);
    this._monitor = new MonitorSection(monitorApp);

    new DragResizeController(
      document.getElementById('monitor-resize-handle'),
      this._monitor.wrapEl,
      {
        onStart:  () => this._threads.setDragging(true),
        onEnd:    () => this._threads.setDragging(false),
        onResize: h  => this._monitor.setHeight(h),
      },
    );

    this._info.renderShop(this.gs.canAddThread, this.gs.money, this.gs.availableUpgrades(), this.gs.threadCost, this.gs.threadName);
    this._info.setExplanation(NARRATIVE.initial.title, NARRATIVE.initial.body);
    this._applyQueueVisibility();
    this._bindEvents();

    while (this.gs.queue.length < 7) this.gs.spawnRequest();

    threadsApp.ticker.add(() => this._update());
  }

  _bindEvents() {
    this._events
      .on(EVENTS.THREAD_ADDED,      t                  => this._onThreadAdded(t))
      .on(EVENTS.REQUEST_SPAWNED,   ()                 => this._queue.update(this.gs.queue))
      .on(EVENTS.REQUEST_ASSIGNED,  ({ thread, req })  => this._onAssigned(thread, req))
      .on(EVENTS.REQUEST_COMPLETED, ()                 => this._info.addCompleted(this.gs.recentDone))
      .on(EVENTS.PHASE_CHANGED,     ()                 => this._onPhaseChange())
      .on(EVENTS.UPGRADE_UNLOCKED,  id                 => this._onUpgradeUnlocked(id));
  }

  _update() {
    const deltaMS = this._threadsApp.ticker.deltaMS;

    this._timer.update(deltaMS, {
      onTick:         () => { this.gs.step(); this._monitor.sampleTrace(this.gs.threads); },
      onSpawn:        () => this.gs.autoSpawnRequests(),
      onStatsRefresh: () => this._header.update(this.gs),
    });

    this._threads.update(this.gs.threads, deltaMS);
    this._monitor.update(this.gs);

    this._info.renderShop(this.gs.canAddThread, this.gs.money, this.gs.availableUpgrades(), this.gs.threadCost, this.gs.threadName);
    this._queue.update(this.gs.queue);
    this._info.addCompleted(this.gs.recentDone);
  }

  _onThreadAdded(thread) {
    this._threads.addCard(thread);
    this._monitor.addThread(thread);
    this._info.renderShop(this.gs.canAddThread, this.gs.money, this.gs.availableUpgrades(), this.gs.threadCost, this.gs.threadName);
  }

  _onAssigned(thread, req) {
    this._threads.spawnParticleFor(thread, req, this._queue.getElement(req.id));
    this._queue.removeItem(req.id);
  }

  _onPhaseChange() {
    const narr = NARRATIVE.phases[this.gs.phase];
    this._header.setPhase(narr.badge);
    this._info.setExplanation(narr.title, narr.body);
  }

  _onUpgradeUnlocked(id) {
    if (id === 'monitoring' || id === 'throughput_graph') {
      this._monitor.unlock(id);
      InfoPanel.flash(id === 'monitoring' ? 'Monitoring unlocked!' : 'Throughput Graph unlocked!');
    }
    if (id === 'request_tracing') {
      this._applyQueueVisibility();
      InfoPanel.flash('Request Tracing unlocked!');
    }
  }

  _applyQueueVisibility() {
    const visible = this.gs.hasUpgrade('request_tracing');
    const layout  = document.querySelector('.game-layout');
    document.getElementById('queue-panel').style.display = visible ? '' : 'none';
    if (layout) layout.classList.toggle('no-queue', !visible);
    requestAnimationFrame(() => this._threads.setDragging(false));
  }

  _buyThread() {
    const n      = this.gs.threads.length;
    const isFree = n === 0;
    if (!this.gs.addThread(isFree)) {
      InfoPanel.flash(this.gs.money < 100 ? 'Not enough money!' : 'Not enough RAM!');
      return;
    }
    this._header.setPhase(n === 0 ? 'Phase 1 — Threads' : `Phase ${this.gs.phase}`);
    const narr = NARRATIVE.threadAdded[Math.min(n + 1, 4)] ?? NARRATIVE.threadAddedFallback(n + 1);
    this._info.setExplanation(narr.title, narr.body);
    this._info.renderShop(this.gs.canAddThread, this.gs.money, this.gs.availableUpgrades(), this.gs.threadCost, this.gs.threadName);
  }

  _buyUpgrade(id) {
    if (!this.gs.buyUpgrade(id)) InfoPanel.flash('Not enough money!');
  }
}
