// Mirrors analytics/app/schemas/*.py. Keep in lockstep with the Python models.

export type Severity = 'info' | 'warning' | 'critical';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export interface OverviewResponse {
  teamId: string;
  openTasks: number;
  completedLast7d: number;
  overdueCount: number;
  maxMedianRatio: number | null;
  reviewBacklogP75Days: number | null;
  activeRecommendations: number;
}

export interface MemberLoad {
  userId: string;
  firstName: string;
  lastName: string;
  openCount: number;
  byStatus: Record<TaskStatus, number>;
  isOverloaded: boolean;
}

export interface WorkloadResponse {
  teamId: string;
  members: MemberLoad[];
  maxMedianRatio: number | null;
  upperFence: number | null;
}

export interface WeeklyBucket {
  weekStart: string; // ISO date
  created: number;
  completed: number;
}

export interface DueSoonTask {
  id: string;
  title: string;
  dueDate: string | null;
  status: TaskStatus;
  assigneeUserId: string | null;
}

export interface ThroughputResponse {
  teamId: string;
  weeks: WeeklyBucket[];
  movingAverage4w: (number | null)[];
  latestWeekCompleted: number;
  popDeltaPct: number | null;
  regressionSlope: number | null;
  zScore: number | null;
  overdueCount: number;
  dueSoon: DueSoonTask[];
}

export interface StatusStats {
  status: TaskStatus;
  sampleSize: number;
  meanDays: number | null;
  p50Days: number | null;
  p75Days: number | null;
  p95Days: number | null;
  weeklyP75Trend: (number | null)[];
}

export interface StuckTask {
  id: string;
  title: string;
  status: TaskStatus;
  enteredStatusAt: string; // ISO datetime
  ageDays: number;
  assigneeUserId: string | null;
}

export interface BottlenecksResponse {
  teamId: string;
  perStatus: StatusStats[];
  stuckTasks: StuckTask[];
}

export interface CfdPoint {
  date: string; // ISO date
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
}

export interface CfdResponse {
  teamId: string;
  points: CfdPoint[];
}

export interface Recommendation {
  id: string;
  severity: Severity;
  category: 'workload' | 'bottleneck' | 'throughput' | 'overdue';
  headline: string;
  body: string;
  metricLink: string | null;
}

export interface RecommendationsResponse {
  teamId: string;
  items: Recommendation[];
}
