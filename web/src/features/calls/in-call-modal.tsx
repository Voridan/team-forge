import '@livekit/components-styles';
import { LiveKitRoom, RoomAudioRenderer, VideoConference } from '@livekit/components-react';
import { toast } from 'sonner';
import { callsApi } from '@/api/calls';
import { useActiveCallStore } from './active-call-store';

/**
 * Full-screen overlay rendered while the user is in a call. Mounted once in
 * the app shell — when `active-call-store.session` is non-null, this takes
 * over the viewport.
 *
 * Uses LiveKit's prebuilt `VideoConference` for the layout, grid, and
 * mic/cam/leave controls. We hand it a token+url from the api response; the
 * LiveKitRoom component handles the actual WebRTC connection.
 *
 * Leave flow: VideoConference's leave button fires `onDisconnected`, which
 * POSTs the best-effort `/calls/{id}/me` so the UI reflects immediately. The
 * LiveKit `participant_left` webhook is the authoritative source of truth.
 */
export function InCallModal() {
  const session = useActiveCallStore((s) => s.session);
  const exit = useActiveCallStore((s) => s.exit);

  if (!session) return null;

  const handleDisconnect = async () => {
    try {
      await callsApi.leave(session.teamId, session.callId);
    } catch {
      // Webhook will still record the leave; UI shouldn't block on this.
    }
    exit();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <LiveKitRoom
        token={session.token}
        serverUrl={session.livekitUrl}
        connect={true}
        video={true}
        audio={true}
        onDisconnected={handleDisconnect}
        onError={(err) => {
          toast.error(`Call error: ${err.message}`);
        }}
        className="h-full w-full"
        data-lk-theme="default"
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
