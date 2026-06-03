# Ruby Concurrency Game — Roadmap & Research

## Progression des paliers

| Palier | Upgrade             | Enseigne                              | Statut              |
|--------|---------------------|---------------------------------------|---------------------|
| 1      | Threads             | GVL contention                        | ✅ Fait             |
| 2      | Background Jobs     | Sortir le CPU du thread web           | ❌ À faire          |
| 3      | Processes           | Vrai parallélisme, coût mémoire       | ✅ Fait             |
| 3.5    | Memory              | La mémoire est une ressource à gérer  | 🔶 Partiel          |
| 4      | N+1 Detection       | Identifier les requêtes cachées       | ❌ À faire          |
| 5      | Connection Pool     | Saturation DB                         | ❌ À faire          |
| 6      | Cache               | Éviter le travail répété              | ❌ À faire          |
| 7      | Load Balancer       | Limites d'un seul serveur             | ❌ À faire          |
| 8      | Fibers              | Légèreté vs coopération               | 🔶 Partiel          |
| 9      | Ractor              | Isolation = overhead                  | ❌ À faire          |
| ★      | JRuby               | Le GVL n'existe plus                  | ❌ À faire          |

### Détail des statuts

**Palier 1 ✅ Fait**
- Threads avec GVL contention (idle / cpu / io / gvl_wait)
- Types de requêtes : DB, Profile, Multi-query, Checkout, PDF Report
- Monitoring : Request Tracing, Memory Meter, Monitoring (GVL%), Throughput Graph, Memory Profiler, Process Monitor
- Traffic : Marketing campaigns I→V (1→18 req/s)
- VPS upgrades nano→large (512MB→4GB, 1→8 vCPU)
- Pause feature (Space / bouton)

**Palier 3 ✅ Fait**
- Multi-process avec ProcessHeader et groupes visuels
- Contrainte vCPU : impossible d'acheter un process sans assez de cores
- Coût mémoire par process (PROCESS_MEM = 50 MB)
- GVL indépendant par process (pas de contention croisée)

**Palier 3.5 🔶 Partiel — implémenté :**
- Memory Meter avec barre lerp + breakdown détaillé (base / processes / threads / fibers / requests)
- Memory Profiler upgrade ($80)

