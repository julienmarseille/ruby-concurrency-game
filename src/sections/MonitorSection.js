import { TraceGraph }                        from '../objects/TraceGraph.js';
import { ThroughputGraph }                   from '../objects/ThroughputGraph.js';
import { MemoryMeter, MEM_METER_BREAKDOWN_H } from '../objects/MemoryMeter.js';
import { ProcessGraph }                       from '../objects/ProcessGraph.js';
import { MEM_Y, SPACING, MONITOR_MIN_H }     from '../config.js';

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

    this._hasMemoryMeter    = false;
    this._hasMemoryProfiler = false;
    this._hasMonitoring     = false;
    this._hasThroughput     = false;
    this._hasProcessMonitor = false;
    this._processGraph      = null;
    this._fibersEnabled     = false;
    this._userResized       = false;
    this._lastW             = 0;

    this._trace           = new TraceGraph(0, 0, 0);
    this._throughputGraph = new ThroughputGraph(0, 0, 0);
    this._memMeter        = new MemoryMeter();

    this._trace.addTo(this._stage);
    this._throughputGraph.addTo(this._stage);
    this._memMeter.addTo(this._stage);

    this._trace.setVisible(false);
    this._memMeter.setVisible(false);
    this._throughputGraph.setVisible(false);

    // Only resize renderer when the container WIDTH changes (window resize).
    // Height is handled separately — the canvas is always sized to its full
    // content height; CSS overflow:hidden clips what isn't shown.
    this._resizeObserver = new ResizeObserver(() => {
      const W = this._wrapEl.clientWidth;
      if (W > 0 && W !== this._lastW) {
        this._lastW = W;
        this._resizeRenderer();
        this._layout();
      }
    });
    this._resizeObserver.observe(this._wrapEl);
  }

  addThread(thread) {
    this._trace.addThread(thread);
    if (!this._userResized) this._refreshVisibleHeight();
    this._resizeRenderer();
    this._layout();
  }

  removeThread(threadId) {
    this._trace.removeThread(threadId);
    if (!this._userResized) this._refreshVisibleHeight();
    this._resizeRenderer();
    this._layout();
  }

  sampleTrace(threads) {
    this._trace.sample(threads);
  }

  update(gs) {
    if (this._hasMemoryMeter) {
      this._memMeter.draw(
        MEM_Y,
        this._app.screen.width,
        gs.memPct,
        Math.round(gs.memUsed),
        gs.memMax,
        this._hasMemoryProfiler ? gs.memBreakdown : null,
      );
    }
    if (this._hasMonitoring) {
      this._trace.draw(gs.threads);
    }
    if (this._hasThroughput) {
      this._throughputGraph.draw(gs.throughputWindow, gs.overviewWindow);
    }
    if (this._hasProcessMonitor && this._processGraph) {
      this._processGraph.draw(gs.processMetrics.recent, gs.processMetrics.overview);
    }
  }

  unlock(upgradeId) {
    if (upgradeId === 'memory_meter') {
      this._hasMemoryMeter = true;
      this._memMeter.setVisible(true);
    }
    if (upgradeId === 'memory_profiler') {
      this._hasMemoryProfiler = true;
      this._memMeter.setProfilerEnabled(true);
    }
    if (upgradeId === 'monitoring') {
      this._hasMonitoring = true;
      this._trace.setVisible(true);
    }
    if (upgradeId === 'throughput_graph') {
      this._hasThroughput = true;
      this._throughputGraph.setVisible(true);
    }
    if (upgradeId === 'process_monitor') {
      this._hasProcessMonitor = true;
      this._processGraph = new ProcessGraph(0, 0, this._app.screen.width);
      this._processGraph.addTo(this._stage);
      if (this._fibersEnabled) this._processGraph.setFibersEnabled(true);
    }
    this._areaEl.style.display = '';
    this._refreshVisibleHeight();
    // Use rAF so the element has real clientWidth after display change
    requestAnimationFrame(() => {
      this._lastW = this._wrapEl.clientWidth;
      this._resizeRenderer();
      this._layout();
    });
  }

  // Called by DragResizeController — only changes the CSS clip height, never the renderer.
  setHeight(h) {
    this._userResized = true;
    this._wrapEl.style.height = h + 'px';
  }

  // No-op kept for DragResizeController compatibility (start/end callbacks).
  setDragging(_dragging) {}

  setFibersEnabled(enabled) {
    this._fibersEnabled = enabled;
    this._trace.setFibersEnabled(enabled);
    this._processGraph?.setFibersEnabled(enabled);
  }

  get wrapEl() { return this._wrapEl; }

  get _memBreakdownExtraH() {
    return this._hasMemoryProfiler ? MEM_METER_BREAKDOWN_H : 0;
  }

  // Compute the full content height the PixiJS scene needs.
  _contentHeight() {
    let h = this._memBreakdownExtraH;
    const hasAnyGraph = this._hasMonitoring || this._hasThroughput || (this._hasProcessMonitor && this._processGraph);
    if (hasAnyGraph)             h += TRACE_PADDING_TOP;
    if (this._hasThroughput)     h += GRAPH_GAP + this._throughputGraph.totalHeight;
    if (this._hasProcessMonitor && this._processGraph) h += SECTION_GAP + this._processGraph.totalHeight;
    if (this._hasMonitoring)     h += SECTION_GAP + Math.max(80, this._trace.totalHeight + 4);
    if (h > 0) h += BOTTOM_PAD;
    return Math.max(MONITOR_MIN_H, h);
  }

  // Resize the CSS visible height (auto-fit unless user dragged).
  _refreshVisibleHeight() {
    if (!this._userResized) {
      this._wrapEl.style.height = this._contentHeight() + 'px';
    }
  }

  // Resize the renderer to the full content height so everything is always rendered.
  // This is called only when content changes or width changes — never during drag.
  _resizeRenderer() {
    const W = this._wrapEl.clientWidth;
    const H = this._contentHeight();
    if (W > 0 && H > 0) this._app.renderer.resize(W, H);
  }

  _layout() {
    const MW = this._app.screen.width;
    let y = MEM_Y + this._memBreakdownExtraH;

    const hasAnyGraph = this._hasMonitoring || this._hasThroughput || (this._hasProcessMonitor && this._processGraph);
    if (hasAnyGraph) y += TRACE_PADDING_TOP;

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
