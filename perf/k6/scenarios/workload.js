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
  const res = http.get(`${BASE_URL}/analytics/v1/teams/${TEAM_ID}/workload`, {
    headers: authHeaders(token),
    tags: { name: 'workload' },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
    'has members[]': (r) => Array.isArray(r.json('members')),
  });

  sleep(1);
}
