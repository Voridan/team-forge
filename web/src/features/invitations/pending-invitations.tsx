import { formatDistanceToNow, parseISO } from 'date-fns';
import { Mail, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRevokeInvitation, useTeamInvitationsQuery } from './queries';

interface PendingInvitationsProps {
  teamId: string;
  canRevoke: boolean;
}

export function PendingInvitations({ teamId, canRevoke }: PendingInvitationsProps) {
  const { data: invitations, isLoading } = useTeamInvitationsQuery(teamId);
  const revoke = useRevokeInvitation(teamId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!invitations || invitations.length === 0) return null;

  const onRevoke = (id: string, email: string) => {
    if (!confirm(`Revoke invitation for ${email}?`)) return;
    revoke.mutate(id, {
      onSuccess: () => toast.success(`Revoked invitation for ${email}`),
      onError: (err) =>
        toast.error(
          err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed',
        ),
    });
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Pending invitations
      </h3>
      <ul className="space-y-1.5">
        {invitations.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center gap-3 rounded-lg border bg-card/40 px-3 py-2"
          >
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{inv.email}</p>
              <p className="text-[11px] text-muted-foreground">
                {inv.role.toLowerCase()} · expires{' '}
                {formatDistanceToNow(parseISO(inv.expiresAt), { addSuffix: true })}
              </p>
            </div>
            {canRevoke && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Revoke invitation for ${inv.email}`}
                onClick={() => onRevoke(inv.id, inv.email)}
              >
                <X className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
