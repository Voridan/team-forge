import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invitationsApi, type CreateInvitationsPayload } from '@/api/invitations';
import { teamKeys } from '@/features/teams/queries';

export const invitationKeys = {
  all: ['invitations'] as const,
  team: (teamId: string) => [...invitationKeys.all, 'team', teamId] as const,
  preview: (token: string) => [...invitationKeys.all, 'preview', token] as const,
};

export function useTeamInvitationsQuery(teamId: string) {
  return useQuery({
    queryKey: invitationKeys.team(teamId),
    queryFn: () => invitationsApi.listForTeam(teamId),
    enabled: !!teamId,
  });
}

export function useCreateInvitations(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInvitationsPayload) => invitationsApi.create(teamId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invitationKeys.team(teamId) });
    },
  });
}

export function useRevokeInvitation(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => invitationsApi.revoke(teamId, invitationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invitationKeys.team(teamId) });
    },
  });
}

export function useInvitationPreview(token: string | null) {
  return useQuery({
    queryKey: token ? invitationKeys.preview(token) : ['noop'],
    queryFn: () => invitationsApi.resolve(token as string),
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => invitationsApi.accept(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.lists() });
    },
  });
}
