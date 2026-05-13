import { apiFetch } from './client';
import type { Team, TeamMemberPublic, TeamRole, TeamSummary } from './types';

export interface CreateTeamPayload {
  name: string;
  description?: string;
}

export interface UpdateTeamPayload {
  name?: string;
  description?: string;
}

export interface AddMembersPayload {
  userIds: string[];
  role?: Exclude<TeamRole, 'OWNER'>;
}

export const teamsApi = {
  list: () => apiFetch<TeamSummary[]>('/teams'),

  get: (teamId: string) => apiFetch<Team>(`/teams/${teamId}`),

  create: (payload: CreateTeamPayload) =>
    apiFetch<Team>('/teams', { method: 'POST', body: payload }),

  update: (teamId: string, payload: UpdateTeamPayload) =>
    apiFetch<Team>(`/teams/${teamId}`, { method: 'PATCH', body: payload }),

  delete: (teamId: string) =>
    apiFetch<void>(`/teams/${teamId}`, { method: 'DELETE' }),

  listMembers: (teamId: string) =>
    apiFetch<TeamMemberPublic[]>(`/teams/${teamId}/members`),

  addMembers: (teamId: string, payload: AddMembersPayload) =>
    apiFetch<{ added: { userId: string; role: TeamRole }[] }>(
      `/teams/${teamId}/members`,
      { method: 'POST', body: payload },
    ),

  updateMemberRole: (teamId: string, userId: string, role: TeamRole) =>
    apiFetch<void>(`/teams/${teamId}/members/${userId}`, {
      method: 'PATCH',
      body: { role },
    }),

  removeMember: (teamId: string, userId: string) =>
    apiFetch<void>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),

  leave: (teamId: string) =>
    apiFetch<void>(`/teams/${teamId}/leave`, { method: 'POST' }),
};
