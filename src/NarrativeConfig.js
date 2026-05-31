export const NARRATIVE = {
  initial: {
    title: 'Start your server',
    body: `Requests are queuing up — but nothing processes them yet.<br><br>
      Click <strong>⚙️ Start Server</strong> to create your Ruby process, then add a thread to start handling requests.`,
  },

  processCreated: {
    title: 'Process created!',
    body: `Your Ruby process is running — but it has no threads yet.<br><br>
      Add <strong>Thread 1</strong> to start picking requests from the queue.`,
  },

  upgrades: {
    mixed_requests: {
      title: 'Mixed workload incoming!',
      body: `🟡 <strong>POST /checkout</strong> is now arriving — auth + DB write.<br><br>
        50% I/O → 2 threads useful. Higher reward ($18) but more CPU phases means more GVL contention.<br><br>
        Watch the <span style="color:#b490f5"><strong>purple blocks</strong></span> appear when CPU phases compete.`,
    },
    report_requests: {
      title: 'PDF exports are live!',
      body: `🔴 <strong>GET /export.pdf</strong> is now in the queue — PDF generation.<br><br>
        Only 10% I/O — adding threads <strong>does nothing</strong>. High reward ($30) but it hogs the GVL.<br><br>
        <em>"More threads ≠ more throughput when the GVL is the bottleneck."</em>`,
    },
    fiber_scheduler: {
      title: 'Falcon mode — fibers replace threads!',
      body: `Extra threads removed. <strong>1 thread per process</strong>, fibers handle concurrency.<br><br>
        During <span style="color:#4299e1"><strong>I/O phases</strong></span> (DB query, auth), a fiber yields instantly — another fiber runs immediately. The thread registers the IO with the OS (epoll) and moves on.<br><br>
        During <span style="color:#d29922"><strong>CPU phases</strong></span>, only one fiber runs at a time — <strong>not because of the GVL</strong>, but because scheduling is cooperative. A fiber keeps the CPU until it hits IO or finishes. Other fibers are <span style="color:#8957e5"><strong>queued</strong></span> in the scheduler.<br><br>
        Watch the fiber rows appear below the thread card. RAM freed from threads is now available for more fibers.<br><br>
        <em>This is how Falcon handles thousands of concurrent requests with a single OS thread per process.</em>`,
    },
  },

  processAdded: {
    title: 'New process forked!',
    body: `Watch the new process pick up requests independently.<br><br>
      Two CPU-heavy requests can now run <strong>simultaneously</strong> — one per process.<br><br>
      <em>The GVL is per-process in Ruby — this is how Unicorn/Puma multi-process works.</em>`,
  },

  threadAdded: {
    1: {
      title: 'Server is live!',
      body: `Thread 1 picks requests one at a time.<br><br>
          Each <strong>GET /users</strong> spends 75% of its time waiting on the DB — the GVL is released during I/O.<br><br>
          Add more threads to handle requests in parallel.`,
    },
    2: {
      title: 'Two threads!',
      body: `While thread 1 waits on the DB, thread 2 can run.<br><br>
          <strong>GET /users</strong> is 75% I/O → 2 threads already helps a lot. Keep going.`,
    },
    3: {
      title: '3 threads',
      body: `Shopify formula: <em>to saturate N threads, you need (N−1)/N I/O time.</em><br><br>
          GET /users = 75% I/O → needs 4 threads to saturate. You're almost there.`,
    },
    4: {
      title: '4 threads — saturation!',
      body: `<strong>GET /users</strong> is 75% I/O → saturates at exactly 4 threads.<br><br>
          Adding a 5th thread for DB queries won't help — watch it sit idle in the timeline.<br><br>
          🔴 PDF exports are different: 83% CPU — they barely benefit from any extra thread.`,
    },
  },

  threadAddedFallback: n => ({
    title: `${n} threads`,
    body: `Beyond saturation for DB requests. Extra threads only help if your workload has more I/O.<br><br>
      <em>"More threads ≠ more throughput when the GVL is the bottleneck."</em>`,
  }),
};
