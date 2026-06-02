# Ruby/Rails Memory Reference

## Process (base RSS)

| App size        | Base memory |
|-----------------|-------------|
| Minimal Rails   | 150-200 MB  |
| Small SaaS      | 250-350 MB  |
| Medium monolith | 400-600 MB  |
| Large monolith  | 700 MB+     |

**Jeu** : 200 MB (small SaaS avec gems courantes — AR, Devise, Sidekiq, etc.)

## Thread

| Source              | Cost/thread |
|---------------------|-------------|
| OS stack (Linux)    | ~2 MB       |
| Ruby/Rails overhead | 8-15 MB     |
| Typical production  | 10-12 MB    |

**Jeu** : 18 MB (OS thread ~2 MB + Ruby overhead ~8 MB + DB connection ~8 MB)

## Fiber

| Source              | Cost/fiber  |
|---------------------|-------------|
| Ruby fiber stack    | 64-128 KB   |
| With I/O state      | 100-200 KB  |
| Practical estimate  | ~0.5 MB     |

**Jeu** : 0.5 MB (corrigé depuis 0.01 MB)

## Forked process (Copy-on-Write)

| Scenario                     | Shared memory |
|------------------------------|---------------|
| Right after fork             | ~100%         |
| After warmup (preload_app!)  | 65-75%        |
| Long-running under traffic   | 40-60%        |

Formule réelle : `Total = Base + (Workers - 1) × Base × (1 - shared%)`

**Jeu** : process_1 gratuit, process_2+ coûtent 50 MB (simplifié, pas de CoW modélisé)

## Request en cours

| Request type    | Peak memory |
|-----------------|-------------|
| Simple GET      | 5-15 MB     |
| DB query        | 10-30 MB    |
| Multi-query     | 20-50 MB    |
| Mixed (POST)    | 25-50 MB    |
| PDF generation  | 50-100 MB   |

**Jeu** : 20-70 MB selon le type (DB_REQUEST=20, MIXED=35, REPORT=70)

## VPS tiers (réels)

| Tier   | RAM    | Threads max approx |
|--------|--------|--------------------|
| Nano   | 512 MB | ~17 threads max théoriques, ~4-5 confortables avec requests |
| Small  | 1 GB   | ~45 threads max théoriques, ~15-20 confortables            |
| Medium | 2 GB   | ~100+ threads max théoriques, ~40 confortables             |
| Large  | 4 GB   | ~210+ threads max théoriques, ~90 confortables             |

*Calcul max théorique : (RAM - base_process) / thread_mem = (512-200)/18 ≈ 17*
*Calcul confortable : laisse ~30% marge pour les requêtes actives*

## Seuils d'alerte mémoire

| Zone     | % RAM  | Réaction typique              |
|----------|--------|-------------------------------|
| Normal   | < 75%  | Rien                          |
| Attention| 75-85% | Surveillance accrue           |
| Danger   | 85-95% | Restart programmé, upgrade VPS|
| OOM kill | > 95%  | Le kernel kill le process     |

Seuil d'alerte standard en prod : **80%** (ex: 409 MB / 512 MB sur Nano)

## Serveurs Rails (profil mémoire)

| Serveur  | Modèle        | Mémoire typique          |
|----------|---------------|--------------------------|
| Unicorn  | multi-process | 300 MB × N workers       |
| Puma     | multi-thread  | 350 MB + N × 10 MB       |
| Falcon   | fiber/async   | 300 MB + fibers × 0.1 MB |

## Garbage Collector

- GC pause stoppe **tous** les threads (MRI/YARV)
- Fréquence augmente avec le nombre d'allocations actives
- Fragmentation : un process grossit ~1-5% par heure sous charge
- `GC.compact` (Ruby 3.0+) peut récupérer 10-20% de mémoire fragmentée
- `jemalloc` réduit la fragmentation de ~30-50%
