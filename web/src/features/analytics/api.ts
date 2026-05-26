import { analyticsFetch } from '@/api/client';
import type {
  BottlenecksResponse,
  CfdResponse,
  OverviewResponse,
  RecommendationsResponse,
  ThroughputResponse,
  WorkloadResponse,
} from './types';

export const analyticsApi = {
  overview: (teamId: string) =>
    analyticsFetch<OverviewResponse>(`/teams/${teamId}/overview`),

  workload: (teamId: string) =>
    analyticsFetch<WorkloadResponse>(`/teams/${teamId}/workload`),

  throughput: (teamId: string) =>
    analyticsFetch<ThroughputResponse>(`/teams/${teamId}/throughput`),

  bottlenecks: (teamId: string) =>
    analyticsFetch<BottlenecksResponse>(`/teams/${teamId}/bottlenecks`),

  cfd: (teamId: string) =>
    analyticsFetch<CfdResponse>(`/teams/${teamId}/bottlenecks/cfd`),

  recommendations: (teamId: string) =>
    analyticsFetch<RecommendationsResponse>(`/teams/${teamId}/recommendations`),
};