**Palier 3.5 ❌ Manquant :**
- GC pauses visibles (flash qui gèle les threads d'un process)
- Memory Bloat progressif par process (croissance non-linéaire)
- CoW indicator (mémoire partagée vs private)
- Bouton "Restart Process" avec downtime
- Upgrade GC Tuning ($100), jemalloc ($120), Process Recycling ($110)

**Palier 8 🔶 Partiel — implémenté :**
- Fiber Scheduler upgrade ($250)
- Visualisation fiber dans ThreadCard : active fibers + ready queue animée
- Scheduling coopératif visible (phases I/O vs CPU)
- Memory breakdown fibers (FIBER_MEM = 0.5 MB/fiber)

**Palier 8 ❌ Manquant :**
- "Global Stall" flash quand une fiber CPU-block sans yield bloque toutes les lanes
- Compteur de fibers actives visible sur la carte (actuellement limité à ACTIVE_MAX_ROWS=10)

---

## Entités à implémenter (détail)

### Palier 2 — Background Jobs (Sidekiq)
**Problème résolu** : Les requêtes REPORT (90% CPU) bloquent le thread web ET le GVL pendant 8s. Un job Sidekiq sort ça du thread.

**Nouvelles entités visuelles** :
- Zone "Worker Queue" séparée des threads web
- Cartes worker distinctes (couleur différente)
- Compteur jobs en attente dans la queue
- Les requêtes REPORT sont envoyées dans la queue plutôt que traitées inline
- Le thread web se libère immédiatement (retour `202 Accepted`)

**Nouveau problème introduit** : Les workers ont aussi leur propre GVL → contention déplacée, pas supprimée. C'est le moment pédagogique clé.

**Mécanique** :
- Upgrade "Sidekiq Workers" ($150) déblocable après avoir acheté PDF Reports
- Achat de workers dédiés ($100 chacun, max 4)
- Séparation visuelle web threads / worker threads dans le layout

---

### Palier 3 — Processes (Unicorn/Puma multi-process)
**Problème résolu** : Chaque process a son propre GVL → vrai parallélisme CPU. 2 processes = 2x débit sur CPU.

**Nouvelles entités visuelles** :
- "Boîtes process" isolées visuellement des threads
- Zéro GVL-wait entre processes
- Memory bar qui monte en flèche (+3x par process)
- Indicateur "mémoire partagée impossible"

**Nouveau problème introduit** : Pas de mémoire partagée, communication inter-process coûteuse, limite mémoire atteinte bien plus vite.

**Mécanique** :
- Unlock "Multi-process Mode" ($150, nécessite 4 threads)
- Chaque process coûte 3x la mémoire d'un thread
- Possibilité d'avoir seulement 2-3 processes avant de toucher le plafond RAM
- Les requêtes CPU ne font plus de GVL-wait (c'est le wow moment)

---

### Palier 3.5 — Memory
**Problème résolu** : La mémoire est invisible jusqu'à ce qu'elle explose. Après les processes (qui coûtent 3x), le joueur doit comprendre que la mémoire est une ressource à piloter activement, pas juste un plafond.

**Concepts enseignés** :
- Chaque process/thread a un coût mémoire fixe **et** un coût croissant (garbage, objets vivants)
- GC (Garbage Collector) libère de la mémoire mais cause des **pauses visibles**
- Copy-on-Write : les processes forkés partagent la mémoire tant qu'ils n'écrivent pas → économie initiale, mais dégradation progressive
- Memory leak : un process qui tourne longtemps accumule des objets non collectés → bloat progressif
- `GC.compact` / heap compaction : fragmentation réduite, mais pause coûteuse

**Nouvelles entités visuelles** :
- Graphe mémoire par process (croissance progressive, pas linéaire)
- Icône "GC pause" : flash bref pendant lequel tous les threads du process sont gelés
- Indicateur "Memory Bloat" par process : barre qui monte avec le temps
- Bouton "Restart Process" : remet la mémoire à zéro mais cause 1-2s de downtime
- CoW indicator : montre la mémoire partagée vs private d'un process forké
- Alerte "Heap fragmentation" quand mémoire utilisée ≠ mémoire allouée

**Mécaniques** :
- Upgrade "Memory Profiler" ($90) : rend visible la consommation mémoire par process en temps réel
- Upgrade "GC Tuning" ($100) : réduit la fréquence des pauses GC de 30%, au prix d'un peu plus de RAM
- Upgrade "jemalloc" ($120) : meilleur allocateur, réduit la fragmentation de ~20%, GC pauses plus courtes
- Upgrade "Process Recycling" ($110, nécessite Processes) : recycle automatiquement un process après N requêtes pour éviter le bloat progressif → brief downtime visible
- Mécanique "RAM Upgrade" ($200) : augmente `MEM_MAX`, permet plus de threads/processes

**Nouveau problème introduit** :
- Recycler trop souvent = downtime fréquent
- GC trop agressif = pauses visibles qui gèlent les threads
- Memory leak non traité = OOM crash du process (game over moment)

**Positionnement dans la progression** :
Placé après Processes car c'est là que le coût mémoire devient concret (3x par process). Le joueur vient de débloquer processes et découvre que la RAM devient le nouveau plafond.

---

### Palier 4 — N+1 Detection
**Problème résolu** : Requêtes qui escaladent de O(1) à O(N) en fetching imbriqué. Invisible jusqu'à ce qu'on ait du monitoring.

**Nouvelles entités visuelles** :
- Panel "Query Profiler" montrant le nombre de requêtes par request
- Requêtes N+1 surlignées en rouge (ex: "51 queries pour 1 request")
- Après optimisation : animation "collapse" de 51 queries → 2

**Nouveau problème introduit** : Eager loading charge tout en mémoire d'un coup → spike mémoire.

**Mécanique** :
- Unlock "N+1 Detection" ($180, nécessite Monitoring)
- Révèle des requêtes cachées qui ralentissaient silencieusement
- Player peut "optimiser" les patterns N+1 détectés → réduction du I/O time
- Trade-off : eager load = mémoire, lazy = queries

---

### Palier 5 — Connection Pool (PgBouncer)
**Problème résolu** : Chaque thread ouvre sa propre connexion DB → saturation des connexions Postgres avec beaucoup de threads/processes.

**Nouvelles entités visuelles** :
- Compteur "DB Connection Slots" (comme les thread slots mais pour la DB)
- Slots colorés : vert (libre), bleu (utilisé), rouge (en attente)
- Graphe : throughput plateau atteint quand threads > connexions disponibles

**Nouveau problème introduit** : Contention sur le pool lui-même, latence du pooler (+1-2ms/query).

**Mécanique** :
- Upgrade "Connection Pool" ($95)
- Réduit le I/O phase time de ~20%
- Ajoute métrique "Pool Exhaustion %" visible
- Si threads > pool_size → requests attendent une connexion slot

---

### Palier 6 — Cache Layer (Redis)
**Problème résolu** : Requêtes DB identiques répétées → le cache évite le travail.

**Nouvelles entités visuelles** :
- Icône Redis dans le data flow
- Request cards avec "💾 cache hit" (instant) vs "cache miss" (DB hit)
- Graphe "Cache Hit Rate %"
- Thundering herd visible quand le cache expire

**Nouveau problème introduit** : Invalidation du cache, cold start, mémoire supplémentaire.

**Mécanique** :
- Upgrade "Redis Cache" ($200, nécessite Connection Pool)
- Slider TTL : court = données fraîches mais misses fréquents, long = hit rate élevé mais données stales
- Thundering herd : quand cache expire sur hot query → spike DB visible

---

### Palier 7 — Load Balancer + 2ème serveur
**Problème résolu** : Un seul serveur a des limites physiques. Distribution sur 2 serveurs multiplie la capacité.

**Nouvelles entités visuelles** :
- Deuxième bloc "serveur" avec ses propres threads
- LB visible qui distribue les requêtes (animation routing round-robin)
- Memory × 2, throughput × 2

**Nouveau problème introduit** : Pas de session sticky, synchronisation d'état.

**Mécanique** :
- Upgrade "Load Balancer" ($400)
- Achat de serveurs supplémentaires ($300 chacun, max 3)
- Requêtes split aléatoirement entre serveurs
- Unlock "Redis Session Store" ($150) pour vrai scaling horizontal

---

### Palier 8 — Fiber Pool
**Problème résolu** : Des milliers de fibers dans 1 seul thread = très faible empreinte mémoire pour de l'I/O massif.

**Nouvelles entités visuelles** :
- Thread card transformée : micro-lanes empilées (~100 slots)
- Fibers grises sur I/O wait, réactivation instantanée
- Zéro idle time sur le thread
- Flash rouge si une fiber CPU-block sans yield → toutes les lanes gèlent

**Nouveau problème introduit** : Scheduling coopératif = un seul mauvais acteur bloque tout.

**Mécanique** :
- Upgrade "Fiber Pool" ($300, nécessite Mixed Workload maîtrisé)
- I/O phases ne bloquent plus le thread
- Mais : requêtes CPU heavy sans yield = "Global Stall" visible
- Memory cost minimal (+20MB pour tout le pool)

---

### Palier 9 — Ractor (Ruby 3+)
**Problème résolu** : Vrai parallélisme comme les processes mais plus léger. Chaque Ractor a son propre GVL.

**Nouvelles entités visuelles** :
- Bulles isolées translucides (distinct des thread cards)
- Paquets animés voyageant entre bulles (coût sérialisation visible)
- Warning icons pour gems incompatibles

**Nouveau problème introduit** : Pas d'état partagé mutable, sérialisation coûteuse, écosystème limité.

**Mécanique** :
- Upgrade "Ractor Pool" ($250, late-game)
- CPU requests scale avec le nombre de Ractors
- Message passing animé = delay visible (enseignement overhead)
- Certaines requêtes montrent icône "incompatible" (RNG)

---

### ★ Prestige — JRuby
**Problème résolu** : Zéro GVL. Threads = vrais threads Java.

**Nouvelles entités visuelles** :
- Threads labellisés [JVM], aucun bloc violet
- Compteur GVL-wait = 0 permanent
- Baseline mémoire +150MB (JVM runtime)

**Mécanique** :
- "New Game+" — repart de zéro sans GVL
- Threads scale linéairement jusqu'à 16
- L'aha moment : tout ce qu'on a appris sur la contention disparaît

---

## Sources de recherche (agents)

### Agent 1 — GVL Escape Hatches
Patterns : Processes, C Extensions, Fiber Scheduler/Async, Ractor, JRuby, TruffleRuby, Processes+Fibers combo.
Points clés :
- Fiber scheduler = coopératif, un CPU sans yield = freeze général
- Ractor = message passing overhead, frozen object serialization
- JRuby = new game+, truly remove the GVL
- Combo Processes+Fibers = late-game ultimate architecture

### Agent 2 — Background Jobs
Patterns : Async Job Offloading, Job Priorities, Fiber concurrency in workers, Delayed Jobs, Batching, Rate Limiting, Circuit Breaker, Bulkhead, Adaptive Concurrency, Work Stealing, Timeouts, Retries, Dead Letter Queue, Idempotency, Pipeline Jobs, Fair Queuing, Predictive Scaling.
Points clés :
- Offloading ne supprime pas le GVL, le déplace vers les workers
- Circuit breaker = fail fast, prévient cascade
- Work stealing = pas de queue idle, mais coordination overhead
- Batching = efficacité mais latence + partial failure risk

### Agent 3 — DB & I/O Scaling
Patterns : Connection Pooling, Read Replicas, N+1 Detection, DB Caching (Redis), Pagination, Query Optimization/Indexes, Async I/O/Fibers, Query Streaming, Bulk Inserts, Prepared Statements, Write-through/Write-behind, Circuit Breaker, Failover, Compression, Vacuum/Autovacuum, Replication Lag.
Points clés :
- N+1 = invisible jusqu'au monitoring, O(1) → O(N) requêtes
- Connection pool = première optimisation DB à faire
- Thundering herd sur cache expiry = problème classique
- Async fibers + DB = massive I/O concurrency, mais CPU toujours GVL-bound

### Agent 4 — Alternative Runtimes
(voir Agent 1 — même scope)

### Agent 5 — Web Server & Load Balancing
Patterns : Puma multi-threaded, Unicorn multi-process, Passenger hybrid, LB Round-Robin, LB Least-Connections, LB Request Queue, Nginx reverse proxy, HTTP Keep-Alive, Connection Pooling, Process Recycling, GC Tuning, CDN/Static Caching, Request Deduplication, Graceful Degradation, Adaptive Threading, Redis Shared Cache, Probabilistic Tracing.
Points clés :
- Unicorn = process isolation, mémoire 3x, CoW partial benefit
- Nginx buffering = libère le thread web des slow clients
- Process recycling = memory leak mitigation, pas un vrai fix
- Graceful degradation = circuit breaker au niveau serveur
