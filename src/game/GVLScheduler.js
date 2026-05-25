export class GVLScheduler {
  stepThread(thread, phase, proc) {
    if (phase.type === 'cpu') {
      if (proc.gvlHolder === null || proc.gvlHolder === thread.id) {
        proc.gvlHolder = thread.id;
        if (thread.status !== 'cpu') thread.phaseRunWall = null;
        thread.status = 'cpu';
        return true;
      } else {
        thread.status = 'gvl_wait';
        return false;
      }
    } else {
      if (proc.gvlHolder === thread.id) proc.gvlHolder = null;
      thread.status = 'io';
      return true;
    }
  }

  grantNext(proc, threads, now) {
    const waiter = threads.find(t => t.processId === proc.id && t.status === 'gvl_wait');
    if (waiter) {
      proc.gvlHolder    = waiter.id;
      waiter.status     = 'cpu';
      waiter.phaseRunWall = now;
    }
  }

  postStep(processes, threads, now) {
    for (const proc of processes) {
      if (proc.gvlHolder === null) this.grantNext(proc, threads, now);
    }
  }
}
