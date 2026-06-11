# Ruby Concurrency Game - Narrative Design

## Executive Summary

The Ruby Concurrency Game teaches concurrent programming through a simulation of a growing Rails server. The player starts with a broken queue and nothing to process it, then progressively discovers the fundamental tensions in Ruby concurrency: threads hit the GVL ceiling, processes consume memory, fibers require cooperation, and Ractors demand isolation.

The game has:
- A clear **victory condition** announced from the start
- Progressive **loss conditions** that emerge naturally from poor scaling choices
- A **narrative arc in 5 acts**, each teaching one core concept via a "problem to solve"
- A **prestige system** that unlocks alternate runtimes and allows replay with new rules
- An **ending screen** that validates what the player learned

---

## Part 1: Core Win/Loss Conditions

### Victory Condition: "Sustain the Viral Campaign"

**What:** Achieve and maintain **18 req/sec throughput for 60 consecutive seconds** during active traffic (Campaign V).

**Why this metric:**
- **18 req/sec** is the final traffic tier (Campaign V = "Viral launch. 18 req/s. Servers melting.")
- **60 seconds of sustained throughput** proves the solution is stable, not luck
- Requires mastery of all scaling techniques: threads, processes, fibers, or Ractors
- Testing all approaches leads to different "endings" (different optimization stories)

**Checkpoints** (optional but recommended for intermediate goals):
1. **Checkpoint 1 (Act 1 complete):** 3 req/sec sustained for 10 seconds = "Master single-threaded scheduling"
2. **Checkpoint 2 (Act 2 complete):** 8 req/sec sustained for 20 seconds = "Escape the GVL"
3. **Checkpoint 3 (Act 3 complete):** 12 req/sec sustained for 30 seconds = "Scale processes efficiently"
4. **Checkpoint 4 (Act 4 complete):** 16 req/sec sustained for 45 seconds = "Choose your concurrency model"
5. **Victory:** 18 req/sec sustained for 60 seconds = "Production-grade scaling"

**Display:** A persistent victory meter visible in the top-right corner of the game:
```
[Victory Meter]
Target: 18 req/s for 60 sec
Current streak: 14 sec @ 12.3 req/s
Status: Sustained (98% of target)
```

When the player hits 18 req/s, the meter shifts to a countdown timer showing seconds remaining.

---

### Loss Conditions: Three Failure Modes

#### Loss Mode 1: "Out of Memory Crash" (Hard ceiling)

**Trigger:** `memory_used > memory_max` 

**Progression:**
- At 85% RAM: Memory bar pulses yellow, warning message: "Memory pressure rising — consider recycling a process or adding RAM."
- At 95% RAM: Memory bar pulses red, warning message: "Critical memory! Next allocation will crash."
- At 100% RAM: OOM crash modal (already in code)

**Recovery:** Player can click "Resume Server" in the modal. All running requests are lost, but the server restarts with a 2-second downtime visible in the throughput graph. This creates a natural pause point to rethink architecture.

**What it teaches:** Memory is not infinite. Threads (18 MB), processes (50 MB), and fibers (0.5 MB) have real costs. Adding infinite threads/processes leads to failure, not scaling.

---

#### Loss Mode 2: "Throughput Collapse" (Soft ceiling - GVL saturation)

**Trigger:** Throughput plateaus and starts declining despite adding more threads.

**Progression:**
- **At 60% GVL wait time:** InfoPanel message: "Threads are now blocking on the GVL more than running. Adding threads won't help — consider processes or fibers instead."
- **At 80% GVL wait time:** InfoPanel warning: "Your server is GVL-bound. The Global VM Lock is your bottleneck, not I/O."
- **Gameplay effect:** Adding a 5th or 6th thread on pure DB requests visibly shows idle threads. The throughput graph flattens or decreases.

**Recovery:** Player must pivot strategy: buy processes (to escape GVL), enable fibers (for I/O concurrency), or accept this is the ceiling for single-process threading.

**What it teaches:** Threads alone have a hard ceiling. Beyond that ceiling, the GVL wins. Understanding when you've hit it is the key insight that branches the game into "processes path" vs "fibers path".

---

#### Loss Mode 3: "Cascading Fiber Stalls" (Cooperative scheduling failure)

**Trigger:** If fibers are enabled and a CPU-heavy request runs without yielding.

