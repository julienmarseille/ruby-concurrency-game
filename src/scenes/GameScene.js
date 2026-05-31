import { EVENTS, PROCESS_COST, THREAD_COST } from '../config.js';
import { UPGRADES }             from '../UpgradeConfig.js';
import { GameEvents }           from '../core/GameEvents.js';
import { GameTimer }            from '../core/GameTimer.js';
import { GameState }            from '../game/GameState.js';
import { ShopViewModel }        from '../game/ShopViewModel.js';
import { NARRATIVE }            from '../NarrativeConfig.js';
import { ThreadsSection }       from '../sections/ThreadsSection.js';
import { MonitorSection }       from '../sections/MonitorSection.js';
import { DragResizeController } from '../sections/DragResizeController.js';
import { QueuePanel }   from '../panels/QueuePanel.js';
import { InfoPanel }    from '../panels/InfoPanel.js';
import { StatsHeader }  from '../panels/StatsHeader.js';

export class GameScene {
  constructor(threadsApp, monitorApp) {
    this._threadsApp = threadsApp;

    this._events    = new GameEvents();
    this.gs         = new GameState(this._events);
    this._timer     = new GameTimer();
    this._shopVM    = new ShopViewModel();

    this._queue  = new QueuePanel();
    this._header = new StatsHeader();
    this._info   = new InfoPanel(
      ()  => this._buyThread(),
      id  => this._buyUpgrade(id),
      id  => this._buyProcess(id),
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

    this._refreshShop();
    this._info.setExplanation(NARRATIVE.initial);
    this._applyQueueVisibility();
    this._bindEvents();

    while (this.gs.queue.length < 7) this.gs.spawnRequest();

    threadsApp.ticker.add(() => this._update());
  }

  _bindEvents() {
    this._events
      .on(EVENTS.THREAD_ADDED,          t                 => this._onThreadAdded(t))
      .on(EVENTS.THREAD_REMOVED,        t                 => this._onThreadRemoved(t))
      .on(EVENTS.PROCESS_ADDED,         proc              => this._onProcessAdded(proc))
      .on(EVENTS.REQUEST_SPAWNED,       ()                => this._queue.update(this.gs.queue))
      .on(EVENTS.REQUEST_ASSIGNED,      ({ thread, req, isFiber }) => this._onAssigned(thread, req, isFiber))
      .on(EVENTS.REQUEST_COMPLETED,     ()                => this._info.addCompleted(this.gs.recentDone))
      .on(EVENTS.UPGRADE_UNLOCKED,      id                => this._onUpgradeUnlocked(id))
      .on(EVENTS.THREADS_REDISTRIBUTED, n                 => InfoPanel.flash(`Threads redistributed across ${n} processes`));
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
    this._queue.update(this.gs.queue);
    this._info.addCompleted(this.gs.recentDone);
  }

  _onThreadAdded(thread) {
    this._threads.addCard(thread);
    this._monitor.addThread(thread);
    this._refreshShop();
  }

  _onThreadRemoved(thread) {
    this._threads.removeCard(thread.id);
    this._monitor.removeThread(thread.id);
    this._refreshShop();
  }

  _onProcessAdded(proc) {
    this._threads.addProcessHeader(proc.id);
    this._threads.relayout();
    this._refreshShop();
  }

  _onAssigned(thread, req, isFiber = false) {
    if (isFiber) {
      this._queue.removeItem(req.id);
    } else {
      this._threads.spawnParticleFor(thread, req, this._queue.getElement(req.id));
      this._queue.removeItem(req.id);
    }
  }

  _onUpgradeUnlocked(id) {
    const { effects } = UPGRADES[id] ?? {};
    if (effects) {
      if (effects.flash)                InfoPanel.flash(effects.flash);
      if (effects.monitorUnlock)        this._monitor.unlock(id);
      if (effects.showQueue)            this._applyQueueVisibility();
      if (effects.enableProcessMonitor) this._threads.enableProcessMonitor();
    }
    if (id === 'fiber_scheduler') {
      requestAnimationFrame(() => this._threads.relayout());
    }
    const narr = NARRATIVE.upgrades[id] ?? null;
    if (narr) this._info.setExplanation(narr);
    this._refreshShop();
  }

  _applyQueueVisibility() {
    const visible = this.gs.hasUpgrade('request_tracing');
    const layout  = document.querySelector('.game-layout');
    document.getElementById('queue-panel').style.display = visible ? '' : 'none';
    if (layout) layout.classList.toggle('no-queue', !visible);
    requestAnimationFrame(() => this._threads.setDragging(false));
  }

  _buyThread() {
    const n = this.gs.threads.length;
    if (!this.gs.addThread(false)) {
      InfoPanel.flash(this.gs.money < THREAD_COST ? 'Not enough money!' : 'Not enough RAM!');
      return;
    }
    const threadCount = n + 1;
    this._info.setExplanation(NARRATIVE.threadAdded[Math.min(threadCount, 4)] ?? NARRATIVE.threadAddedFallback(threadCount));
    this._refreshShop();
  }

  _buyUpgrade(id) {
    if (!this.gs.buyUpgrade(id)) InfoPanel.flash('Not enough money!');
  }

  _buyProcess(id) {
    if (id === 'process_1') {
      this.gs.addFirstProcess();
      this._info.setExplanation(NARRATIVE.processCreated);
      return;
    }
    if (!this.gs.addProcess()) {
      InfoPanel.flash(this.gs.money < PROCESS_COST ? 'Not enough money!' : 'Not enough RAM!');
      return;
    }
    this._info.setExplanation(NARRATIVE.processAdded);
  }

  _refreshShop() {
    this._info.renderShop(this._shopVM.compute(this.gs));
  }
}
