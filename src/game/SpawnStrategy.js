export class SpawnStrategy {
  buildPool(upgrades) {
    const pool = ['DB_REQUEST', 'DB_REQUEST_HEAVY_START', 'DB_REQUEST_FRAGMENTED'];
    if (upgrades.has('mixed_requests'))  pool.push('MIXED', 'MIXED');
    if (upgrades.has('report_requests')) pool.push('REPORT');
    return pool;
  }
}
