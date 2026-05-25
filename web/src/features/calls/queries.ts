import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callsApi } from '@/api/calls';

export const callsKeys = {
  all: ['calls'] as const,
  active: (teamId: string) => [...callsKeys.all, 'active', teamId] as const,
};

export function useActiveCallQuery(teamId: string | undefined) {
  return useQuery({
    queryKey: teamId ? callsKeys.active(teamId) : ['noop-active-call'],
    queryFn: () => callsApi.getActive(teamId as string),
    enabled: !!teamId,
    // Cheap server-side check — refetch on window focus catches calls started
    // while the user was on another tab.
    refetchOnWindowFocus: true,
  });
}

export function useStartCall(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callsApi.start(teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: callsKeys.active(teamId) });
    },
  });
}

export function useJoinCall(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) => callsApi.join(teamId, callId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: callsKeys.active(teamId) });
    },
  });
}

export function useLeaveCall(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (callId: string) => callsApi.leave(teamId, callId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: callsKeys.active(teamId) });
    },
  });
}
