import { apiFetch } from './client';
import type {
  AcceptInvitationResult,
  CreateInvitationsResult,
  InvitationPreview,
  TeamInvitation,
  TeamRole,
} from './types';

export interface CreateInvitationsPayload {
  emails: string[];
  role?: Exclude<TeamRole, 'OWNER'>;
}

export const invitationsApi = {
  listForTeam: (teamId: string) =>
    apiFetch<TeamInvitation[]>(`/teams/${teamId}/invitations`),

  create: (teamId: string, payload: CreateInvitationsPayload) =>
    apiFetch<CreateInvitationsResult>(`/teams/${teamId}/invitations`, {
      method: 'POST',
      body: payload,
    }),

  revoke: (teamId: string, invitationId: string) =>
    apiFetch<void>(`/teams/${teamId}/invitations/${invitationId}`, {
      method: 'DELETE',
    }),

  /** Public — no auth required. */
  resolve: (token: string) =>
    apiFetch<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`, {
      auth: false,
    }),

  /** Requires authentication; matches the logged-in user's email to the invite. */
  accept: (token: string) =>
    apiFetch<AcceptInvitationResult>(
      `/invitations/${encodeURIComponent(token)}/accept`,
      { method: 'POST' },
    ),
};
