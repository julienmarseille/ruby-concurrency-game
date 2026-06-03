import { UPGRADES } from '../UpgradeConfig.js';
import { THREAD_MEM, PROCESS_MEM, THREAD_COST, PROCESS_COST, MAX_THREADS } from '../config.js';

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
    return [1, 2, 3, 4].map(n => {
      const owned   = gs.processes.length >= n;
      const isFree  = n === 1;
      const cost    = isFree ? 0 : PROCESS_COST;
      const ramOk   = n === 1 ? true : gs.memUsed + PROCESS_MEM <= gs.memMax;
      const coresOk = gs.coreCount >= n;
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
        unlocked:   n === 1 ? gs.upgrades.has('nano_vps') : gs.processes.length >= n - 1,
        affordable: owned || isFree || (gs.money >= cost && ramOk && coresOk),
        moneyPct:   cost > 0 ? Math.min(1, gs.money / cost) : 1,
        removable:  owned && n === gs.processes.length && n > 1,
      };
    });
  }

  _threadNodes(gs) {
    const hasProcess1 = gs.processes.length >= 1;
    const fiberMode   = gs.fibersEnabled;
    return Array.from({ length: MAX_THREADS }, (_, i) => {
      const n     = i + 1;
      const owned = gs.threads.length >= n;
      const ramOk = gs.memUsed + THREAD_MEM <= gs.memMax;
      // In fiber mode: 1 thread per process (Falcon reactor), max 4 total
      const unlockedFiber  = owned || gs.processes.length >= n;
      const unlockedNormal = owned || (hasProcess1 && gs.threads.length >= n - 1);
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
        affordable: owned || (gs.money >= THREAD_COST && ramOk),
        moneyPct:   Math.min(1, gs.money / THREAD_COST),
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
