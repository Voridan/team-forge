import { apiFetch } from './client';
import type { ActiveCallView, CallTokenView } from './types';

export const callsApi = {
  start: (teamId: string) =>
    apiFetch<CallTokenView>(`/teams/${teamId}/calls`, { method: 'POST' }),

  join: (teamId: string, callId: string) =>
    apiFetch<CallTokenView>(`/teams/${teamId}/calls/${callId}/join`, {
      method: 'POST',
    }),

  leave: (teamId: string, callId: string) =>
    apiFetch<void>(`/teams/${teamId}/calls/${callId}/me`, { method: 'DELETE' }),

  getActive: (teamId: string) =>
    apiFetch<ActiveCallView | null>(`/teams/${teamId}/calls/active`),
};
