import { useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { callsApi } from '@/api/calls';
import { Button } from '@/components/ui/button';
import { useActiveCallStore } from './active-call-store';
import { useIncomingCallStore } from './incoming-call-store';

/**
 * Watches the incoming-call store and surfaces an accept/decline toast via
 * sonner. Mounted once at the app shell so it floats over any route.
 *
 * Accept → POST /calls/{id}/join, enters the active-call store (in-call modal
 *   takes over the screen).
 * Decline → just dismisses the toast locally; no server-side decline yet.
 */
export function IncomingCallToast() {
  const incoming = useIncomingCallStore((s) => s.current);
  const dismiss = useIncomingCallStore((s) => s.dismiss);
  const enter = useActiveCallStore((s) => s.enter);
  const inCall = useActiveCallStore((s) => s.session !== null);

  useEffect(() => {
    if (!incoming) return;
    if (inCall) {
      // Already on a call — silently drop the notification.
      dismiss();
      return;
    }

    const toastId = toast.custom(
      () => (
        <div className="flex items-center gap-3 rounded-lg border bg-background p-3 shadow-lg">
          <Phone className="size-5 text-primary" />
          <div className="flex-1 text-sm font-medium">Incoming call</div>
          <Button
            size="sm"
            onClick={async () => {
              try {
                const result = await callsApi.join(incoming.teamId, incoming.callId);
                enter({
                  teamId: incoming.teamId,
                  callId: result.callId,
                  livekitUrl: result.livekitUrl,
                  token: result.token,
                });
                dismiss();
                toast.dismiss(toastId);
              } catch (err) {
                const msg =
                  err instanceof ApiError
                    ? err.problem.detail ?? err.message
                    : 'Failed to join call';
                toast.error(msg);
              }
            }}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              dismiss();
              toast.dismiss(toastId);
            }}
          >
            <PhoneOff className="size-4" />
          </Button>
        </div>
      ),
      { duration: 30_000, position: 'top-center' },
    );

    return () => {
      toast.dismiss(toastId);
    };
  }, [incoming, dismiss, enter, inCall]);

  return null;
}
