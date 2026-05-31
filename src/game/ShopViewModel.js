import { UPGRADES } from '../UpgradeConfig.js';
import { MEM_MAX, THREAD_MEM, PROCESS_MEM, THREAD_COST, PROCESS_COST, MAX_THREADS } from '../config.js';

export class ShopViewModel {
  compute(gs) {
    return [
      ...this._processNodes(gs),
      ...this._threadNodes(gs),
      ...this._upgradeNodes(gs),
    ];
  }

  _processNodes(gs) {
    return [1, 2, 3, 4].map(n => {
      const owned  = gs.processes.length >= n;
      const isFree = n === 1;
      const cost   = isFree ? 0 : PROCESS_COST;
      const ramOk  = n === 1 ? true : gs.memUsed + PROCESS_MEM <= MEM_MAX;
      return {
        id:         `process_${n}`,
        name:       n === 1 ? 'Start Server' : `Process ${n}`,
        icon:       '⚙️',
        desc:       n === 1
          ? 'Create your Ruby process — the server entry point.'
          : `Fork a new process — own GVL, no CPU contention. +${PROCESS_MEM}MB RAM.`,
        cost,
        isProcess:  true,
        isFree,
        owned,
        unlocked:   n === 1 ? true : (gs.threads.length >= 1 && gs.processes.length >= n - 1 && (owned || ramOk)),
        affordable: owned || isFree || gs.money >= cost,
        moneyPct:   cost > 0 ? Math.min(1, gs.money / cost) : 1,
      };
    });
  }

  _threadNodes(gs) {
    const hasProcess1 = gs.processes.length >= 1;
    const fiberMode   = gs.fibersEnabled;
    return Array.from({ length: MAX_THREADS }, (_, i) => {
      const n     = i + 1;
      const owned = gs.threads.length >= n;
      const ramOk = gs.memUsed + THREAD_MEM <= MEM_MAX;
      // In fiber mode: 1 thread per process (Falcon reactor), max 4 total
      const unlockedFiber = gs.processes.length >= n && (owned || ramOk);
      const unlockedNormal = hasProcess1 && (gs.threads.length >= n - 1) && (owned || ramOk);
      return {
        id:         `thread_${n}`,
        name:       `Thread ${n}`,
        icon:       fiberMode ? '🪡' : '🧵',
        desc:       fiberMode
          ? `Falcon reactor thread — 1 per process. Handles all fibers for Process ${n}.`
          : `OS thread · shares the GVL · uses ${THREAD_MEM}MB RAM`,
        cost:       THREAD_COST,
        isThread:   true,
        isFree:     false,
        owned,
        unlocked:   fiberMode ? unlockedFiber : unlockedNormal,
        affordable: owned || gs.money >= THREAD_COST,
        moneyPct:   Math.min(1, gs.money / THREAD_COST),
      };
    });
  }

  _upgradeNodes(gs) {
    const hasThread1 = gs.threads.length >= 1;
    return Object.values(UPGRADES).map(u => {
      const requiresMet = !u.requires || gs.upgrades.has(u.requires);
      const parentMet   = !u.requiresThread || hasThread1;
      return {
        ...u,
        isThread:   false,
        owned:      gs.upgrades.has(u.id),
        unlocked:   requiresMet && parentMet,
        affordable: gs.money >= u.cost,
        moneyPct:   Math.min(1, gs.money / u.cost),
      };
    });
  }
}
