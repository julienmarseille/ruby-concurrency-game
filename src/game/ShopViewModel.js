import { UPGRADES } from '../UpgradeConfig.js';
import { MEM_MAX, THREAD_MEM, PROCESS_MEM } from '../config.js';

const MAX_THREADS   = 12;
const THREAD_COST   = 100;
const PROCESS_COST  = 150;

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
    return Array.from({ length: MAX_THREADS }, (_, i) => {
      const n     = i + 1;
      const owned = gs.threads.length >= n;
      const ramOk = gs.memUsed + THREAD_MEM <= MEM_MAX;
      return {
        id:         `thread_${n}`,
        name:       `Thread ${n}`,
        icon:       '🧵',
        desc:       `OS thread · shares the GVL · uses ${THREAD_MEM}MB RAM`,
        cost:       THREAD_COST,
        isThread:   true,
        isFree:     false,
        owned,
        unlocked:   hasProcess1 && (gs.threads.length >= n - 1) && (owned || ramOk),
        affordable: owned || gs.money >= THREAD_COST,
        moneyPct:   Math.min(1, gs.money / THREAD_COST),
      };
    });
  }

  _upgradeNodes(gs) {
    const hasThread1 = gs.threads.length >= 1;
    return Object.values(UPGRADES).map(u => {
      const requiresMet = !u.requires || gs.upgrades.has(u.requires);
      const parentMet   = (u.id === 'request_tracing' || u.id === 'mixed_requests') ? hasThread1 : true;
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
