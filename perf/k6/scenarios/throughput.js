import http from 'k6/http';
import { check, sleep } from 'k6';
import { authHeaders, login } from '../lib/auth.js';
import { BASE_URL, DEFAULT_THRESHOLDS, RAMP_LIGHT, TEAM_ID } from '../lib/config.js';

export const options = {
  stages: RAMP_LIGHT,
  thresholds: DEFAULT_THRESHOLDS,
};

export function setup() {
  return { token: login() };
}

export default function ({ token }) {
  const res = http.get(`${BASE_URL}/analytics/v1/teams/${TEAM_ID}/throughput`, {
    headers: authHeaders(token),
    tags: { name: 'throughput' },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
    '12 weekly buckets': (r) => r.json('weeks').length === 12,
  });

  sleep(1);
}
