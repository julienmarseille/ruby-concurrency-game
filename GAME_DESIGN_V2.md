# Game Design V2 — Ruby Concurrency Game
## Document de conception global

Synthèse de 5 analyses parallèles couvrant : économie, tension, narratif, UX visuel, et boucles de gameplay.

---

## DIAGNOSTIC : Pourquoi le jeu est plat aujourd'hui

| Problème | Impact |
|----------|--------|
| Argent de départ $10 000 | Le joueur peut tout acheter en 2 minutes sans choix |
| Pas de condition de victoire | Aucun objectif, jeu sans fin ni sens |
| Pas de vraies conséquences | OOM crash = 2s de downtime, puis on continue comme avant |
| Queue cap à 100 | Jamais atteinte, aucune pression |
| Progression linéaire | Chaque achat est optimal, pas de dilemme |
| Observabilité payante | L'outil pédagogique est derrière un paywall |
| Un seul chemin | Threads → Processes → Fibers → Ractors, pas de stratégie alternative |

---

## PARTIE 1 — ÉCONOMIE

### Principe directeur

> "Le prochain achat doit toujours coûter 1–3 minutes de revenus au niveau actuel."

### Argent de départ : $800

Suffisant pour 8 threads OU 1 Small VPS OU un mix — pas pour tout.
Crée un vrai choix dès T=0.

### Observabilité : GRATUITE

Request Tracing, Memory Meter, Monitoring, Memory Profiler, Process Monitor, Throughput Graph sont débloqués d'emblée. Ce sont des outils pédagogiques, pas des ressources économiques.

### Coûts des ressources

| Ressource | Actuel | Proposé | Logique |
|-----------|--------|---------|---------|
| Thread 1–3 | $100 flat | $100 | Premiers achats accessibles |
| Thread 4–6 | $100 | $150 | Rendements décroissants |
| Thread 7–9 | $100 | $200 | Décourage l'over-buying |
| Thread 10–12 | $100 | $250 | Late game |
| Process 2 | $150 | $200 | — |
| Process 3 | $150 | $300 | — |
| Process 4 | $150 | $400 | — |
| Nano VPS | $0 | $0 | Onboarding |
| Small VPS | $400 | $300 | Rend attractif vs threads |
| Medium VPS | $900 | $600 | Palier cohérent |
| Large VPS | $2 000 | $1 200 | Late game |
| Campaign I | $50 | $60 | — |
| Campaign II | $150 | $180 | — |
| Campaign III | $300 | $400 | Mid-game gate |
| Campaign IV | $500 | $800 | Spike late-game |
| Campaign V | $800 | $1 600 | Doublement, pression endgame |
| Mixed Requests | $80 | $100 | — |
| PDF Reports | $120 | $180 | — |
| Fiber Scheduler | $250 | $600 | Doit se mériter |
| Ractors | $5 000 | $2 500 | Accessible avec bonne gestion |

### Rewards par requête

| Type | Actuel | Proposé |
|------|--------|---------|
| GET /users | $10 | $15 |
| GET /profile | $10 | $15 |
| POST /search | $10 | $18 |
| POST /checkout | $18 | $27 |
| GET /export.pdf | $30 | $45 |

### Coût passif des campagnes marketing

Une campagne active coûte $X/s en infrastructure fictive (simule le coût de servir plus de trafic). Le joueur ne peut pas lancer Campaign III sans vérifier qu'il a le revenu pour en absorber le coût passif.

| Campaign | Coût passif |
|----------|-------------|
| I | $0.5/s |
| II | $1/s |
| III | $2/s |
| IV | $4/s |
| V | $8/s |

### Vérification de la courbe (simulation)

| État | Revenu/s | Prochain achat | Coût | Attente |
|------|----------|----------------|------|---------|
| 1 thread, 1 req/s | $15 | Thread 2 | $100 | ~7s |
| 2 threads, 1 req/s | $30 | Campaign I | $60 | ~2s |
| 2 threads, 3 req/s | $90 | Thread 3 + Mixed | $200 | ~2.2s |
| 4 threads, 3 req/s mix | $150 | Campaign II | $180 | ~1.2s |
| 4 threads, 5 req/s | $270 | Process 2 + Small VPS | $500 | ~1.9s |
| 2 procs, 7 threads, 5 req/s | $400 | Campaign III + Report | $580 | ~1.5s |
| 2 procs, 8 req/s | $900 | Medium VPS + Fiber | $1 200 | ~1.3s |
| Fibers actifs, 8 req/s | $2 000+ | Campaign V + Ractors | $4 100 | ~2s |

