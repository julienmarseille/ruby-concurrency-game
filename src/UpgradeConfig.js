export const UPGRADES = {
  request_tracing: {
    id:   'request_tracing',
    name: 'Request Tracing',
    desc: 'See the live incoming request queue and watch requests flow into threads.',
    cost: 20,
  },
  monitoring: {
    id:   'monitoring',
    name: 'Monitoring',
    desc: 'Unlock performance metrics: GVL wait %, memory usage and thread activity timeline.',
    cost: 40,
  },
  throughput_graph: {
    id:   'throughput_graph',
    name: 'Throughput Graph',
    desc: 'Live req/s chart showing how throughput evolves as you add threads.',
    cost: 60,
  },
};
