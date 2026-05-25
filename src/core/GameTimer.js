import { TICK_MS, SPAWN_MS, STATS_MS } from '../config.js';

export class GameTimer {
  constructor() {
    this._tickAccum  = 0;
    this._spawnAccum = 0;
    this._statsAccum = 0;
  }

  update(deltaMS, { onTick, onSpawn, onStatsRefresh }) {
    this._tickAccum  += deltaMS;
    this._spawnAccum += deltaMS;
    this._statsAccum += deltaMS;

    while (this._tickAccum >= TICK_MS) {
      this._tickAccum -= TICK_MS;
      onTick();
    }

    if (this._spawnAccum >= SPAWN_MS) { this._spawnAccum -= SPAWN_MS; onSpawn(); }
    if (this._statsAccum >= STATS_MS) { this._statsAccum -= STATS_MS; onStatsRefresh(); }
  }
}