Ratio cible atteint : 0.8–2s entre chaque grand achat. Pas de phase morte.

---

## PARTIE 2 — TENSION ET FAIL STATES

### 2.1 Pénalités de latence

Chaque requête embarque `spawnedAt = performance.now()`. Au moment de la completion, la pénalité s'applique :

| Temps en queue | Reward multiplier | Couleur dans la queue |
|----------------|------------------|-----------------------|
| 0–3s | 100% | Bleu (normal) |
| 3–6s | 75% | Jaune |
| 6–10s | 50% | Orange |
| > 10s | 20% | Rouge (pulsant) |

**Visuel :** chaque item de la queue a une micro-barre colorée qui évolue en temps réel.
**Pédagogie :** la latence utilisateur est un KPI distinct du throughput.

### 2.2 Queue overflow

Nouvelle limite : **50 items** (remplace le hardcodé 100).

Quand `queue.length > 50` :
- Les requêtes les plus anciennes ont une probabilité croissante d'être droppées par tick
- Drop = `REQUEST_DROPPED` event, aucun revenu, compteur visible dans le header
- Chaque drop inflige une pénalité de -1% sur les rewards suivants (stacks jusqu'à -50%, se résorbe en 10s sans drop)

**Visuel :** bordure rouge pulsante sur la queue panel, flash "X requests dropped", compteur `Dropped: N` en rouge dans le header.
**Pédagogie :** les clients ne patientent pas indéfiniment — les requêtes expirent côté HTTP client.

### 2.3 OOM Crash renforcé

Le crash actuel (2s downtime) est trop doux. Nouvelles conséquences :

1. **Perte d'argent directe** : -15% du solde courant (minimum $50 pour éviter soft-lock)
2. **Marketing désactivé 8s** : toutes les campagnes passent en gris/dim pendant 8s
3. **Thread recovery 15s** : 2–3 threads aléatoires sont "recovering" (carte grisée, ignorent les requêtes)
4. **Downtime proportionnel** : si `memUsed = 1.2 × memMax`, downtime = 2.4s au lieu de 2s

**Modale enrichie** : affiche la cascade d'effets (argent perdu, marketing pause, threads en récupération). Message pédagogique sur le coût réel d'un OOM en production.
**Pédagogie :** un crash mémoire en prod a des effets en cascade — pas juste un restart.

### 2.4 Dégradation par saturation GVL

Si `gvlWaitPct > 75%` pendant 5+ ticks consécutifs :
- `gvl_strain = true`
- Les phases CPU sont allongées de +10%
- Les rewards des completions chutent de 5%

Si `gvlWaitPct > 85%` pendant 10+ ticks :
- Phases CPU +20%, rewards -10%

Récupération automatique quand `gvlWaitPct < 50%` pendant 5 ticks (lerp sur 3s).

**Visuel :** aura violette sur toutes les thread cards, GVL% pulse en rouge dans le header.
**Pédagogie :** le GVL n'est pas juste une stat — saturer le système le dégrade globalement.

### 2.5 Spiral de dette

Un joueur peut tomber dans une spirale : campagne active → queue overflow → drops → revenus réduits → OOM crash → marketing désactivé → pas de revenus → impossible d'acheter des threads → nouveau crash.

**Sortie de secours — 3 mécanismes :**

**A. Circuit Breaker** (nouvelle upgrade, $200, requiert request_tracing)
- Bouton "Pause Marketing" dans le shop
- Désactive toutes les campagnes instantanément, gratuitement
- Laisse la queue se vider sans nouvel afflux
- Pédagogie : parfois il faut couper la croissance pour stabiliser

**B. Backlog Purge** (one-time use, $300)
- Vide la queue complètement (aucun revenu perdu, juste le backlog éliminé)
- Animation "aspiration" visible
- Pédagogie : sacrifier le backlog actuel pour récupérer est parfois la bonne décision

**C. Mercy Mode** (auto-trigger)
- Si `money < 100 AND queue > 60 AND 3+ crashes en 60s` :
- Désactive automatiquement le marketing pour 15s
- Vide les 30 requêtes les plus anciennes
- Message : "System auto-stabilized to prevent cascade failure"
- Pédagogie : les systèmes de prod ont des circuit breakers automatiques

### 2.6 Incidents aléatoires

8 événements aléatoires qui surviennent pendant la partie :

| Incident | Trigger | Durée | Effet | Résolution |
|----------|---------|-------|-------|------------|
| **Memory Leak** | 30–60s, si fibers actifs | 12s | +2% memUsed par tick | Auto (GC), ou $100 "Force GC" |
| **Viral Spike** | 40–90s, si marketing actif | 6s | Spawn rate ×3 | Auto (spike passe) |
| **DB Slow Query** | 45–100s, si DB requests > 30% | 8s | Phases I/O DB +50% | Auto |
| **GC Storm** | 50–120s, si fiberCount > 20 | 4s | CPU +30%, GVL +15% | Auto (réduire fibers) |
| **Ractor Deadlock** | 60–150s, si ractors + processes > 2 | 3s | Tous les threads stall | Auto (timeout Ruby) |
| **Thread Stack Overflow** | 70–180s, si threads > 8 | — | 1 thread crash définitif | Racheter un thread |
| **CPU Throttle** | 80–200s, si REPORT > 40% | 7s | CPU +25% global | Auto |
| **Network Cascade** | Rare (queue > 70 + latence > 10s) | 10s | 30% drop chance par tick | Auto quand queue < 40 |

**Pédagogie** : la prod est imprévisible. Headroom + monitoring préviennent les désastres.

### 2.7 Signaux d'alerte précoces

**Memory bar** : vert → jaune (60%) → orange (80%) → rouge (90%+), pulsation croissante.

**GVL Halo** : quand `gvlWaitPct > 60%`, aura violette sur les thread cards, intensité proportionnelle.

**Queue Gradient** : bordure verte → jaune (25 items) → orange (40) → rouge (50+).

**Latency Band** : nouvelle barre dans le header, "Median Wait: Xs", colorée (vert/jaune/orange/rouge).

**Crash Imminent** : si `memPct > 0.95` OU `queue > 75` OU `gvlWaitPct > 90%` pendant 3+ ticks → écran pulse rouge 1x/seconde + "System near critical — take action now".

---

## PARTIE 3 — ARC NARRATIF ET CONDITIONS DE FIN

### 3.1 Condition de victoire

**Objectif annoncé dès le départ, visible en permanence dans le header :**

> "🚀 Production Launch — Atteins 18 req/s pendant 60 secondes consécutives avec une latence médiane < 5s."

4 checkpoints intermédiaires (progression visible) :

| Checkpoint | Condition | Déverrouille |
|------------|-----------|--------------|
| ✅ Stable | Gérer 3 req/s sans crash pendant 30s | Accès Campaign II |
| ✅ Growing | Gérer 8 req/s avec GVL < 60% | Accès Campaign IV |
| ✅ Scaling | Gérer 12 req/s, uptime 100% pendant 30s | Accès Large VPS |
| ✅ Production | 18 req/s pendant 60s, latence < 5s | Victoire |

Pour atteindre 18 req/s avec latence < 5s, le joueur doit nécessairement utiliser au moins :
- Multi-process (pour le parallélisme CPU sur les PDFs)
- OU Fibers (pour l'I/O massif)
- OU Ractors (pour combiner les deux)

### 3.2 Conditions de game over

**Pas de game over brutal.** Toujours une fenêtre pour réagir.

**Game Over 1 — Faillite** : `money < 0` avec campagne active et aucune requête en cours. Message : "Vous avez accepté plus de trafic que votre infrastructure pouvait absorber. Résultat : les serveurs sont tombés et les clients sont partis."

**Game Over 2 — OOM Spiral** : 5 crashes OOM en moins de 60s. Message : "Votre serveur crashe en boucle. La mémoire est le nouveau goulot."

**Game Over 3 — Abandon client** : latence médiane > 20s pendant plus de 30s consécutives avec Campaign IV ou V active. Message : "Votre temps de réponse est catastrophique. Les utilisateurs ont quitté la plateforme."

Dans tous les cas : propose un "Restart" ou "Prestige" (si eligible).

### 3.3 Onboarding — les 3 premières minutes

Le jeu commence avec une queue qui grossit et rien pour la traiter. Aucun tutoriel texte. Seulement un message dans l'InfoPanel :

> **"Requests are piling up."**
> "Your server is live but has no threads yet. Add one to start handling traffic."
> [➕ Thread 1 — $100]

**Actions guidées (signalées visuellement) :**
1. Acheter Thread 1 → le bouton pulse jusqu'à ce que le joueur clique
2. Observer le premier request passer → message "Thread 1 is live! Watch the I/O phase (blue) release the GVL."
3. Ajouter Thread 2 → message "Thread 2 picks up while Thread 1 waits on DB."

**Actions libres dès T+60s :**
Après Thread 2, plus aucun guidage. Les upgrades sont visibles, le joueur explore.

### 3.4 Les 5 moments "aha!" — textes exacts

**Moment 1 : La saturation des threads** (après Thread 4)

> **"4 threads — saturated."**
> GET /users is 75% I/O — it saturates at exactly 4 threads.
> Thread 5 will sit idle. Watch it: no requests ever reach it.
>
> Adding threads only helps if you have I/O to fill them.
> Your next bottleneck is CPU — and that needs a different solution.

**Moment 2 : Le GVL under fire** (quand GVL% > 70% la première fois)

> **"The GVL is your real bottleneck now."**
> PDF exports spend 83% of their time on CPU. Every other thread must WAIT.
> This is the Global VM Lock — Ruby executes one thread's native code at a time.
>
> Adding threads won't fix this. You need parallelism at the process level.

**Moment 3 : Le premier fork** (après Process 2)

> **"You forked. Two GVLs, two CPUs."**
> Each process has its own GVL — no more contention between them.
> Watch two PDF exports run simultaneously for the first time.
>
> The cost: memory. Each fork duplicates the Ruby heap.
> This is Copy-on-Write — pages are shared until written, then private.

**Moment 4 : Fibers** (après Fiber Scheduler)

> **"One thread. Thousands of fibers."**
> Extra threads removed. Each process now runs 1 thread — but fibers handle all I/O concurrently.
>
> When a fiber hits a DB query, it yields instantly. The scheduler picks the next ready fiber.
> The OS registers all pending I/Os with epoll. The thread never blocks.
>
> CPU phases are different: cooperative scheduling means one fiber runs until it yields.
> A fiber that doesn't yield blocks all the others. Watch the red flash when a PDF runs.

**Moment 5 : Ractors** (après Ractors)

> **"Processes without the memory cost — almost."**
> Ractors are Ruby's answer to Erlang actors. Each has its own GVL.
> True CPU parallelism in a single process.
>
> The catch: no shared mutable state. Data must be serialized to cross Ractor boundaries.
> Watch the message-passing delay (+0.8ms) on every request.
>
> This is why Ractors aren't in production Puma yet.
> Great for CPU parallelism. Painful for stateful web apps.

### 3.5 Prestige — New Game+

Atteindre la condition de victoire → propose le prestige. Le joueur choisit **1 unlock permanent** :

| Unlock | Effet sur la prochaine partie |
|--------|-------------------------------|
| Fiber Scheduler | Démarrage avec Fibers actifs |
| Marketing Pipeline | Démarre avec Campaign I active (3 req/s baseline) |
| Memory Expert | GC pauses -50% en permanence |
| Process Veteran | Processes coûtent 20% moins |
| Ractor Pioneer | Ractors coûtent $1 500 au lieu de $2 500 |

**Meta-boucle :** chaque run révèle un chemin différent. Run 1 = découverte threads/GVL. Run 2 (avec Fibers unlock) = sauter la saturation, focus sur memory et processes. Run 3 = tout à la fois.

### 3.6 Écran de fin

Quand la condition de victoire est atteinte, pause du jeu et affichage :

```
🚀 Production Launch Complete!

Votre architecture finale :
  Processes : 2   Threads : 4   Fibers : 120   Ractors : off

Statistiques de la partie :
  Durée : 8min 32s    |    Requêtes complétées : 4 820
  Revenus totaux : $68 400    |    Crashes OOM : 1
  Peak throughput : 19.2 req/s    |    Dropped requests : 12

Ce que vous avez appris :
  ✅ Le GVL limite le parallélisme CPU à 1 thread par process
  ✅ Les processes donnent des GVL indépendants mais coûtent de la mémoire
  ✅ Les fibers multiplex l'I/O dans un seul thread (Falcon/Async)
  ✅ Les fibers coopératives sont sensibles aux CPU-hogs

En prod, Puma utilise N processes × M threads.
Falcon utilise 1 thread par process avec fibers.
Ractors restent expérimentaux (Ruby 3+).

[Prestige — New Game+]    [Partager mon score]    [Rejouer]
```

---

## PARTIE 4 — UX VISUEL ET FEEDBACK

### 4.1 Objectif visible en permanence

**Production Launch Gauge** — barre en top-center, toujours visible :

```
📈 Production Launch  ████████░░░░░░░░  42%
   $12.4k req/s · Objectif : 18 req/s × 60s · ETA : 4min 20s
```

Se remplit selon la progression vers les 4 checkpoints. ETA dynamique basée sur le throughput actuel. Pulse à 75%, 90%, 95%.

### 4.2 Server Health Indicator

Voyant composite (GVL × queue × mémoire) dans le header, toujours visible :

```
Health: ⚠️ DEGRADING   GVL: 72%  Queue: 35/50  RAM: 78%
```

| État | Condition | Couleur |
|------|-----------|---------|
| HEALTHY | Tout < 50% | Vert |
| DEGRADING | N'importe lequel 50–75% | Orange |
| CRITICAL | N'importe lequel > 75% | Rouge pulsant |

Message suggestif contextuel :
- GVL élevé → "Consider Fiber Scheduler or more Processes"
- Queue élevée → "Add threads or reduce marketing"
- RAM élevée → "Upgrade VPS or reduce thread count"

### 4.3 Header enrichi — déverrouillage progressif

**Tier 1 (toujours visible) :** Argent · Production Launch Gauge · Timer · Pause

**Tier 2 (après monitoring) :** GVL% avec couleur · Thread count

**Tier 3 (après throughput_graph) :** Req/min · Memory bar simple

**Tier 4 (après process_monitor) :** Server Health voyant · Queue counter · Dropped counter

### 4.4 Queue enrichie

```
┌─ Request Queue ─────────────────────────────┐
│ 3 / 50   •   Avg wait: 2.3s                 │
│  [🔵] GET /users      +$15  │ 1.2s          │
│  [🔷] GET /profile    +$15  │ 3.5s  ⚠️      │
│  [💠] POST /search    +$18  │ 6.1s  ❌       │
│  ────────────────────────────────────────── │
│  Dropped this minute: 2                     │
└─────────────────────────────────────────────┘
```

Chaque item : badge temps d'attente coloré (vert/jaune/orange/rouge). Compteur dropped en bas.

### 4.5 Toasts contextuels d'enseignement

6 overlays contextuels qui s'affichent une seule fois chacun (dismissibles, disparaissent après 8s) :

**GVL Saturation > 70% (première fois) :**
> "⚠️ GVL under strain. Why: threads compete for Ruby's execution lock. CPU phases are serialized. Fix: add Processes (separate GVL) or Fibers (cooperative, not lock-based)."

**Queue > 40 (première fois) :**
> "⚠️ Queue filling up. Requests older than 6s earn 50% reward. Older than 10s: 20%. Add threads or reduce marketing campaigns."

**Memory > 85% (première fois) :**
> "⚠️ OOM risk. Ruby processes are expensive: each fork costs 50MB. Fibers cost 0.5MB each. Consider Fiber Scheduler before adding more threads."

**Premier GVL_WAIT visible :**
> "Purple = GVL wait. This thread has work to do but another thread holds the lock. This is the Global VM Lock in action."

**Premier OOM crash :**
> "💥 Out of memory. Your server has reset. Memory isn't infinite — each thread, process and active request holds RAM. Upgrade your VPS or reduce capacity."

**Premier request dropped :**
> "🗑️ Request dropped. The queue was full — this request expired before any thread could pick it up. This is real: HTTP clients have timeouts."

### 4.6 Thread Cards — ajouts minimalistes

3 micro-éléments ajoutés sans clutter :

1. **Micro-throughput** (coin haut-droit) : "12/min" avec tendance ▲/▼, vert si actif, gris si idle
2. **Durée phase actuelle** : "1.2s" depuis le début de la phase en cours
3. **Sparkline historique** (bas) : 8 micro-carrés des 4 dernières secondes (couleur par état)

---

## PARTIE 5 — BOUCLES DE GAMEPLAY

### 5.1 Boucle courte (5–30 secondes)

**Visualiser le flux en temps réel :**
- Les requêtes entrent dans la queue comme des boules colorées (bleu=DB, jaune=checkout, rouge=PDF)
- L'assignation = animation de la boule qui "traverse" vers le thread
- La completion = boule qui "sort" avec un flash vert + $+X
- Plus on a de threads, plus l'écran s'anime et se vide

Chaque achat de thread est immédiatement visible dans l'animation. La satisfaction est instantanée.

**Micro-milestones de débit :**
- 25 req/min → badge "Warming Up"
- 50 req/min → badge "Productive"
- 100 req/min → badge "Efficient" + flash de couleur
- 200 req/min → badge "Scaling!"

### 5.2 Boucle moyenne (2–5 minutes)

**"Time to next purchase" visible en permanence :**
```
Next: Thread 4 ($150) · 8s away ████████░░
```
Barre de progression sous le header, mise à jour chaque seconde.

**Explosions de revenu :**
À chaque nouveau tier de Campaign ou déblocage de workload, un multiplicateur visible s'affiche :
- "+3 req/s → Revenue ×3! 🎉"
- "Fibers active → I/O throughput ×8! 🎉"

**Sentiment de progression :**
Le joueur achète quelque chose toutes les 30–90 secondes, et chaque achat a un effet visible immédiat.

### 5.3 Boucle longue — 3 actes

**Acte 1 : La Découverte du GVL (0–5 min)**
- Thread 1→4 : chaque thread = débit visible qui monte
- Thread 4 : "saturation" — le 5e thread ne fait rien
- Mixed Requests débloqués : GVL monte à 95%, le jeu change de nature
- Climax : "Plus de threads ne résout plus rien. Il faut une autre approche."

**Acte 2 : L'Échappée — choix de chemin (5–15 min)**
Trois voies divergentes, aucune n'est optimale :

| Voie | Avantage | Problème introduit |
|------|----------|-------------------|
| **Processes** | Vrai parallélisme CPU | Mémoire ×3 par process, OOM probable |
| **Fibers** | Légèreté, I/O massivement concurrent | CPU-hogs bloquent tout, stall visible |
| **Marketing heavy** | Revenu explosif | Infrastructure sur-sollicitée |

La mémoire devient ressource limitante pour la première fois.

**Acte 3 : L'Optimisation (15–25 min)**
Selon le chemin choisi, late-game upgrades différents s'ouvrent :
- Processes → Memory Profiler, GC Tuning, Process Recycling (puzzle mémoire)
- Fibers → gestion des CPU-stalls, Ractors
- Marketing heavy → Connection Pool, Cache, N+1 Detection

Un nouveau plafond physique est atteint. Prestige ou victoire.

### 5.4 Choix stratégiques réels

8 dilemmes sans réponse unique :

| # | Dilemme | Contexte | Leçon |
|---|---------|----------|-------|
| 1 | **Threads vs Processes** | $400 dispo, GVL > 70% | Parallélisme ≠ gratuit |
| 2 | **Marketing maintenant ou attendre ?** | Server à 80% capacité | Scaling avant trafic = gaspillage |
| 3 | **Fibers vs threads supplémentaires** | I/O bound workload | Coopératif ≠ free lunch |
| 4 | **GC Tuning ($100) ou un thread de plus ?** | Pauses visibles | GC = tradeoff perf/mémoire |
| 5 | **Process Recycling vs Large VPS** | Memory bloat progressif | Memory leak mitigation vs vrai fix |
| 6 | **Connection Pool ou Cache ?** | $200 budget | I/O vs computation bottleneck |
| 7 | **Ractors ($2 500) ou 2 processes supplémentaires ?** | Late game, CPU bound | Isolation vs overhead de messaging |
| 8 | **Prestige tôt ou continuer ?** | À $20k, 15min de jeu | Méta-progression vs run actuel |

### 5.5 Système de multiplicateurs visibles

Chaque thread card affiche son multiplicateur de contribution :

```
T1 [CPU] × 3.2  (optimal I/O ratio)
T2 [I/O]  × 1.0
Fibers: × 8.4 (I/O density bonus)
```

Total visible : "Current efficiency: 14.2× baseline"

Chaque upgrade fait monter ce nombre de façon visible et immédiate.

### 5.6 Méta-progression entre parties

| Run | Unlock gardé | Différence ressentie |
|-----|-------------|---------------------|
| 1 | — | Découverte totale |
| 2 | Fiber Scheduler | Skip saturation threads, focus processes/memory |
| 3 | Memory Expert | GC pauses disparaissent, attaque le Connection Pool |
| 4 | Ractor Pioneer | Ractors accessibles plus tôt, nouvelle stratégie |
| 5+ | Stack de 2 unlocks | Chaque run = combinaison unique |

---

## TABLEAU DE PRIORISATION

### Quick Wins (< 1 jour chacun)

| # | Changement | Impact | Effort |
|---|-----------|--------|--------|
| QW-1 | Argent départ → $800 | Critique | 5 min |
| QW-2 | Observabilité gratuite | Fort | 30 min |
| QW-3 | Queue overflow limit → 50 | Fort | 30 min |
| QW-4 | Pénalités latence (couleurs queue) | Fort | 2h |
| QW-5 | Production Launch Gauge dans le header | Critique | 3h |
| QW-6 | Nouveaux rewards ($15/$27/$45) | Moyen | 30 min |
| QW-7 | Coûts threads/VPS/campaigns ajustés | Fort | 30 min |
| QW-8 | Toast GVL + Queue overflow (1x each) | Fort | 4h |

### Medium (1–3 jours)

| # | Changement | Impact | Effort |
|---|-----------|--------|--------|
| M-1 | OOM crash renforcé (-money, marketing pause) | Fort | 1j |
| M-2 | Server Health Indicator composite | Fort | 1j |
| M-3 | Queue enrichie (latency badges, dropped counter) | Moyen | 1j |
| M-4 | 4 checkpoints intermédiaires vers la victoire | Critique | 2j |
| M-5 | Coût passif campagnes marketing | Moyen | 1j |
| M-6 | "Time to next purchase" bar | Moyen | 1j |
| M-7 | GVL strain degradation (CPU+20%) | Fort | 2j |

### Gros Reworks (1–2 semaines)

| # | Changement | Impact | Effort |
|---|-----------|--------|--------|
| R-1 | Condition de victoire + écran de fin | Critique | 1 sem |
| R-2 | Game over (3 conditions) | Fort | 3j |
| R-3 | Prestige / New Game+ | Très fort | 1 sem |
| R-4 | 5 incidents aléatoires (les plus simples) | Fort | 1 sem |
| R-5 | Arc narratif 5 actes (textes + triggers) | Fort | 3j |
| R-6 | Multiplicateurs visibles sur thread cards | Moyen | 3j |

---

## CE QUE LE JEU DOIT ENSEIGNER (north star)

À la fin d'une partie, le joueur doit pouvoir répondre à ces questions sans avoir lu de documentation :

1. Pourquoi ajouter des threads n'aide pas quand les requêtes sont CPU-bound ?
2. En quoi un process est différent d'un thread pour le GVL ?
3. Pourquoi les fibers sont légères mais dangereuses avec du CPU non-yielding ?
4. Quelle différence concrète entre Processes et Ractors ?
5. Pourquoi la mémoire est la vraie contrainte après le parallélisme ?
6. Qu'est-ce que Copy-on-Write après un fork ?

Si les mécaniques sont bien calibrées, ces réponses émergent du jeu lui-même — sans quiz ni tutorial.