**Progression:**
- When a fiber runs a CPU phase that lasts >2000ms without I/O, all other fibers queue behind it.
- Visual effect: The thread's activity timeline shows ONE HUGE block, with a red banner "GLOBAL STALL - one fiber blocking all others".
- Throughput drops to near-zero during the stall.
- InfoPanel: "Cooperative scheduling failed. A fiber kept the CPU for 2.1 seconds without yielding. All 47 waiting fibers are blocked."

**Recovery:** The stall eventually ends (request completes), but throughput stays low because requests queued while the stall happened need time to drain. This is a natural "you learned this the hard way" moment.

**What it teaches:** Fibers are not magic. They assume all I/O is properly yielded. A single bad actor (a CPU-heavy library that doesn't yield) breaks the entire model. This is why production deployments of Falcon are careful about gem selection.

---

## Part 2: Onboarding & First Session

### Initial State (0 time)

The game starts with:
- Queue panel showing ~5-10 requests waiting
- No processes, no threads
- Money = $10,000
- Message in InfoPanel:

```
[Initial Scene]
Title: "Welcome to the Game."

Body:
"Requests are piling up in the queue, but your server isn't processing them yet.

Click ⚙️ START SERVER to create your first Ruby process.
Then add threads to handle requests one by one.

Goal: Keep your server running smoothly as traffic scales from 3 req/sec to 18 req/sec. Learn Ruby concurrency by fixing real problems: the GVL, memory limits, and scheduling strategies.

Ready? Start by creating your first process."
```

### Act 1, Scene 1: "Threads + I/O" (First 3-5 minutes)

**Guided flow:**
1. Player clicks "Start Server" -> Process 1 created (free)
2. InfoPanel shows:
```
[Process Created]
Title: "Your process is running, but it has no threads."

Body:
"A Ruby process without threads is like a restaurant with no waiters.
Requests queue forever.

Click ADD THREAD to create your first thread.
It will pick requests from the queue one by one."
```

3. Player clicks "Add Thread 1" (cost: $100)
4. Requests start flowing. InfoPanel:
```
[Thread 1 Added]
Title: "Thread 1 is now serving requests"

Body:
"GET /users is 75% I/O — while this thread waits on the database,
the GVL is released to... nobody (there's no other thread yet).

The thread sits idle. This is wasted potential.

Add more threads. While thread 1 waits on the DB, thread 2 can run."
```

5. Player adds threads 2, 3, 4. Each addition shows a specific message:

**Thread 2:**
```
[Two Threads!]
Title: "Concurrency is working"

Body:
"While thread 1 waits on the database, thread 2 can process another request.

GET /users is 75% I/O, which means thread 2 should also hit I/O frequently,
releasing the GVL back to thread 1.

The two threads are running in parallel."
```

**Thread 3:**
```
[Three Threads]
Title: "Approaching saturation"

Body:
"Ruby's Shopify formula: to fully saturate N threads, you need (N-1)/N I/O time.

GET /users is ~75% I/O, so it saturates at ~4 threads.
You're almost there."
```

**Thread 4:**
```
[Saturation Reached]
Title: "4 threads — you've hit the limit"

Body:
"GET /users is 75% I/O. At 4 threads, one thread is always running
while the others wait on the DB.

Watch the timeline: all 4 threads show activity, none sit idle.
This is saturation.

If you add a 5th thread for pure DB queries, it will sit idle most of the time.
You've hit the limit of what threads alone can do."
```

**What the player discovers:** 
- Threads are useful for I/O-heavy workloads
- There's a saturation point (threads depend on I/O ratio)
- More threads beyond saturation = wasted memory
- The throughput graph climbs from 1 req/s to 3-4 req/s

**Natural stopping point:** Player has 4 threads, maybe has spent $400, making $30-40/sec in reward. Throughput holds at 3 req/sec. Game feels stable but boring.

---

### Act 1, Scene 2: "The Mixed Workload Problem" (Lesson: CPU exists)

**Trigger:** After 2-3 minutes of stable play at 4 threads, unlock "Mixed Workload" ($80).

**Event:**
```
[Mixed Workload Unlocked]
Title: "New traffic arriving: POST /checkout"

Body:
"🟡 Checkout requests are now in the queue.

POST /checkout is 50% I/O, 50% CPU (auth + DB write + business logic).

Your 4 threads can handle GET /users well, but POST /checkout is different.
You should now see both blue (I/O) and purple (GVL wait) blocks in the timeline.

Add a thread to see what happens."
```

**Consequence:** If player adds a 5th thread, they see:
- Purple "GVL wait" blocks start appearing
- Threads compete for the GVL during CPU phases
- Throughput gain is minimal (maybe 3.5 req/sec, not 4)
- Timeline becomes messier

**InfoPanel after adding thread 5:**
```
[Five Threads]
Title: "GVL contention starts"

Body:
"POST /checkout is only 50% I/O. With 5 threads, they compete for the GVL
during the CPU phases.

See the purple blocks in the timeline? Those are threads waiting for the GVL.

The more threads you add, the more they fight each other.
This is the Global VM Lock. It's Ruby's biggest concurrency limit."
```

**What the player discovers:**
- CPU phases lock the GVL
- Threads fighting over the GVL make things worse, not better
- This is a hard wall: no amount of threads will fix this

---

### Act 1, Scene 3: "PDF Reports = GVL Nightmare" (Lesson: CPU-bound = broken)

**Trigger:** After trying to add 5-6 threads and seeing diminishing returns, unlock "PDF Reports" ($120).

**Event:**
```
[PDF Reports Unlocked]
Title: "New request type: GET /export.pdf"

Body:
"🔴 PDF export requests are now arriving.

GET /export.pdf is 90% CPU (rendering, compression). Only 10% I/O.

Watch what happens when a thread picks up a PDF report.
The entire thread is locked in CPU work for 8+ seconds.
The GVL is held the entire time.
Other threads cannot run.

This is the GVL at its worst."
```

**Gameplay consequence:** When a PDF request enters, throughput visibly drops to almost zero. A single PDF request locks out all other threads. They wait. The timeline shows one thread doing all CPU work, others blocked purple.

**InfoPanel:**
```
[PDF Reports]
Title: "You've hit the GVL wall"

Body:
"GET /export.pdf is 90% CPU. One thread picks it up and locks
the GVL for 8+ seconds. All other threads wait (purple blocks).

Adding more threads doesn't help. Adding 10 threads still locks 9 of them
during PDF generation.

Threads cannot fix CPU-bound work in Ruby.
You need a different approach: processes or background jobs."
```

**What the player discovers:**
- Threads alone are fundamentally broken for CPU-heavy workloads
- The GVL is not just a bottleneck, it's a dead end for that workload
- There must be another solution

---

## Part 3: Five-Act Narrative Arc

### Act 1: "The Thread Illusion" (Lessons 1-3 above)

**Theme:** Threads seem like they should be enough, but they hide the GVL.

**Story beats:**
1. Threads help with I/O (Checkpoint 1: 3 req/sec)
2. Saturation is discovered (Checkpoint 2: 4 threads is the limit for pure I/O)
3. Mixed workload reveals purple GVL-wait blocks
4. PDF requests lock the entire server

**Victory condition at Act 1 end:** 3 req/sec sustained = Player has mastered single-threaded scheduling and understands why it's not enough.

**Ending text:**
```
[Act 1 Complete]
"You've learned how threads work with I/O and why the GVL exists.
But threads alone can't handle CPU-heavy work.

The Game now opens two paths: processes (true parallelism) or
background jobs (offload CPU). Choose your next upgrade wisely."
```

---

### Act 2: "Breaking Out of the GVL" (Choosing a path)

#### Path A: Multi-Process (Unicorn/Puma model)

**Trigger:** After Act 1, offer two upgrades:
- "Sidekiq Workers" ($150) - background jobs (not fully implemented in current roadmap)
- "Multi-Process Mode" ($150) - fork another process

**For Path A (Processes), InfoPanel:**
```
[Multi-Process Mode Unlocked]
Title: "Fork a second process"

Body:
"Each Ruby process has its own GVL.

Fork a second process and you instantly have two GVLs running in parallel.
Two CPU-heavy PDF requests can run simultaneously — one per process.

But each process is ~50 MB of memory overhead.
You only have 512 MB total. Memory will become your new bottleneck.

Click BUY PROCESS to fork process 2."
```

**What happens:** Player buys Process 2. One thread in Process 1, one thread in Process 2. Now:
- Two PDF requests can run truly in parallel (no purple wait blocks)
- Throughput jumps
- Memory bar shows significant jump
- Player realizes: we traded GVL for RAM

**Gameplay progression in Act 2 (Path A):**
1. Add Process 2 (memory jumps 50 MB)
2. Increase Campaign traffic to 8 req/sec (Campaign II)
3. Player adds threads to each process independently
4. Memory bar climbs as threads are added
5. Eventually hits 70% memory capacity

**InfoPanel warnings in Act 2:**
```
[Two Processes]
Title: "True parallelism at a cost"

Body:
"Two processes = two GVLs. PDF requests no longer block each other.

But notice the memory meter: it jumped from 200 MB to 300 MB.
Each process costs 50 MB base memory, plus thread memory (18 MB per thread).

You have 512 MB total. With 4 threads per process, you're at:
  Base (200 MB) + 2 processes (100 MB) + 8 threads (144 MB) = 444 MB

One more thread and you hit the memory ceiling."
```

**Act 2 Path A ending (at ~70% memory):**
```
[Act 2 (Path A) Complete]
"You've escaped the GVL by forking processes.

True CPU parallelism achieved. But memory is now your enemy.
You have a hard choice: add more RAM, or find a lighter concurrency model."
```

#### Path B: Background Jobs (Sidekiq model)

*(Note: This path requires Sidekiq implementation, which is marked "to do" in roadmap. Described for narrative completeness.)*

**Trigger:** If player buys "Sidekiq Workers" upgrade instead of process.

```
[Sidekiq Workers Unlocked]
Title: "Offload PDF work to background jobs"

Body:
"Instead of processing PDF exports in the web thread,
queue them to a background worker and return 202 Accepted instantly.

The web thread is freed. PDF work happens in a separate worker pool.

But workers also have a GVL. You haven't removed the GVL, just moved it.
Now you need to manage two job queues and coordinate between them."
```

**Gameplay:** PDF requests return instantly (web thread stays free), but workers queue up and take time processing. Player discovers that offloading doesn't solve the GVL — it just separates concerns.

**Act 2 Path B ending:**
```
[Act 2 (Path B) Complete]
"You've offloaded CPU work to background jobs.

Web requests are snappy now, but workers are bottlenecked.
The GVL still exists — you just moved it behind a queue."
```

---

### Act 3: "Memory is a Resource" (Acts 2-3 bridge)

**Trigger:** Whichever path taken, at ~70% memory usage.

**The problem:** Player hits memory ceiling around 500 MB. At Nano VPS (512 MB total), they can't add more processes or threads without risking OOM.

**Checkpoint 3:** 12 req/sec sustained = "Scale processes efficiently"

**New options presented:**
1. **Upgrade VPS to Small** ($400) - 1 GB RAM, 2 vCPU. Enables more processes.
2. **Memory Profiler** ($80) - shows breakdown: Rails base, threads, processes, fibers, requests
3. **Process Recycling** ($110) - auto-restart processes to prevent memory bloat

**InfoPanel:**
```
[Memory is Visible]
Title: "Memory consumption breakdown"

Body:
"Your server allocates memory as follows:
  - Rails base: 200 MB
  - Process 1: 50 MB (base) + 36 MB (2 threads) = 86 MB
  - Process 2: 50 MB (base) + 36 MB (2 threads) = 86 MB
  - Active requests: 68 MB
  - Buffer: 40 MB

Total: 480 MB / 512 MB (94%)

You're close to OOM. One spike and you crash.

Option 1: Upgrade RAM (buy Small VPS, $400)
Option 2: Be smarter about memory (Process Recycling, $110)
Option 3: Find a lighter model (enable Fibers, see below)"
```

**Act 3 emphasizes:** Memory is not unlimited. Processes are heavyweight. There must be a middle ground.

---

### Act 4: "Lightweight Concurrency" (Fibers & Async IO)

**Trigger:** Campaign III arrives (8 req/sec). Player sees memory crisis approaching.

**New upgrade path opens:**

```
[Fiber Scheduler Unlocked]
Title: "Enter the async/await future: Fibers + Scheduler"

Body:
"Ruby 3.1+ introduced the Fiber Scheduler, changing everything.

A single OS thread can multiplex hundreds of I/O-bound requests using fibers.
When a fiber hits I/O (database, network), it yields. The scheduler runs another fiber.
No threads blocked waiting. No context switching. True async concurrency.

Memory cost: fibers are cheap (~0.5 MB each). You can have 1000+ fibers on one thread.

The catch: fibers require I/O libraries to support the scheduler.
And CPU-heavy requests can block all fibers (no preemption).

Enable Fibers and watch your memory bar shrink."
```

**Gameplay in Act 4:**
1. Player disables multi-threading, keeps only 1 thread per process
2. Enables Fiber Scheduler
3. Memory bar drops dramatically (no thread overhead)
4. Can now handle 100+ concurrent requests with minimal memory

**Timeline visualization changes:**
- Thread cards now show many fiber lanes stacked vertically
- Each lane represents a fiber
- During I/O, fibers show as grey (waiting)
- During CPU, only one fiber shows as active

**InfoPanel as fibers scale:**
```
[Fibers Running]
Title: "Async I/O at scale"

Body:
"1 thread. 247 active fibers. 89% are waiting on the database.

With traditional threads, you'd need 247 threads and 4.4 GB of RAM.
With fibers, you're using 150 MB.

This is the power of cooperative scheduling.

But watch out: if one of these fibers does heavy CPU without yielding,
all 247 fibers freeze. The entire thread stalls."
```

**Checkpoint 4:** 16 req/sec sustained = "Choose your concurrency model"

**Act 4 ending:**
```
[Act 4 Complete]
"You've discovered lightweight concurrency: fibers.

Thousands of concurrent connections. Minimal memory. Maximum efficiency.

But fragility: one bad library = complete stall. Production deployments
of Falcon (fiber scheduler) are careful about gem selection."
```

---

### Act 5: "Scaling to Victory" (16 req/sec -> 18 req/sec)

**Trigger:** Campaign V unlocked (18 req/sec). Player has now mastered threads, processes, or fibers.

**The final push:** Going from 16 req/sec to 18 req/sec requires optimization at every level.

**Final bottlenecks emerge:**
1. **Database pool exhaustion** - requests wait for a connection slot
2. **CPU optimization** - shaving 100ms off request time = 10% throughput gain
3. **Cache efficiency** - the same queries repeated = wasted work

**Final InfoPanel messages:**

```
[Campaign V Incoming]
Title: "The viral moment"

Body:
"Traffic is spiking to 18 req/sec. Every optimization counts now.

Your current setup handles 15 req/sec, leaving only 3 req/sec headroom.

Review your architecture:
1. Database connection pool: do you have enough slots?
2. GVL wait %: is the GVL your bottleneck or is I/O the limit?
3. Memory headroom: if you're at 95% capacity, one spike crashes you.

Choose your last upgrade wisely. You're one optimization away from victory."
```

**Victory moment:** When player sustains 18 req/sec for 60 consecutive seconds, game pauses and shows:

```
[VICTORY]
Title: "You've scaled Ruby to handle massive traffic!"

Body:
"18 requests per second, sustained for 60 seconds.
Your server is handling a viral campaign without crashing.

Let's see what you learned:

[Your journey through concurrency...]
```

(See "Ending Screen" section below)

---

## Part 4: Game Over & Loss Conditions

### Scenario A: Out of Memory (Hard Crash)

**Trigger:** Memory usage > memory_max

**Modal displayed:**
```
[SERVER CRASHED - Out of Memory]

Title: "CRITICAL: Server ran out of RAM"

Body:
"Your Ruby processes requested more memory than available.
All active requests were dropped. The server crashed.

What happened:
- You were running at 98% memory capacity
- A request spike required more RAM
- The OS killed the process to protect the system

This is not recoverable in this scenario. You need to choose:
1. Upgrade RAM (buy larger VPS, costs money)
2. Remove processes or threads (reduce capacity)
3. Enable fibers (trades threads for lightweight concurrency)

Downtime: 2 seconds. Traffic accumulated in queue.

[RESUME SERVER] button"
```

**After resume:** Throughput graph shows a clear dip, with "CRASH" marked.

**What the player learns:** Memory planning is not optional. Every architectural choice has a memory cost. Hitting the ceiling is a tangible failure mode that forces rethinking.

---

### Scenario B: GVL Saturation (Soft Ceiling)

**Trigger:** GVL wait time > 60% for 10 consecutive seconds

**InfoPanel message:**
```
[GVL Saturation Warning]
Title: "You've hit the GVL ceiling"

Body:
"Your threads are spending 65% of their time waiting for the Global VM Lock.

This is not a crash, but your architecture is broken. Adding more threads
makes this worse, not better.

You have three options:
1. Reduce thread count and accept lower throughput
2. Upgrade to multi-process (each process has its own GVL)
3. Enable fibers (1 thread per process, many fibers for I/O concurrency)

Your current throughput: 8.2 req/sec (target: 18)
To reach 18 req/sec, you must escape the single-process GVL limit."
```

**Gameplay consequence:** Throughput plateaus. No matter what the player does, they can't break through. This is intentional — it forces the pivot to processes or fibers.

---

### Scenario C: Fiber Stall (Cooperative Scheduling Failure)

**Trigger:** A fiber runs a CPU phase > 2000ms without yielding

**Visual effect:** The thread card shows a massive red block labeled "STALLED". All other fibers queue behind it (timeline shows them as gray/queued, not idle).

**InfoPanel:**
```
[Fiber Stall]
Title: "Global stall: one fiber blocked all others"

Body:
"One of your 523 fibers ran CPU work for 2.3 seconds without yielding.

During that time, 522 other fibers were completely blocked.
They could not make progress. Requests queued in the fiber scheduler.

Throughput dropped to 0 for 2.3 seconds.

This is the dark side of fibers: they assume all I/O is properly yielded.
One bad library breaks the entire model.

Suspect causes:
- Heavy computation without yield
- A C extension that doesn't support the scheduler
- A synchronous call to an external service without timeout

Check your gems. Disable potentially problematic ones."
```

**Recovery:** The stall eventually ends when the request completes. But it's a learning moment — fibers are not magic.

---

## Part 5: Ending Screen & Prestige System

### Ending Screen (After Victory)

When player sustains 18 req/sec for 60 seconds, game transitions to end screen:

```
[==== VICTORY ====]

"You scaled Ruby to handle 18 requests per second in production.
A viral campaign is live on your service. Traffic is steady. Zero crashes."

[Your Journey Through Ruby Concurrency]

"You learned:

1. [Act 1] Threads are great for I/O-bound work, but the GVL limits CPU parallelism.
   Saturation point: determined by I/O ratio. Beyond saturation, more threads waste memory.

2. [Act 2] Processes have independent GVLs. True CPU parallelism for CPU-heavy requests.
   Cost: ~50 MB per process. Memory becomes the bottleneck faster than with threads.

3. [Act 3] Memory is a resource you must budget. No infinite scaling.
   Tools: VPS upgrades, memory profiler, process recycling for bloat mitigation.

4. [Act 4] Fibers + scheduler: thousands of I/O-concurrent requests on one thread.
   Memory cost plummets. But fragile: one CPU-heavy request blocks all fibers.

5. [Act 5] Optimization at scale: connection pooling, cache efficiency, GC tuning.
   Every 1% gain matters at the ceiling.

[Statistics]
- Peak throughput: 18.3 req/sec
- Average latency: 245 ms
- Total requests processed: 12,847
- Uptime: 99.7% (1 crash on day 3)
- Memory peak: 487 MB / 512 MB
- Time played: 47 minutes

[Your final architecture:]
- [2 processes | 1 process with fibers | 8 processes]
- [12 threads | 1 thread + 500 fibers | 64 threads]
- Memory footprint: [describe what they built]
- GVL wait time: [X% (Threads model) | 0% (Fibers model) | 0% (Processes+fibers)]

[NEXT CHALLENGES]

Ready for New Game+? Three paths open:

1. [JRuby Runtime] - No GVL. Threads scale linearly to 16.
   See concurrency without the GVL. Baseline memory cost: +150 MB (JVM runtime).

2. [Ractor Pools] - Each Ractor has its own GVL. Message passing between them.
   Learn isolation vs shared state. Understand serialization overhead.

3. [Speed Run] - Same game, but starting with 18 req/sec immediately.
   Optimize without the gradual ramp-up. Can you sustain it from the start?

[Continue to New Game+] [Export Stats] [Share to Social]
```

### Prestige System: New Game+ Variants

After victory, player unlocks prestige paths that modify the game's rules:

#### Path 1: JRuby Edition

**What's different:**
- No GVL. All threads are true OS threads (Java threads).
- Threads scale linearly: 2 threads = 2x throughput (up to 16 threads).
- Memory baseline: +150 MB (JVM runtime overhead)
- Request types remain the same

**Narrative:**
```
[New Game+: JRuby Edition]
"With JRuby, the Global VM Lock doesn't exist.

Threads you added in the vanilla game are now truly concurrent.
16 threads = 16x CPU work happening simultaneously.

Memory baseline is higher (JVM runtime). But the GVL is gone.

See how different Ruby is on the JVM."
```

**Modified InfoPanels:**
```
[Thread 5 Added - JRuby]
Title: "Five threads — all running in parallel"

Body:
"In MRI Ruby, the 5th thread would hit the GVL and start waiting.

In JRuby, thread 5 runs on a separate Java thread in parallel with threads 1-4.
No GVL contention. No purple wait blocks.

This is what production Java servers have always had.
Ruby on JRuby gets it too."
```

**Victory condition:** Reach 18 req/sec much faster (maybe 25 minutes vs 45). Game teaches: the GVL is Ruby-specific. Other VMs have different constraints.

---

#### Path 2: Ractor Edition

**What's different:**
- Ractors replace processes (sort of)
- Each Ractor has its own GVL
- Message passing has visible latency cost (~1ms per message)
- Some gems show "incompatible" warnings (random)
- Memory cost per Ractor: similar to process (50 MB) but no forking overhead

**Narrative:**
```
[New Game+: Ractor Pools]
"Ruby 3 introduced Ractors: isolated execution contexts.

Each Ractor has its own GVL. True parallelism, like processes.
But lighter weight. No fork() system call. Just fiber-like primitives.

The catch: Ractors cannot share mutable state. Communication happens via messages.
Each message must be serialized. That adds latency.

Learn the trade-offs: isolation vs coordination cost."
```

**Gameplay:**
- Instead of forking processes, player "spawns Ractors"
- Requests route to Ractors via message passing
- Visual effect: packets animate between Ractors to show message passing delay
- Some requests show "⚠️ incompatible" badge (gems using global state)

**Modified InfoPanel:**
```
[Ractors Enabled]
Title: "CPU parallelism without process fork()"

Body:
"Ractors are isolated execution contexts. Each has its own GVL.

Spawning a Ractor is lighter than fork() — no memory duplication.
But communication (message passing) adds ~1ms latency per request routing.

During I/O, that latency is hidden. But for very fast requests,
the message passing overhead is visible.

Watch the animated packets between Ractors. Each represents a request being passed."
```

**Victory condition:** Same 18 req/sec target. Game teaches: isolation is powerful (independent GVLs), but comes with coordination costs.

---

#### Path 3: Speed Run

**What's different:**
- Start with Campaign V (18 req/sec) active immediately
- Campaigns cannot be disabled
- No slow ramp-up
- Same total traffic from second 1

**Narrative:**
```
[New Game+: Speed Run]
"No tutorial. No gradual ramp-up.

Your server is hit with viral traffic (18 req/sec) from the start.

You have $10,000 and complete freedom. Can you architect
a solution fast enough to handle it before the first crash?"
```

**Gameplay:** Pure optimization challenge. Player must get architecture right immediately or crash.

**Victory condition:** Handle 18 req/sec without crashes for 30 seconds (easier than the 60-second sustained goal, because there's no ramp-up phase).

---

## Part 6: Prestige Rewards & Cosmetics

After completing any prestige path, player earns cosmetic rewards and meta-progression:

**Cosmetics:**
- JRuby edition unlocks [JVM] badge on threads
- Ractor edition unlocks [Ractor] icon on processes
- Speed Run completion shows "⚡ Speed Runner" badge

**Meta-progression:**
- Completing all three prestige paths unlocks "Grand Master" title
- Unlocks a "debug mode" where player can see internal request state (latency breakdowns per phase)
- Stats carry over: global leaderboard showing fastest time to 18 req/sec

**Future prestige paths (ideas, not implemented):**
- TruffleRuby edition (optimized JIT compilation visible)
- Async/Await Edition (promises/async/await for comparison to Ruby's Fiber model)
- Cluster Edition (load balancer with 3 servers)

---

## Part 7: Pacing & Time Estimates

### First playthrough (Acts 1-5, vanilla game)
- **Act 1 (Threads):** 8-10 minutes. Player experiments with thread counts, hits GVL wall.
- **Act 2 (Processes or Jobs):** 12-15 minutes. Player pivots strategy, hits memory ceiling.
- **Act 3 (Memory mgmt):** 8-10 minutes. Player decides to upgrade VPS or try fibers.
- **Act 4 (Fibers):** 10-12 minutes. Player discovers async concurrency, memory bar drops.
- **Act 5 (Final push):** 8-10 minutes. Fine-tuning to reach 18 req/sec.

**Total: ~50-60 minutes for first victory**

### Prestige playthroughs
- **JRuby:** 25-30 minutes (faster because no GVL)
- **Ractor:** 45-55 minutes (similar complexity to vanilla)
- **Speed Run:** 20-25 minutes (less exploration, pure optimization)

---

## Part 8: Key Narrative Moments (Aha!)

These are the moments where the player discovers something fundamental:

### Moment 1: GVL first appears
```
[InfoPanel - First Purple Block]
"That purple block is the Global VM Lock.

While thread 2 runs CPU work, thread 1 waits for the GVL to be released.
This is Ruby's biggest concurrency constraint.

In Python, it's called the GIL (Global Interpreter Lock).
In Ruby, it's the GVL.

You cannot run two threads in parallel on a single CPU core in MRI Ruby
because of the GVL."
```

### Moment 2: Saturation is discovered
```
[InfoPanel - Adding 5th thread, no gain]
"You added a 5th thread, but throughput didn't change.

The timeline shows: thread 5 is idle 80% of the time.

This is saturation. With GET /users being 75% I/O, 4 threads is the optimal count.
More threads are wasted memory."
```

### Moment 3: Processes break the GVL
```
[InfoPanel - Two processes, CPU requests run in parallel]
"Two PDF requests arrived. They're running simultaneously.

One on process 1 (thread 1). One on process 2 (thread 1).

Each process has its own GVL. They don't interfere with each other.
This is true CPU parallelism.

The cost: memory jumped 50 MB. You traded GVL for RAM."
```

### Moment 4: Fibers change the game
```
[InfoPanel - 500 fibers on 1 thread, memory drops]
"1 thread. 500 fibers. 89% of them are waiting on the database.

With threads, 500 concurrent requests = 500 threads = 9 GB of RAM.
With fibers, 500 concurrent requests = 1 thread + 500 fibers = 200 MB of RAM.

This is the efficiency of cooperative scheduling.

The catch: one misbehaving fiber (CPU work without yield) blocks all 500."
```

### Moment 5: Victory is within reach
```
[InfoPanel - Showing 16 req/sec sustained, 18 req/sec incoming]
"You're holding 16 req/sec steady.

Campaign V just started. 18 req/sec incoming traffic.

You have 2 req/sec headroom. It's tight. Every optimization counts.
One more thread. One cache hit optimization. One faster DB query.

You're so close."
```

---

## Part 9: Difficulty Modes (Future expansion)

Optional difficulty modes that emphasize different lessons:

### Story Mode (Guided, educational)
- All messages displayed
- No hidden mechanics
- Hints offered liberally
- Victory target: 12 req/sec (easier)
- Focus: learn the concepts, don't optimize for speed

### Sandbox Mode (Unguided)
- All upgrades immediately available ($10k budget is unlimited)
- No victory goal, no loss conditions
- Experiment freely
- Focus: understand the mechanics

### Hardcore Mode (Survival)
- Loss conditions are harsher (OOM at 80% instead of 100%)
- No pause button
- Money regeneration reduced (less reward per request)
- Victory target: 18 req/sec in less than 30 minutes
- Focus: rapid decision-making under pressure

---

## Summary

**The game's narrative arc teaches:**

1. **Threads + GVL:** Threads work for I/O. The GVL limits CPU work.
2. **Saturation:** More threads ≠ more throughput beyond a certain point.
3. **Processes:** Escape the GVL by forking. Trade: memory cost.
4. **Memory:** Not infinite. Budget carefully. Impact every architectural choice.
5. **Fibers:** Thousands of I/O-concurrent requests on one thread. Trade: fragility and cooperation.
6. **Victory:** Sustain viral traffic by choosing the right concurrency model.
7. **Prestige:** See the same game in different runtimes (JRuby, Ractors) to understand Ruby is just one path.

The game **avoids**:
- Lecturing about concurrency (no slides, no theory)
- Abstract concepts without simulation (everything is visible and interactive)
- Winning without learning (victory requires understanding the GVL, saturation, memory, etc.)
- One "correct" solution (threads path, processes path, fibers path all lead to victory)
