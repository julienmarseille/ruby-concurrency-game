export const NARRATIVE = {
  initial: {
    title: 'No threads yet',
    body: `Requests are piling up — but nothing processes them.<br><br>
      Buy your first thread to start. It's free.`,
  },

  phases: {
    2: {
      badge: 'Phase 2 — Mixed workload',
      title: 'Mixed workload incoming!',
      body: `New request types are arriving:<br><br>
      🟡 <strong>POST /checkout</strong> — auth + DB write. 65% I/O → 2-3 threads useful.<br><br>
      🔴 <strong>GET /export.pdf</strong> — renders a PDF. Only 17% I/O — adding threads <strong>barely helps</strong>.<br><br>
      Watch the <span style="color:#b490f5"><strong>purple blocks</strong></span> appear when two CPU-heavy requests compete for the GVL.`,
    },
  },

  threadAdded: {
    1: {
      title: 'Your first thread!',
      body: `The thread picks requests from the queue and processes them one at a time.<br><br>
          Each <strong>GET /users</strong> spends 75% of its time waiting on the DB — the GVL is released during that time.`,
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
