import { TraceGraph }      from '../objects/TraceGraph.js';
import { ThroughputGraph } from '../objects/ThroughputGraph.js';
import { MemoryMeter }     from '../objects/MemoryMeter.js';
import { ProcessGraph }    from '../objects/ProcessGraph.js';
import { MEM_Y, MEM_DISPLAY_MAX, SPACING } from '../config.js';

const MONITOR_MIN_H     = 150;
const TRACE_PADDING_TOP = SPACING.xl;
const GRAPH_GAP         = SPACING.lg;
const SECTION_GAP       = SPACING.xl;
const BOTTOM_PAD        = SPACING.xl + SPACING.sm;

export class MonitorSection {
  constructor(monitorApp) {
    this._app   = monitorApp;
    this._stage = monitorApp.stage;

    this._areaEl = document.getElementById('monitor-area');
    this._wrapEl = document.getElementById('monitor-canvas-wrap');

    this._hasMonitoring     = false;
    this._hasThroughput     = false;
    this._hasProcessMonitor = false;
    this._processGraph      = null;

    this._trace           = new TraceGraph(this._stage, 0, 0, 0);
    this._throughputGraph = new ThroughputGraph(this._stage, 0, 0, 0);
    this._memMeter        = new MemoryMeter(this._stage);

    this._trace.setVisible(false);
    this._memMeter.setVisible(false);
    this._throughputGraph.setVisible(false);

    this._app.renderer.on('resize', () => this._layout());
  }

  addThread(thread) {
    this._trace.addThread(thread);
    this._refreshHeight();
    requestAnimationFrame(() => {
      const W = this._wrapEl.clientWidth;
      const H = this._wrapEl.clientHeight;
      if (W > 0 && H > 0) this._app.renderer.resize(W, H);
      this._layout();
    });
  }

  sampleTrace(threads) {
    this._trace.sample(threads);
  }

  update(gs) {
    if (this._hasMonitoring) {
      this._trace.draw(gs.threads);
      this._memMeter.draw(MEM_Y, this._app.screen.width, gs.memPct, gs.memUsed, MEM_DISPLAY_MAX);
    }
    if (this._hasThroughput) {
      this._throughputGraph.draw(gs.throughputWindow, gs.overviewWindow);
    }
    if (this._hasProcessMonitor && this._processGraph) {
      this._processGraph.draw(gs.processMetrics.recent, gs.processMetrics.overview);
    }
  }

  unlock(upgradeId) {
    if (upgradeId === 'monitoring') {
      this._hasMonitoring = true;
      this._trace.setVisible(true);
      this._memMeter.setVisible(true);
    }
    if (upgradeId === 'throughput_graph') {
      this._hasThroughput = true;
      this._throughputGraph.setVisible(true);
    }
    if (upgradeId === 'process_monitor') {
      this._hasProcessMonitor = true;
      this._processGraph = new ProcessGraph(this._stage, 0, 0, this._app.screen.width);
    }
    this._areaEl.style.display = '';
    this._refreshHeight();
    requestAnimationFrame(() => {
      const W = this._wrapEl.clientWidth;
      const H = this._wrapEl.clientHeight;
      if (W > 0 && H > 0) this._app.renderer.resize(W, H);
      this._layout();
    });
  }

  setHeight(h) {
    this._wrapEl.style.height = h + 'px';
  }

  get wrapEl() { return this._wrapEl; }

  _refreshHeight() {
    let h = 0;
    if (this._hasMonitoring)     h += TRACE_PADDING_TOP;
    if (this._hasThroughput)     h += GRAPH_GAP + this._throughputGraph.totalHeight;
    if (this._hasProcessMonitor && this._processGraph) h += SECTION_GAP + this._processGraph.totalHeight;
    if (this._hasMonitoring)     h += SECTION_GAP + Math.max(80, this._trace.totalHeight + 4);
    if (h > 0) h += BOTTOM_PAD;
    this._wrapEl.style.height = Math.max(MONITOR_MIN_H, h) + 'px';
  }

  _layout() {
    const MW = this._app.screen.width;
    let y = MEM_Y;

    if (this._hasMonitoring) {
      y += TRACE_PADDING_TOP;
    }

    if (this._hasThroughput) {
      y += GRAPH_GAP;
      this._throughputGraph.setY(y);
      this._throughputGraph.setWidth(MW);
      y += this._throughputGraph.totalHeight;
    }

    if (this._hasProcessMonitor && this._processGraph) {
      y += SECTION_GAP;
      this._processGraph.setY(y);
      this._processGraph.setWidth(MW);
      y += this._processGraph.totalHeight;
    }

    if (this._hasMonitoring) {
      y += SECTION_GAP;
      this._trace.setY(y);
      this._trace.setWidth(MW);
    }
  }
}
