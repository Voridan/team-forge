/**
 * Shared k6 configuration. Override any value via env, e.g.
 *   K6_BASE_URL=http://localhost K6_USERNAME=alice@example.com k6 run scenarios/overview.js
 */
export const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost';
export const USERNAME = __ENV.K6_USERNAME || 'alice@example.com';
export const PASSWORD = __ENV.K6_PASSWORD || 'Password123!';

// Target team for analytics endpoints. The demo seed assigns this fixed UUID
// to the analytics demo team owned by bogdanvorobienko@gmail.com — you'll
// need to be an admin of this team to hit /analytics. Override per-scenario:
//   K6_TEAM_ID=00000000-0000-0000-0000-0000000d0000 k6 run scenarios/overview.js
export const TEAM_ID = __ENV.K6_TEAM_ID || '00000000-0000-0000-0000-0000000d0000';

// Default thresholds applied per scenario unless overridden.
// SLOs are picked to flag clear regressions, not to enforce a hard SLA.
export const DEFAULT_THRESHOLDS = {
  http_req_failed: ['rate<0.01'], // <1% non-2xx
  http_req_duration: ['p(95)<800', 'p(99)<2000'],
};

// CFD is the heaviest endpoint (90-day per-task replay). Looser thresholds.
export const HEAVY_THRESHOLDS = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<3000', 'p(99)<6000'],
};

// Standard ramp shared by light endpoints.
export const RAMP_LIGHT = [
  { duration: '20s', target: 10 },
  { duration: '40s', target: 10 },
  { duration: '10s', target: 0 },
];

// Lower concurrency for the CFD endpoint (matches the server's 10/min limit).
export const RAMP_HEAVY = [
  { duration: '20s', target: 3 },
  { duration: '40s', target: 3 },
  { duration: '10s', target: 0 },
];
