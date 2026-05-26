import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useThroughputQuery } from '../queries';
import { WeeklyBarChart } from './charts/weekly-bar-chart';

interface ThroughputViewProps {
  teamId: string;
}

export function ThroughputView({ teamId }: ThroughputViewProps) {
  const { data, isLoading, error } = useThroughputQuery(teamId);

  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (error) {
    return (
      <div className="text-sm text-destructive">
        Failed to load throughput: {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  const chartData = data.weeks.map((w, i) => ({
    weekStart: w.weekStart,
    created: w.created,
    completed: w.completed,
    ma: data.movingAverage4w[i] ?? null,
  }));

  const delta = data.popDeltaPct;
  const deltaLabel =
    delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`;
  const deltaTone =
    delta == null ? 'neutral' : delta < 0 ? 'down' : 'up';

  const slope = data.regressionSlope;
  const slopeLabel = slope == null ? '—' : `${slope.toFixed(2)}/wk`;
  const z = data.zScore;
  const zLabel = z == null ? '—' : z.toFixed(2);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Last week" value={data.latestWeekCompleted} />
        <Stat label="PoP delta" value={deltaLabel} tone={deltaTone === 'down' ? 'warning' : 'neutral'} />
        <Stat label="Slope (linreg)" value={slopeLabel} />
        <Stat label="z-score (latest)" value={zLabel} />
        <Stat label="Overdue" value={data.overdueCount} tone={data.overdueCount > 0 ? 'warning' : 'neutral'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly throughput (12 weeks)</CardTitle>
        </CardHeader>
        <CardContent>
          <WeeklyBarChart data={chartData} />
          <p className="mt-2 text-xs text-muted-foreground">
            Bars: tasks created (gray) vs completed (green) per ISO week. Blue line: 4-week moving average of completions.
          </p>
        </CardContent>
      </Card>

      {data.dueSoon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Due in the next 7 days ({data.dueSoon.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Task</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Due</th>
                </tr>
              </thead>
              <tbody>
                {data.dueSoon.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{t.title}</td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary">{t.status}</Badge>
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span
          className={
            tone === 'warning'
              ? 'text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400'
              : 'text-2xl font-semibold tabular-nums'
          }
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
