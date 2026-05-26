import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from './api';

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (teamId: string) => [...analyticsKeys.all, 'overview', teamId] as const,
  workload: (teamId: string) => [...analyticsKeys.all, 'workload', teamId] as const,
  throughput: (teamId: string) => [...analyticsKeys.all, 'throughput', teamId] as const,
  bottlenecks: (teamId: string) => [...analyticsKeys.all, 'bottlenecks', teamId] as const,
  cfd: (teamId: string) => [...analyticsKeys.all, 'cfd', teamId] as const,
  recommendations: (teamId: string) =>
    [...analyticsKeys.all, 'recommendations', teamId] as const,
};

// Analytics is read-mostly and tolerable to mild staleness. Cache for 1 min,
// keep in memory for 5 min, refetch on focus disabled (avoids hammering the
// service every tab switch).
const COMMON_OPTS = {
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
} as const;

export function useOverviewQuery(teamId: string, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.overview(teamId),
    queryFn: () => analyticsApi.overview(teamId),
    enabled: enabled && !!teamId,
    ...COMMON_OPTS,
  });
}

export function useWorkloadQuery(teamId: string, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.workload(teamId),
    queryFn: () => analyticsApi.workload(teamId),
    enabled: enabled && !!teamId,
    ...COMMON_OPTS,
  });
}

export function useThroughputQuery(teamId: string, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.throughput(teamId),
    queryFn: () => analyticsApi.throughput(teamId),
    enabled: enabled && !!teamId,
    ...COMMON_OPTS,
  });
}

export function useBottlenecksQuery(teamId: string, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.bottlenecks(teamId),
    queryFn: () => analyticsApi.bottlenecks(teamId),
    enabled: enabled && !!teamId,
    ...COMMON_OPTS,
  });
}

export function useCfdQuery(teamId: string, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.cfd(teamId),
    queryFn: () => analyticsApi.cfd(teamId),
    enabled: enabled && !!teamId,
    ...COMMON_OPTS,
  });
}

export function useRecommendationsQuery(teamId: string, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.recommendations(teamId),
    queryFn: () => analyticsApi.recommendations(teamId),
    enabled: enabled && !!teamId,
    ...COMMON_OPTS,
  });
}
