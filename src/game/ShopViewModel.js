import { UPGRADES } from '../UpgradeConfig.js';
import { THREAD_MEM, PROCESS_MEM, threadCostFor, processCostFor, MAX_THREADS } from '../config.js';

export class ShopViewModel {
  compute(gs) {
    const highestMarketing = [5, 4, 3, 2, 1].find(n => gs.upgrades.has(`marketing_${n}`)) ?? 0;
    return [
      ...this._processNodes(gs),
      ...this._threadNodes(gs),
      ...this._upgradeNodes(gs, highestMarketing),
    ];
  }

  _processNodes(gs) {
    return [1, 2, 3, 4, 5, 6, 7, 8].map(n => {
      const owned   = gs.processes.length >= n;
      const isFree  = n === 1;
      const cost    = isFree ? 0 : processCostFor(n);
      const ramOk   = n === 1 ? true : gs.memUsed + PROCESS_MEM <= gs.memMax;
      const coresOk = gs.coreCount >= n;
      const blockedByRactors = gs.ractorsEnabled && !owned;
      return {
        id:         `process_${n}`,
        name:       n === 1 ? 'Start Server' : `Process ${n}`,
        icon:       '⚙️',
        desc:       n === 1
          ? 'Create your Ruby process — the server entry point.'
          : `Fork a new process — own GVL, no CPU contention. Requires ${n} vCPU. +${PROCESS_MEM}MB RAM.`,
        cost,
        isProcess:  true,
        isFree,
        owned,
        unlocked:   blockedByRactors ? false : (n === 1 ? gs.upgrades.has('nano_vps') : gs.processes.length >= n - 1),
        affordable: blockedByRactors ? false : (owned || isFree || (gs.money >= cost && ramOk && coresOk)),
        moneyPct:   cost > 0 ? Math.min(1, gs.money / cost) : 1,
        removable:  owned && n === gs.processes.length && n > 1,
      };
    });
  }

  _threadNodes(gs) {
    const hasProcess1  = gs.processes.length >= 1;
    const fiberMode    = gs.fibersEnabled;
    const ractorMode   = gs.ractorsEnabled;
    return Array.from({ length: MAX_THREADS }, (_, i) => {
      const n     = i + 1;
      const owned = gs.threads.length >= n;
      const ramOk = gs.memUsed + THREAD_MEM <= gs.memMax;
      // In fiber mode: 1 thread per process (Falcon reactor)
      const unlockedFiber  = owned || gs.processes.length >= n;
      const unlockedNormal = hasProcess1;

      let icon, desc;
      if (fiberMode && ractorMode) {
        icon = '⚗️';
        desc = `Ractor + Fiber host — own GVL domain, multiplexes many fibers. Handles Process ${n}.`;
      } else if (ractorMode) {
        icon = '⚗️';
        desc = `Ractor — own GVL domain, true CPU parallelism. No GVL_WAIT. Uses ${THREAD_MEM}MB RAM.`;
      } else if (fiberMode) {
        icon = '🪡';
        desc = `Falcon reactor thread — 1 per process. Handles all fibers for Process ${n}.`;
      } else {
        icon = '🧵';
        desc = `OS thread · shares the GVL · uses ${THREAD_MEM}MB RAM`;
      }

      const threadCost = threadCostFor(n);
      return {
        id:         `thread_${n}`,
        name:       `Thread ${n}`,
        icon,
        desc,
        cost:       threadCost,
        isThread:   true,
        isFree:     false,
        owned,
        unlocked:   (fiberMode && !ractorMode) ? unlockedFiber : unlockedNormal,
        affordable: owned || (gs.money >= threadCost && ramOk),
        moneyPct:   Math.min(1, gs.money / threadCost),
        removable:  owned && n === gs.threads.length,
      };
    });
  }

  _upgradeNodes(gs, highestMarketing) {
    const hasThread1 = gs.threads.length >= 1;
    return Object.values(UPGRADES).map(u => {
      const requiresMet = !u.requires || gs.upgrades.has(u.requires);
      const parentMet   = !u.requiresThread || hasThread1;
      const owned       = gs.upgrades.has(u.id);
      const marketingN  = u.id.startsWith('marketing_') ? parseInt(u.id.split('_')[1]) : 0;
      return {
        ...u,
        isThread:   false,
        owned,
        unlocked:   requiresMet && parentMet,
        affordable: gs.money >= u.cost,
        moneyPct:   Math.min(1, gs.money / u.cost),
        removable:  owned && marketingN > 0 && marketingN === highestMarketing,
      };
    });
  }
}
