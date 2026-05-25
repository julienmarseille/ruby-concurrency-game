import { NARRATIVE } from '../NarrativeConfig.js';

export class NarrativeProvider {
  initial()          { return NARRATIVE.initial; }
  processCreated()   { return NARRATIVE.processCreated; }
  processAdded()     { return NARRATIVE.processAdded; }
  forUpgrade(id)     { return NARRATIVE.upgrades[id] ?? null; }
  forThreadCount(n)  { return NARRATIVE.threadAdded[Math.min(n, 4)] ?? NARRATIVE.threadAddedFallback(n); }
}
