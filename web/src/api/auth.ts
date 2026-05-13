import { apiFetch } from './client';
import type { AuthResponse, TokenPair } from './types';

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: payload, auth: false }),

  login: (payload: LoginPayload) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: payload, auth: false }),

  refresh: (refreshToken: string) =>
    apiFetch<TokenPair>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    }),

  logout: (refreshToken: string) =>
    apiFetch<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),

  oauthLogin: (provider: 'google', idToken: string) =>
    apiFetch<AuthResponse>(`/auth/oauth/${provider}`, {
      method: 'POST',
      body: { idToken },
      auth: false,
    }),
};
