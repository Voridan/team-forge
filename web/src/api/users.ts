import { apiFetch } from './client';
import type { PublicUser } from './types';

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  timezone?: string;
}

export const usersApi = {
  getMe: () => apiFetch<PublicUser>('/users/me'),

  updateMe: (payload: UpdateUserPayload) =>
    apiFetch<PublicUser>('/users/me', { method: 'PATCH', body: payload }),

  getById: (id: string) => apiFetch<PublicUser>(`/users/${id}`),

  search: (query: string, limit = 20) =>
    apiFetch<PublicUser[]>(
      `/users/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),
};
