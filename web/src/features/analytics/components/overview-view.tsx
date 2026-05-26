import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOverviewQuery } from '../queries';
import { RecommendationsBanner } from './recommendations-banner';

interface OverviewViewProps {
  teamId: string;
  onJump?: (subTab: string) => void;
}

export function OverviewView({ teamId, onJump }: OverviewViewProps) {
  const { data, isLoading, error } = useOverviewQuery(teamId);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load overview: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RecommendationsBanner teamId={teamId} onJump={onJump} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Open tasks" value={isLoading ? null : data?.openTasks ?? 0} />
        <Stat label="Completed 7d" value={isLoading ? null : data?.completedLast7d ?? 0} />
        <Stat
          label="Overdue"
          value={isLoading ? null : data?.overdueCount ?? 0}
          tone={(data?.overdueCount ?? 0) > 0 ? 'warning' : 'neutral'}
        />
        <Stat
          label="Imbalance (max/median)"
          value={
            isLoading
              ? null
              : data?.maxMedianRatio != null
                ? `${data.maxMedianRatio.toFixed(1)}×`
                : '—'
          }
          tone={(data?.maxMedianRatio ?? 0) >= 2 ? 'warning' : 'neutral'}
        />
        <Stat
          label="Review p75"
          value={
            isLoading
              ? null
              : data?.reviewBacklogP75Days != null
                ? `${data.reviewBacklogP75Days.toFixed(1)}d`
                : '—'
          }
          tone={(data?.reviewBacklogP75Days ?? 0) >= 2 ? 'warning' : 'neutral'}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Headline numbers. Open detail tabs for charts, distributions, and time-in-status percentiles.
      </p>
    </div>
  );
}

interface StatProps {
  label: string;
  value: number | string | null;
  tone?: 'neutral' | 'warning';
}

function Stat({ label, value, tone = 'neutral' }: StatProps) {
  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {value === null ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <span
            className={
              tone === 'warning'
                ? 'text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400'
                : 'text-2xl font-semibold tabular-nums'
            }
          >
            {value}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
