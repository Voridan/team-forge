import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';
import { messagingKeys } from '@/features/messaging/queries';
import {
  applyMessageCreated,
  applyMessageDeleted,
  applyMessageEdited,
} from './cache-bridge';
import { usePresenceStore, type PresenceStatus } from './presence-store';
import { connectSocket, disconnectSocket } from './socket-client';
import { useTypingStore } from './typing-store';
import type { Message } from '@/api/types';

interface IncomingPayload {
  channelId: string;
  payload?: Message;
  messageId?: string;
}

interface TypingUpdatePayload {
  channelId: string;
  userId: string;
  isTyping: boolean;
}

interface PresenceUpdatePayload {
  userId: string;
  status: PresenceStatus;
}

/**
 * Owns the Socket.IO connection lifecycle for the authenticated session.
 * - Connects when the user has an access token; disconnects on logout / unmount.
 * - Dispatches incoming `message:*` events into the TanStack Query cache so
 *   open chat views update instantly without an HTTP refetch.
 * - On reconnect (after a disconnect), invalidates all `messages` queries so
 *   any gap is closed by REST refetch — belt-and-suspenders for events missed
 *   during the disconnect window.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  // Use a ref so the auth subscriber can re-read the latest token without
  // re-creating the socket every render.
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      return;
    }

    const socket: Socket = connectSocket(() => accessTokenRef.current);

    socket.on('message:created', (event: IncomingPayload) => {
      if (!event.payload) return;
      const msg = event.payload;
      applyMessageCreated(qc, msg.teamId, event.channelId, msg);
    });

    socket.on('message:edited', (event: IncomingPayload) => {
      if (!event.payload) return;
      const msg = event.payload;
      applyMessageEdited(qc, msg.teamId, event.channelId, msg);
    });

    socket.on('message:deleted', (event: IncomingPayload) => {
      if (!event.messageId) return;
      // We don't have teamId in the deletion payload — invalidate by channel only.
      // The cache key includes teamId, so we touch any query keyed on this channel.
      qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === messagingKeys.all[0] &&
          q.queryKey[1] === 'messages' &&
          q.queryKey[3] === event.channelId,
      });
      // Optimistic local removal across whichever (teamId) instance is cached.
      qc.getQueriesData<unknown>({ queryKey: messagingKeys.all }).forEach(([key]) => {
        const teamId = key[2] as string | undefined;
        if (typeof teamId === 'string' && key[1] === 'messages' && key[3] === event.channelId) {
          applyMessageDeleted(qc, teamId, event.channelId, event.messageId!);
        }
      });
    });

    socket.on('typing:update', (event: TypingUpdatePayload) => {
      if (event.isTyping) {
        useTypingStore.getState().markTyping(event.channelId, event.userId);
      } else {
        useTypingStore.getState().markStopped(event.channelId, event.userId);
      }
    });

    socket.on('presence:changed', (event: PresenceUpdatePayload) => {
      usePresenceStore.getState().setStatus(event.userId, event.status);
    });

    socket.io.on('reconnect', () => {
      // Refetch all messages queries to fill any gap during the disconnect.
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === messagingKeys.all[0] && q.queryKey[1] === 'messages',
      });
      // Presence after a disconnect is stale — clear and let events repopulate.
      usePresenceStore.getState().clear();
    });

    socket.on('connect_error', (err) => {
      // Swallow noisily — only surface in dev console. Auth failures will keep
      // retrying with whatever the current token is; once it refreshes, recovery is automatic.
      console.warn('[realtime] connect_error:', err.message);
    });

    return () => {
      socket.off('message:created');
      socket.off('message:edited');
      socket.off('message:deleted');
      socket.off('typing:update');
      socket.off('presence:changed');
      socket.off('connect_error');
      socket.io.off('reconnect');
    };
  }, [accessToken, qc]);

  // Final cleanup on app unmount (rare in SPAs but keeps tests sane).
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  return <>{children}</>;
}
