import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  teamsApi,
  type AddMembersPayload,
  type CreateTeamPayload,
  type UpdateTeamPayload,
} from '@/api/teams';
import type { TeamRole } from '@/api/types';

export const teamKeys = {
  all: ['teams'] as const,
  lists: () => [...teamKeys.all, 'list'] as const,
  detail: (teamId: string) => [...teamKeys.all, 'detail', teamId] as const,
  members: (teamId: string) => [...teamKeys.all, 'members', teamId] as const,
};

export function useTeamsQuery() {
  return useQuery({ queryKey: teamKeys.lists(), queryFn: teamsApi.list });
}

export function useTeamQuery(teamId: string) {
  return useQuery({
    queryKey: teamKeys.detail(teamId),
    queryFn: () => teamsApi.get(teamId),
    enabled: !!teamId,
  });
}

export function useTeamMembersQuery(teamId: string) {
  return useQuery({
    queryKey: teamKeys.members(teamId),
    queryFn: () => teamsApi.listMembers(teamId),
    enabled: !!teamId,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTeamPayload) => teamsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.lists() });
    },
  });
}

export function useUpdateTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTeamPayload) => teamsApi.update(teamId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.lists() });
      qc.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => teamsApi.delete(teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.lists() });
    },
  });
}

export function useAddMembers(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddMembersPayload) => teamsApi.addMembers(teamId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.members(teamId) });
      qc.invalidateQueries({ queryKey: teamKeys.lists() });
    },
  });
}

export function useUpdateMemberRole(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamRole }) =>
      teamsApi.updateMemberRole(teamId, userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.members(teamId) });
    },
  });
}

export function useRemoveMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(teamId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.members(teamId) });
      qc.invalidateQueries({ queryKey: teamKeys.lists() });
    },
  });
}

export function useLeaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => teamsApi.leave(teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.lists() });
    },
  });
}
