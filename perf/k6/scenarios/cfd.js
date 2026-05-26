import http from 'k6/http';
import { check, sleep } from 'k6';
import { authHeaders, login } from '../lib/auth.js';
import { BASE_URL, HEAVY_THRESHOLDS, RAMP_HEAVY, TEAM_ID } from '../lib/config.js';

// CFD reconstructs per-day task state for 90 days from task_status_history.
// Uses HEAVY_THRESHOLDS + RAMP_HEAVY (lower concurrency, slacker p95) to match
// the server's 10-req/min rate cap on this specific endpoint.
export const options = {
  stages: RAMP_HEAVY,
  thresholds: HEAVY_THRESHOLDS,
};

export function setup() {
  return { token: login() };
}

export default function ({ token }) {
  const res = http.get(`${BASE_URL}/analytics/v1/teams/${TEAM_ID}/bottlenecks/cfd`, {
    headers: authHeaders(token),
    tags: { name: 'cfd' },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
    '90 day points': (r) => r.json('points').length === 90,
  });

  // Sleep a bit longer to stay under the 10/min rate limit.
  sleep(7);
}
