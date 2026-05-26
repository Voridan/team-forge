import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRecommendationsQuery } from '../queries';
import type { Recommendation, Severity } from '../types';

interface RecommendationsBannerProps {
  teamId: string;
  onJump?: (link: string) => void;
}

const SEVERITY_ICON: Record<Severity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  critical: ShieldAlert,
};

const SEVERITY_TONE: Record<Severity, string> = {
  info: 'border-l-sky-500 bg-sky-500/5',
  warning: 'border-l-amber-500 bg-amber-500/5',
  critical: 'border-l-destructive bg-destructive/5',
};

const SEVERITY_BADGE_VARIANT: Record<Severity, 'secondary' | 'warning' | 'destructive'> = {
  info: 'secondary',
  warning: 'warning',
  critical: 'destructive',
};

export function RecommendationsBanner({ teamId, onJump }: RecommendationsBannerProps) {
  const { data, isLoading } = useRecommendationsQuery(teamId);

  if (isLoading) {
    return (
      <div className="h-20 animate-pulse rounded-lg border bg-muted/30" />
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No active recommendations. Team metrics are within configured thresholds.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.items.map((rec) => (
        <RecommendationCard key={rec.id} rec={rec} onJump={onJump} />
      ))}
    </div>
  );
}

function RecommendationCard({
  rec,
  onJump,
}: {
  rec: Recommendation;
  onJump?: (link: string) => void;
}) {
  const Icon = SEVERITY_ICON[rec.severity];
  return (
    <div
      className={cn(
        'rounded-md border border-l-4 p-3 text-sm',
        SEVERITY_TONE[rec.severity],
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            'mt-0.5 size-4 shrink-0',
            rec.severity === 'critical' && 'text-destructive',
            rec.severity === 'warning' && 'text-amber-600',
            rec.severity === 'info' && 'text-sky-600',
          )}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{rec.headline}</span>
            <Badge variant={SEVERITY_BADGE_VARIANT[rec.severity]}>{rec.severity}</Badge>
            <Badge variant="outline">{rec.category}</Badge>
          </div>
          <p className="text-muted-foreground">{rec.body}</p>
          {rec.metricLink && onJump && (
            <button
              type="button"
              onClick={() => onJump(rec.metricLink!)}
              className="text-xs font-medium text-primary hover:underline"
            >
              View {rec.metricLink} details →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
