import { Loader2, PhoneCall, PhoneIncoming } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/api/client';
import { useActiveCallStore } from './active-call-store';
import { useActiveCallQuery, useJoinCall, useStartCall } from './queries';

interface CallButtonProps {
  teamId: string;
}

/**
 * Renders "Start call" when no active call exists in the team, or "Join call"
 * when one is active and the user isn't already in it. Disabled (hidden)
 * once the user enters the call — the in-call modal owns the hangup control.
 */
export function CallButton({ teamId }: CallButtonProps) {
  const { data: active, isLoading } = useActiveCallQuery(teamId);
  const start = useStartCall(teamId);
  const join = useJoinCall(teamId);
  const session = useActiveCallStore((s) => s.session);
  const enter = useActiveCallStore((s) => s.enter);

  // If the user is already in a call (any team), don't offer to start another.
  if (session) return null;
  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="size-4 animate-spin" />
      </Button>
    );
  }

  const handleStart = async () => {
    try {
      const result = await start.mutateAsync();
      enter({
        teamId,
        callId: result.callId,
        livekitUrl: result.livekitUrl,
        token: result.token,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.problem.detail ?? err.message : 'Failed to start call';
      toast.error(msg);
    }
  };

  const handleJoin = async () => {
    if (!active) return;
    try {
      const result = await join.mutateAsync(active.callId);
      enter({
        teamId,
        callId: result.callId,
        livekitUrl: result.livekitUrl,
        token: result.token,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.problem.detail ?? err.message : 'Failed to join call';
      toast.error(msg);
    }
  };

  if (active) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={handleJoin}
        disabled={join.isPending}
        className="gap-2"
      >
        {join.isPending ? <Loader2 className="size-4 animate-spin" /> : <PhoneIncoming className="size-4" />}
        Join call ({active.participants.length})
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleStart}
      disabled={start.isPending}
      className="gap-2"
    >
      {start.isPending ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
      Start call
    </Button>
  );
}
