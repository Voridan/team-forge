import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkloadQuery } from '../queries';
import { MemberLoadChart } from './charts/weekly-bar-chart';

interface WorkloadViewProps {
  teamId: string;
}

export function WorkloadView({ teamId }: WorkloadViewProps) {
  const { data, isLoading, error } = useWorkloadQuery(teamId);

  if (isLoading) {
    return <Skeleton className="h-80 w-full" />;
  }
  if (error) {
    return (
      <div className="text-sm text-destructive">
        Failed to load workload: {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  const chartData = data.members.map((m) => ({
    label: `${m.firstName} ${m.lastName}`,
    value: m.openCount,
    isOutlier: m.isOverloaded,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Imbalance (max / median)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold tabular-nums">
              {data.maxMedianRatio != null ? `${data.maxMedianRatio.toFixed(2)}×` : '—'}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              1.0× = perfectly even load. ≥ 2× warrants rebalancing.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Outlier fence (Q3 + 1.5·IQR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold tabular-nums">
              {data.upperFence != null ? data.upperFence.toFixed(1) : '—'}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              Members with open count above this are flagged overloaded.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Overloaded members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold tabular-nums">
              {data.members.filter((m) => m.isOverloaded).length}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              Above the IQR upper fence.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open tasks per member</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <MemberLoadChart data={chartData} height={Math.max(220, chartData.length * 32)} />
          ) : (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-member breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Member</th>
                <th className="px-4 py-2 text-right">TODO</th>
                <th className="px-4 py-2 text-right">In progress</th>
                <th className="px-4 py-2 text-right">In review</th>
                <th className="px-4 py-2 text-right">Total open</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.userId} className="border-b last:border-b-0">
                  <td className="px-4 py-2">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.byStatus.TODO}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.byStatus.IN_PROGRESS}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.byStatus.IN_REVIEW}
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {m.openCount}
                  </td>
                  <td className="px-4 py-2">
                    {m.isOverloaded ? (
                      <Badge variant="destructive">Overloaded</Badge>
                    ) : (
                      <Badge variant="secondary">Normal</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
