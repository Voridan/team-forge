import http from 'k6/http';
import { check, fail } from 'k6';
import { BASE_URL, PASSWORD, USERNAME } from './config.js';

/**
 * Logs in once during the k6 `setup()` phase and returns a JWT for every VU
 * to reuse. Saves one POST per request and keeps the auth flow out of the
 * timing distribution we care about.
 */
export function login() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: USERNAME, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login' } },
  );

  const ok = check(res, { 'login 200': (r) => r.status === 200 });
  if (!ok) {
    fail(`login failed: status=${res.status} body=${res.body}`);
  }

  // Real shape: { data: { user, tokens: { accessToken, refreshToken } } }.
  // Other fallbacks are defensive in case the envelope changes.
  const body = res.json();
  const token =
    body?.data?.tokens?.accessToken ??
    body?.tokens?.accessToken ??
    body?.data?.accessToken ??
    body?.accessToken;
  if (!token) fail(`no accessToken in login response: ${res.body}`);
  return token;
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}
