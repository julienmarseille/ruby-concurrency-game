# Ruby Ractors — Documentation exhaustive

> Recherche approfondie sur le fonctionnement interne des Ractors, leur place dans la chaîne Process → Ractor → Thread(s) → Fiber, et les implications pour la modélisation dans le simulateur.

---

## Table des matières

1. [Contexte : le problème que Ractor résout](#1-contexte)
2. [Qu'est-ce qu'un Ractor ?](#2-quest-ce-quun-ractor)
3. [Hiérarchie complète : Process → Ractor → Thread(s) → Fiber](#3-hiérarchie)
4. [Le GVL par Ractor — comment ça marche vraiment](#4-gvl-par-ractor)
5. [Objets partageables vs non-partageables](#5-shareability)
6. [Message passing : send/receive et yield/take](#6-message-passing)
7. [Sérialisation : le coût réel](#7-sérialisation)
8. [Fibers à l'intérieur des Ractors](#8-fibers-dans-ractors)
9. [Cycle de vie d'un Ractor](#9-cycle-de-vie)
10. [Gestion des erreurs et crash](#10-gestion-des-erreurs)
11. [Intégration avec les serveurs web](#11-serveurs-web)
12. [Profil de performance](#12-performance)
13. [Incompatibilités et gems](#13-incompatibilités)
14. [Implémentation C interne (vm_core, ractor.c)](#14-internals-c)
15. [Edge cases et pièges](#15-edge-cases)
16. [Implications pour le simulateur de jeu](#16-implications-jeu)

---

## 1. Contexte

Ruby a toujours eu le GVL (Global VM Lock) : un seul mutex qui empêche deux threads du même process d'exécuter du bytecode Ruby simultanément. Résultat :

- **IO-bound** : les threads fonctionnent bien — pendant qu'un thread attend une réponse DB, il libère le GVL et un autre peut tourner.
- **CPU-bound** : catastrophique — 4 threads sur 4 cores = performance d'1 core. Le GVL sérialise tout.

Les processes contournent ça (chaque process a son propre GVL) mais au prix d'une mémoire triplée (fork + CoW) et sans partage d'état.

**Ractor (Ruby 3.0, 2020)** est la réponse : isoler l'état pour pouvoir supprimer le GVL par unité d'exécution, tout en restant dans le même process.

---

## 2. Qu'est-ce qu'un Ractor ?

Un Ractor est une **unité d'exécution concurrente et isolée** au niveau de la VM Ruby. Concrètement :

- C'est un **objet Ruby** (`Ractor.new { ... }`)
- Il tourne sur un **OS thread dédié** en interne
- Il possède son **propre GVL** (mutex C indépendant)
- Il **ne partage pas d'état mutable** avec les autres Ractors
- Il communique **exclusivement par message passing**

```ruby
r = Ractor.new do
  # Ce code tourne en parallèle, sans contention GVL
  sum = 0
  1_000_000.times { |i| sum += i }
  sum
end

result = r.take  # => 499999500000
```

**Ce que Ractor N'est PAS :**
- Ce n'est pas un process (pas de fork, pas d'isolation mémoire OS)
- Ce n'est pas un thread classique (pas d'accès à l'état partagé)
- Ce n'est pas une fiber (pas coopératif, vrai parallélisme)

---

## 3. Hiérarchie

```
OS Process
  ├─ Ractor 1 (main Ractor — démarre avec le process, GVL propre)
  │    ├─ Thread 1 (main thread de ce Ractor)
  │    │    └─ Fibers (coopératifs, dans ce thread)
  │    └─ Thread N (les threads au sein d'un même Ractor partagent son GVL — pas de parallélisme entre eux)
  │
  ├─ Ractor 2 (son propre GVL — tourne en VRAI parallèle avec Ractor 1)
  │    └─ Thread(s)
  │         └─ Fibers
  │
  └─ Ractor N...
```

**Correction importante par rapport aux idées reçues :**

Ractor ne se niche PAS à l'intérieur d'un Thread. C'est l'inverse : **chaque Ractor contient un ou plusieurs Threads** qui partagent le GVL de ce Ractor. Source : documentation officielle Ruby 3.4 — *"Each Ractor contains one or more threads that share a Ractor-wide global lock like GIL. Threads within a single Ractor cannot execute in parallel."*

Les Threads au sein d'un même Ractor se disputent toujours le GVL *de ce Ractor*. Mais deux Threads appartenant à des Ractors différents peuvent s'exécuter sur deux cœurs en même temps, car chaque Ractor a son propre mutex indépendant.

**Relation Ractor ↔ Thread OS :**

Chaque Thread Ruby (qu'il soit dans Ractor 1 ou Ractor 2) correspond à un thread OS (`pthread`). Le scheduler Ruby (`thread.c`) gère ces threads. La distinction clé : les threads du même Ractor se disputent *son propre* mutex C (`rb_mutex_t` dans `ractor.c`), pas un lock global. Donc deux threads dans deux Ractors distincts peuvent exécuter du bytecode Ruby *en même temps* sur deux cœurs différents.

**Position dans la chaîne :**

| Niveau      | Isolation       | Parallélisme CPU | Mémoire partagée | Coût création |
|-------------|-----------------|------------------|------------------|---------------|
| Process     | Complète (OS)   | ✅ Oui           | ❌ Non (CoW)     | ~10-50ms      |
| Ractor      | État mutable    | ✅ Oui (entre Ractors) | ⚠️ Objets immuables seulement | ~1-5µs (≈ thread) |
| Thread Ruby | Aucune          | ❌ Non (GVL Ractor) | ✅ Oui (dans le Ractor) | ~1-5µs |
| Fiber       | Aucune          | ❌ Non           | ✅ Oui           | < 1µs         |

> **Note coût Ractor :** La documentation officielle Ruby 3.4 précise que *"creation overhead approximates that of a single thread"*. Le coût de ~100-500µs cité parfois correspond à la **sérialisation du premier message** (deep copy de la requête), pas à la création du Ractor.

---

## 4. Le GVL par Ractor

### Comment ça marche vraiment

Dans `ractor.c` (source Ruby), chaque Ractor contient :

```c
struct rb_ractor_struct {
    rb_ractor_sync_t    sync;          // mutex + condition variable
    struct rb_ractor_id id;
    enum rb_ractor_status status;      // created, running, blocking, terminated
    // ...
    struct ccan_list_head living_threads; // threads OS appartenant à ce Ractor
}
```

Quand un Ractor démarre, il acquiert son `sync.lock` (son propre GVL). Pendant qu'il tourne, les autres Ractors peuvent acquérir *leurs* locks indépendamment. Il n'y a plus de lock global.

### Ce qui reste sérialisé — les 42 locks globaux résiduels

**Point critique (byroot, février 2025)** : Ruby 3.0 a introduit les GVL par Ractor, mais il reste **42 appels `RB_VM_LOCK_ENTER()`** dans le VM qui acquièrent un lock *global* — bloquant **tous** les Ractors simultanément, pas seulement le courant.

Exemple concret : la table des strings internées (`register_fstring()` dans `string.c`). Chaque fois qu'un Ractor parse du JSON avec des clés string, il appelle `register_fstring()` qui fait :

```c
RB_VM_LOCK_ENTER();
// vérifie si la string est déjà internée
RB_VM_LOCK_LEAVE();
```

Sur un document JSON `{"a":1,"b":2,"c":3,"d":4}` parsé 1 million de fois → **4 millions d'acquisitions de lock global** par Ractor. Avec 5 Ractors en parallèle, la contention est pire que séquentiel.

Conséquence directe sur les benchmarks :

| Workload                     | Séquentiel | 5 Ractors | Speedup |
|------------------------------|------------|-----------|---------|
| Fibonacci récursif (CPU pur) | 2.26s      | 0.68s     | **+3.3x** |
| JSON parsing (string keys)   | 1.29s      | 3.19s     | **-2.5x** |

Les Ractors n'accélèrent **que** les workloads sans appels de VM globaux. Le moindre parsing de strings peut inverser le gain.

Le GC (Garbage Collector) est aussi encore partiellement global en Ruby 3.0-3.1. En Ruby 3.2+, chaque Ractor a son propre cache d'allocation d'objets (`newobj_cache`), ce qui réduit la contention GC. Mais un GC majeur peut encore provoquer une pause sur tous les Ractors.

### Comparaison avec les threads

```ruby
# Threads : GVL unique — ces deux boucles s'alternent, ne tournent pas en parallèle
t1 = Thread.new { 10_000_000.times { |i| i * 2 } }
t2 = Thread.new { 10_000_000.times { |i| i * 3 } }
# Temps ≈ séquentiel sur CPU-bound

# Ractors : GVL par Ractor — vraiment en parallèle
r1 = Ractor.new { 10_000_000.times { |i| i * 2 } }
r2 = Ractor.new { 10_000_000.times { |i| i * 3 } }
# Temps ≈ 2x plus rapide sur 2 cores (réel)
```

Benchmark officiel Ruby 3.0 — fonction `tak` récursive sur 4 cores :
- 1 Ractor  : 1.00x (référence)
- 2 Ractors : 1.90x
- 4 Ractors : 3.87x

---

## 5. Shareability

C'est LE concept central de Ractor. L'isolation est garantie par le compilateur/runtime : si un objet mutable peut être accédé depuis deux Ractors, Ruby lève une exception.

### Objets toujours partageables (shareable by default)

- Entiers, floats, symboles, `nil`, `true`, `false`
- Classes, modules (le code est partageable, pas les instances)
- Méthodes, procs gelés
- Instances de Ractor elles-mêmes

### Objets non-partageables (par défaut)

- Strings mutables
- Arrays, Hashes mutables
- Instances de classes custom non gelées
- IO, File handles, sockets, connexions DB

### Rendre un objet partageable

**Méthode 1 : Freeze**
```ruby
str = "hello".freeze          # frozen? => true => shareable
arr = [1, 2, 3].freeze        # freeze superficiel — les éléments restent mutables!

# Piège : freeze ne gèle pas récursivement
arr_nested = [[1, 2], [3, 4]].freeze
arr_nested[0] << 99           # Fonctionne! arr_nested[0] n'est pas frozen
```

**Méthode 2 : Ractor.make_shareable**
```ruby
data = { users: ["Alice", "Bob"], config: { timeout: 30 } }
shared = Ractor.make_shareable(data)
# Parcourt récursivement TOUT le graph d'objets et freeze tout
# Complexité O(n) où n = nombre d'objets dans le graph

shared[:users] << "Charlie"   # FrozenError — recursive freeze
```

**Méthode 3 : Move semantics (transfert de propriété)**
```ruby
data = [1, 2, 3, 4, 5]
r = Ractor.new(data, move: true) do |received|
  received  # Reçoit les données, devient propriétaire
end

data << 6  # Ractor::MovedObject — l'objet a été transféré, plus accessible ici
```

Move semantics : O(1), pas de copie, mais l'original devient inaccessible. Utile pour passer de gros objets sans coût de copie.

---

## 6. Message Passing

### Modèle Push : send / receive

```ruby
worker = Ractor.new do
  loop do
    job = Ractor.receive        # Bloque jusqu'à réception
    result = process(job)
    Ractor.yield(result)        # Publie le résultat
  end
end

worker.send({ type: :compute, data: [1, 2, 3] })
result = worker.take
```

### Modèle Pull : yield / take

```ruby
producer = Ractor.new do
  (1..5).each { |i| Ractor.yield(i) }  # Publie des valeurs
end

5.times { puts producer.take }  # Consomme une par une
```

### Multiplexage : Ractor.select

```ruby
r1 = Ractor.new { sleep 1; "slow" }
r2 = Ractor.new { sleep 0.1; "fast" }

# Attend le premier qui termine
ractor, value = Ractor.select(r1, r2)
# value => "fast", immédiatement

# select peut aussi écouter l'inbox du Ractor courant
Ractor.select(r1, r2, Ractor)  # Ractor = inbox courante
```

### Pipeline

```ruby
# Classique pattern acteur en pipeline
fetcher = Ractor.new do
  5.times { |i| Ractor.yield({ id: i, raw: "data_#{i}" }) }
end

parser = Ractor.new(fetcher) do |src|
  loop { Ractor.yield(src.take[:raw].upcase) }
end

5.times { puts parser.take }
# => DATA_0, DATA_1, DATA_2, DATA_3, DATA_4
```

### Interne : files de messages

Dans `ractor.c`, chaque Ractor a deux queues :
- **Inbox** (`recv_queue`) : reçoit les `send()` d'autres Ractors
- **Outbox** (`yield_queue`) : publie via `Ractor.yield()`, consommée par `take()`

Les queues sont implémentées avec des mutex C + condition variables (`pthread_cond_wait`). Un Ractor en `receive` bloque sur la condition variable de son inbox ; un `send` signale cette condition.

---

## 7. Sérialisation — le coût réel

C'est là que se trouve le coût pédagogique clé pour le jeu.

### Deep copy (comportement par défaut)

Quand on envoie un objet non-shareable à un Ractor, Ruby en fait une copie profonde :

```ruby
data = { users: Array.new(10_000) { "user_#{_1}" } }
r = Ractor.new(data) { |d| d }  # Copie tout le tableau de 10k strings
```

Implémentation C : `rb_obj_traverse()` dans `object.c` parcourt le graph d'objets et appelle `rb_obj_clone()` sur chaque nœud. Coût : **O(n)** en temps et en mémoire, où n est la taille du graph. Pour un objet de 1 MB, la copie peut prendre plusieurs centaines de µs.

### Move (transfert O(1))

```ruby
# Transfert de propriété — l'original est invalidé
Ractor.new(large_data, move: true) { |d| d }
```

Implémentation : dans `ractor.c`, l'objet reçoit le flag `Ractor::MovedObject`. Toute tentative d'accès dans le thread émetteur lève `Ractor::MovedObject`.

### Frozen / shareable (O(1), zéro copie)

```ruby
FROZEN_CONFIG = { timeout: 30, retries: 3 }.freeze
r = Ractor.new { FROZEN_CONFIG[:timeout] }  # Pas de copie, accès direct
```

### Récapitulatif des coûts

| Stratégie        | Coût temps | Coût mémoire | Original accessible |
|------------------|------------|--------------|---------------------|
| Deep copy        | O(n)       | +n           | Oui                 |
| Move (transfer)  | O(1)       | 0            | Non                 |
| Frozen/shareable | O(1)       | 0            | Oui (lecture seule) |
| Marshal.dump     | O(n) + overhead Marshal | +n | Oui          |

Pour le simulateur : la phase `serialize` visible visuellement correspond à ce deep copy. Elle vaut ~100-500µs pour un objet de taille requête typique.

---

## 8. Fibers dans les Ractors

Les Fibers fonctionnent normalement à l'intérieur d'un Ractor. Chaque Ractor peut avoir son propre Fiber Scheduler. C'est le pattern **Ractor + Fiber Scheduler = architecture ultime Ruby** (Falcon + Ractors théorique).

```ruby
# Chaque Ractor peut faire tourner des fibers en interne
r = Ractor.new do
  scheduler = MyFiberScheduler.new
  Fiber.set_scheduler(scheduler)

  fibers = 100.times.map do
    Fiber.new { fetch_from_db }  # IO non-bloquant via scheduler
  end

  fibers.each(&:resume)
end
```

**Ce qui ne marche PAS :**
- Une Fiber ne peut pas passer d'un Ractor à un autre
- Les Fibers sont locales à leur Ractor (et à leur thread OS)

**Implication pour le simulateur :**
Les Ractors et les Fibers sont orthogonaux. Dans le jeu, si l'utilisateur a acheté Fiber Scheduler, chaque Ractor pourrait aussi avoir des fibers — mais c'est une complexité de palier 9+.

---

## 9. Cycle de vie d'un Ractor

```
Ractor.new { ... }
    │
    ▼
  :created ──► :running ──► :blocking ──► :running ──► :terminated
                               │
                    (Ractor.receive, take sur Ractor vide)
```

```ruby
r = Ractor.new { Ractor.receive }

r.status  # => :blocking (attend un message)
r.send("hello")
r.status  # => :running (traite le message)
r.take    # => "hello"
r.status  # => :terminated
```

**Fermeture explicite :**
```ruby
r.close_incoming  # Plus de send() possible → RactorClosedError
r.close_outgoing  # Plus de take() possible
```

**Pas de `Ractor.kill` :** Contrairement aux threads, on ne peut pas forcer la terminaison d'un Ractor. Si une fiber / boucle infinie bloque le Ractor, il faut tuer le process entier.

---

## 10. Gestion des erreurs

### Exception dans un Ractor

```ruby
r = Ractor.new { raise "boom" }

begin
  r.take
rescue Ractor::RemoteError => e
  e.cause   # => #<RuntimeError: boom>  — l'exception originale
  e.ractor  # => l'instance Ractor qui a crashé
end
```

L'exception est "emballée" dans `Ractor::RemoteError` et remontée au `take()`. Le Ractor est terminé (`status: :terminated`). Les autres Ractors ne sont pas affectés.

### Deadlock entre Ractors

Ruby 3.1+ détecte les deadlocks entre Ractors :

```ruby
r1 = Ractor.new(Ractor.current) { |main| main.take }
r1.take  # Ractor::DeadlockError — cercle d'attente détecté
```

---

## 11. Intégration avec les serveurs web

### État actuel (Ruby 3.3/4.x)

**Puma :** support expérimental. Un worker Puma peut spawner des Ractors pour les requêtes CPU-bound (génération de PDF, calculs). Pas encore de mode "Ractor-first".

**Falcon :** orienté Fiber Scheduler, orthogonal aux Ractors. Combinaison possible en théorie.

**Unicorn :** fork-based, orthogonal. Chaque worker Unix pourrait utiliser des Ractors.

### Le problème fondamental avec Rails / ActiveRecord

Rails est bourré d'état mutable global : `Thread.current`, `ActiveRecord::Base.connection`, les caches de routes, les callbacks. Tout ça n'est pas Ractor-safe.

```ruby
# Ceci plante avec Ractors
class ApplicationController < ActionController::Base
  def index
    @users = User.all  # ActiveRecord::Base.connection = état global mutable
  end
end
```

**Solutions possibles (futures) :**
- Connexion DB isolée par Ractor
- Caches immuables partagés (`Ractor.make_shareable`)
- Pas encore en production

### Cas d'usage réaliste aujourd'hui

```ruby
# Tâches CPU-bound en parallèle (génération de rapport, calculs)
class ReportWorker
  TEMPLATE = Ractor.make_shareable(File.read("template.html"))

  def self.generate(data_ids)
    ractors = data_ids.map do |id|
      Ractor.new(id, TEMPLATE) do |id, tmpl|
        render_pdf(fetch_data(id), tmpl)  # fetch_data doit être Ractor-safe
      end
    end
    ractors.map(&:take)
  end
end
```

---

## 12. Performance

### Benchmarks — la réalité contrastée

**Fibonacci récursif (CPU pur, byroot 2025) :**

```ruby
def fibonacci(n)
  n <= 1 ? n : fibonacci(n - 1) + fibonacci(n - 2)
end
```

| Configuration           | Temps   | Speedup |
|-------------------------|---------|---------|
| Séquentiel (5 fois)     | 2.26s   | 1.0x    |
| 5 Threads               | 2.29s   | 1.0x (GVL!) |
| 5 Ractors               | 0.68s   | **+3.3x** |

**JSON parsing (string keys, byroot 2025) :**

```ruby
# {"a": 1, "b": 2, "c": 3, "d": 4}
# Séquentiel : 5M fois
# Ractors : 5 × 1M fois en parallèle
```

| Configuration           | Temps   | Speedup |
|-------------------------|---------|---------|
| Séquentiel (5M docs)    | 1.29s   | 1.0x    |
| 5 Ractors (1M chacun)   | 3.19s   | **-2.5x** |

La raison : chaque clé string dans le JSON déclenche `register_fstring()` → `RB_VM_LOCK_ENTER()` global. 4 clés × 1M itérations = 4M lock acquisitions par Ractor, 20M au total en contention.

**Tak récursif (Koichi Sasada, Ruby 3.0, 4-core) :**

| Configuration       | Temps    | Speedup |
|---------------------|----------|---------|
| 1 Thread            | 8.2s     | 1.0x    |
| 4 Threads           | 8.1s     | 1.0x (GVL!) |
| 1 Ractor            | 8.3s     | 1.0x    |
| 2 Ractors           | 4.3s     | 1.9x    |
| 4 Ractors           | 2.1s     | 3.87x   |

### Coûts de création

| Unité   | Coût création |
|---------|---------------|
| Fiber   | < 1 µs        |
| Thread  | 1-5 µs        |
| Ractor  | 100-500 µs    |
| Process | 10-50 ms      |

### Quand utiliser quoi

| Workload              | Recommandation      |
|-----------------------|---------------------|
| IO-bound              | Thread ou Fiber     |
| CPU-bound, état local | Ractor              |
| CPU-bound, état partagé | Process (via fork) |
| Très haute concurrence IO | Fibers + Scheduler |
| CPU + IO massif       | Ractor + Fibers internes |

---

## 13. Incompatibilités et gems

### Catégories de problèmes

**1. Constante mutable = IsolationError immédiat :**

Le cas le plus vicieux : une constante Ruby peut être mutable (Hash, Array, String). Accéder depuis un Ractor secondaire à une constante mutable lève `Ractor::IsolationError`, même en lecture.

```ruby
# Entier → OK (immutable)
INT = 1
Ractor.new { p INT }.take  # => 1

# Hash → IsolationError (mutable)
HASH = {}
Ractor.new { p HASH }.take  # Ractor::IsolationError

# Pattern très courant dans les gems — CASSE avec Ractors
class Something
  DEFAULTS = { config: 1 }  # Hash mutable!

  def initialize(options = {})
    @options = DEFAULTS.merge(options)  # Ractor::IsolationError
  end
end
```

Comme le formule byroot : *"Something as mundane and idiomatic as having a constant with some defaults is enough to make your code not Ractor compatible."*

**2. Mutation de classe/module :**
```ruby
Ractor.new do
  class Foo
    class << self
      attr_accessor :bar
    end
  end
  Foo.bar = 1  # Ractor::IsolationError
end.take
```

**3. État global mutable :**
```ruby
# La plupart des gems utilisent des class variables ou des singletons
class SomeGem
  @@config = {}                  # Mutable global → pas Ractor-safe
  def self.configure(&blk); end
end
```

**4. Thread.current[:key] :**
```ruby
# Pattern courant pour les connections DB, request context
Thread.current[:current_user] = user  # Invisible depuis un autre Ractor
```

**5. Extensions C avec état global :**
Les gems avec des extensions C qui utilisent des variables globales C ne sont pas Ractor-safe. La gem `json` standard elle-même est ralentie par le lock sur l'interning des string keys (voir section 4).

### Gems connues non-compatibles (Ruby 3.x)

- Rails (en entier) — travail en cours
- ActiveRecord / AR connexions
- Sidekiq (ironique) — utilise Thread.current abondamment
- Certains parsers XML/HTML

### Gems Ractor-safe

- `json` (gem standard depuis Ruby 3.x) — les objets doivent être shareable
- Calculs mathématiques pures
- Code Ruby pur sans state global

### Vérification

```ruby
Ractor.shareable?(obj)       # true/false
Ractor.new(obj) { |o| o }    # Test live — lève une exception si pas safe
```

---

## 14. Internals C

### ractor.c (principales structures)

```c
// Status d'un Ractor
enum rb_ractor_status {
    ractor_created,
    ractor_running,
    ractor_blocking,
    ractor_terminated,
};

// Structure principale
struct rb_ractor_struct {
    rb_ractor_sync_t    sync;        // mutex + cond var (LE GVL du Ractor)
    struct rb_ractor_id id;
    enum rb_ractor_status status;

    rb_ractor_queue_t   recv_queue;  // Inbox (pour send/receive)
    rb_ractor_queue_t   yield_queue; // Outbox (pour yield/take)

    struct ccan_list_head living_threads; // Threads OS de ce Ractor
    rb_nativethread_lock_t threads_lock;
};
```

### thread.c — scheduling

Chaque thread OS connaît son Ractor via `th->ractor`. Le scheduler (`thread_sched_yield`) vérifie si d'autres Ractors/threads attendent, et effectue un context switch si nécessaire. Contrairement aux threads classiques qui attendent *le même* GVL global, chaque Ractor attend *son propre* lock.

### gc.c — garbage collection

```c
// Multi-Ractor GC : détecte si plusieurs Ractors sont actifs
rb_gc_multi_ractor_p()

// Cache d'allocation par Ractor (Ruby 3.2+)
rb_gc_ractor_newobj_cache_foreach()

// Lock pour synchroniser le GC entre Ractors
rb_gc_vm_lock()
rb_gc_cr_lock()
```

La phase de mark du GC est de plus en plus parallélisée (chaque Ractor marque ses propres objets). La phase de sweep reste coordonnée globalement mais s'améliore à chaque version mineure.

---

## 15. Edge cases et pièges

### Freeze superficiel vs make_shareable

```ruby
arr = ["mutable", "strings"].freeze
# arr est frozen, mais arr[0] ne l'est pas
arr[0] << " modified"  # Fonctionne! String est mutable

shared = Ractor.make_shareable(["mutable", "strings"])
shared[0] << " modified"  # FrozenError — deep freeze
```

### Symbol leaks

```ruby
# Les symboles dynamiques ne sont jamais GC'és
r = Ractor.new { 1_000_000.times { |i| :"sym_#{i}".to_s } }
# Crée 1M symboles permanents — memory leak
```

### Ractor infini

```ruby
r = Ractor.new { loop { } }
r.take  # Bloque indéfiniment
# Pas de Ractor.kill — seul Process.kill fonctionne
```

### Inheritance entre Ractors

```ruby
@shared_state = "value"

r = Ractor.new do
  @shared_state  # => nil — les variables d'instance ne sont pas héritées
end
```

### GC pause globale

Sur de gros workloads, un GC majeur peut encore provoquer une pause sur tous les Ractors (Ruby 3.0-3.2). Atténué en Ruby 3.3+ mais pas encore éliminé.

---

## 16. Implications pour le simulateur

### Position dans la progression pédagogique

```
Threads (GVL contention entre eux) → Processes (vrai parallélisme, coût RAM)
→ Fibers (légèreté IO) → Ractors (parallélisme + légèreté)
```

**Rappel hiérarchique :** dans le modèle Ractor, chaque Ractor peut contenir un ou plusieurs Threads. En pratique dans le simulateur, on modélise 1 thread par Ractor (le cas d'usage courant). Le parallélisme vient du fait que les Ractors ont des GVL indépendants — leurs threads internes peuvent s'exécuter simultanément sur des cœurs différents.

Les Ractors résolvent les deux problèmes à la fois :
- Pas de contention GVL *entre* Ractors → parallélisme CPU comme les processes
- Très légère mémoire → scalabilité comme les fibers
- **Mais :** message passing obligatoire → latence de sérialisation sur chaque requête

### Ce qui change dans le gameplay

| Avant Ractors | Avec Ractors |
|---------------|--------------|
| Threads → GVL_WAIT fréquent | Zéro GVL_WAIT entre Ractors |
| Processes → lourd en RAM (50MB) | Ractors → léger (~8MB) |
| Fibers → IO seulement | Ractors → CPU ET IO en parallèle |
| PDF Reports → bloquent tout | PDF Reports → chaque Ractor indépendant |

### Nouveau state : SERIALIZE

Avant chaque phase d'un Ractor, une courte phase `serialize` (~100-500µs) est visible. C'est le coût du deep copy de la requête entrante. Elle enseigne :
- Le message passing n'est pas gratuit
- Objets immuables → coût O(1) (contournement via `make_shareable`)

### Contraintes à modéliser

1. **Incompatibilité avec les constantes mutables** : les requêtes qui passent par des gems utilisant `DEFAULTS = {}` ou tout autre constant mutable échouent immédiatement avec `Ractor::IsolationError`. Dans le jeu : ~30% des requêtes "mixed" type sont rejetées (simule les gems incompatibles).

2. **JSON parsing = pas de gain** : les requêtes IO-bound ou mixed qui parsent des données JSON en string keys n'accélèrent pas avec Ractors — elles peuvent même ralentir (lock global `register_fstring`). Dans le jeu : seules les requêtes CPU-bound pures bénéficient du parallélisme.

3. **Scaling** : limité par vCPU comme les processes, mais la limite RAM est très souple (~8MB vs 50MB process vs 18MB thread).

4. **Moment "wow"** : voir plusieurs Ractors en état CPU simultanément, sans aucune couleur violette de GVL_WAIT. C'est la récompense visuelle après des heures de contention — mais uniquement sur les requêtes CPU pures.

5. **Statut expérimental** : 74 bugs ouverts dont des segfaults et deadlocks (état Ruby 2025). Le jeu peut simuler des crashes aléatoires occasionnels avec un badge ⚠️ "Ractor bug" pour l'authenticité pédagogique.

### Architecture technique pour l'implémentation

- `_ractorsEnabled` flag dans `GameState`
- Chaque Ractor = 1 "thread" dans la simulation avec son propre `gvlHolder` slot dédié (pas partagé avec les autres)
- Phase `serialize` injectée : `{ type: 'serialize', ms: 150, label: 'Message passing' }`
- Cards visuellement distinctes : bordure teal (`#34d399`), pas de badge GVL_WAIT
- `GVLScheduler.stepThread` : en mode Ractor, `proc = ractor` (chaque Ractor est son propre domaine GVL)

---

## Sources

- [Documentation officielle Ruby 3.4 — ractor.md](https://docs.ruby-lang.org/en/3.4/ractor_md.html) — source principale pour la hiérarchie Process → Ractor → Thread(s) → Fiber, coût de création
- [Ruby API — Ractor class (Ruby 3.0.2)](https://ruby-doc.org/core-3.0.2/Ractor.html) — référence complète de l'API (méthodes, exceptions, shareability)
- [byroot — What's The Deal With Ractors? (2025)](https://byroot.github.io/ruby/performance/2025/02/27/whats-the-deal-with-ractors.html) — **source la plus critique** : 42 locks globaux résiduels, JSON benchmark -2.5x, IsolationError sur constantes mutables, 74 bugs ouverts
- [AppSignal — An Introduction to Ractors in Ruby](https://blog.appsignal.com/2022/08/24/an-introduction-to-ractors-in-ruby.html) — introduction pratique, benchmarks 3.87x
- [Dave Russell — Ruby on Ractors: Parallel Execution Done Beautifully](https://medium.com/@dave_russell/ruby-on-ractors-parallel-execution-done-beautifully-c05a09d22102) — cas d'usage réels, pool patterns
- [ruby/ruby — ractor.c](https://github.com/ruby/ruby/blob/master/ractor.c) — internals C, structures `rb_ractor_struct`
- [Ruby 3.0.0 release notes — Ractor](https://www.ruby-lang.org/en/news/2020/12/25/ruby-3-0-0-released/)
- [Koichi Sasada — Ractor design — RubyKaigi 2020](https://rubykaigi.org/2020-takeout/presentations/ko1.html)
- Benchmarks tak : 4-core, Ruby 3.0 — résultats publiés par ko1
