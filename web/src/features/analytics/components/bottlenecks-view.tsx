import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBottlenecksQuery, useCfdQuery } from '../queries';
import { CfdChart } from './charts/cfd-chart';
import { Sparkline } from './charts/sparkline';

interface BottlenecksViewProps {
  teamId: string;
}

export function BottlenecksView({ teamId }: BottlenecksViewProps) {
  const { data, isLoading, error } = useBottlenecksQuery(teamId);
  const cfdQuery = useCfdQuery(teamId);

  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (error) {
    return (
      <div className="text-sm text-destructive">
        Failed to load bottlenecks: {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Time-in-status (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Sample</th>
                <th className="px-4 py-2 text-right">Mean (d)</th>
                <th className="px-4 py-2 text-right">p50</th>
                <th className="px-4 py-2 text-right">p75</th>
                <th className="px-4 py-2 text-right">p95</th>
                <th className="px-4 py-2 text-left">Weekly p75 trend</th>
              </tr>
            </thead>
            <tbody>
              {data.perStatus.map((s) => (
                <tr key={s.status} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{s.status}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.sampleSize}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(s.meanDays)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(s.p50Days)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(s.p75Days)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(s.p95Days)}</td>
                  <td className="px-4 py-2" style={{ minWidth: 120 }}>
                    <Sparkline values={s.weeklyP75Trend} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-muted-foreground">
            Dwell time = duration spent in a status before transitioning out. IN_REVIEW
            p75 is the headline bottleneck signal.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Stuck tasks ({data.stuckTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.stuckTasks.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No tasks currently exceed their status's historical p75 dwell time.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Task</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Days in status</th>
                </tr>
              </thead>
              <tbody>
                {data.stuckTasks.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{t.title}</td>
                    <td className="px-4 py-2">
                      <Badge variant="warning">{t.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {t.ageDays.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cumulative Flow Diagram (90 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {cfdQuery.isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : cfdQuery.data && cfdQuery.data.points.length > 0 ? (
            <CfdChart data={cfdQuery.data.points} />
          ) : (
            <p className="text-sm text-muted-foreground">No data yet for the CFD window.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Each band is the count of tasks in that status on that day. Widening bands
            indicate bottlenecks (work accumulating in a stage).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function fmt(v: number | null): string {
  return v == null ? '—' : v.toFixed(1);
}
