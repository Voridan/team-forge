import http from 'k6/http';
import { check, sleep } from 'k6';
import { authHeaders, login } from '../lib/auth.js';
import { BASE_URL, DEFAULT_THRESHOLDS, TEAM_ID } from '../lib/config.js';

/**
 * End-to-end dashboard-load scenario. Models a real user opening the analytics
 * tab: a burst of parallel GETs for overview + workload + throughput +
 * bottlenecks + recommendations, then a click into the CFD tab.
 *
 * Useful for sanity-checking total page-load time vs the per-endpoint scripts.
 */
export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '40s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    // Page-load aggregate is allowed to be slower than any single endpoint.
    http_req_duration: ['p(95)<2000'],
  },
};

export function setup() {
  return { token: login() };
}

export default function ({ token }) {
  const headers = authHeaders(token);
  const prefix = `${BASE_URL}/analytics/v1/teams/${TEAM_ID}`;

  // Initial dashboard paint: 4 endpoints in parallel.
  const batch = http.batch([
    ['GET', `${prefix}/overview`, null, { headers, tags: { name: 'overview' } }],
    ['GET', `${prefix}/workload`, null, { headers, tags: { name: 'workload' } }],
    ['GET', `${prefix}/throughput`, null, { headers, tags: { name: 'throughput' } }],
    ['GET', `${prefix}/recommendations`, null, { headers, tags: { name: 'recommendations' } }],
  ]);
  for (const r of batch) {
    check(r, { 'parallel GET 200': (x) => x.status === 200 });
  }

  // User clicks the bottlenecks sub-tab.
  sleep(1);
  const bottlenecks = http.get(`${prefix}/bottlenecks`, {
    headers,
    tags: { name: 'bottlenecks' },
  });
  check(bottlenecks, { 'bottlenecks 200': (r) => r.status === 200 });

  sleep(2);
}
