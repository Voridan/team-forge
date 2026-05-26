import type { Server, Socket } from 'socket.io';

type PresenceStatus = 'ONLINE' | 'OFFLINE';

/**
 * Per-instance presence state. For multi-instance deployments swap for Redis
 * (SADD "presence:{userId}" {socket.id}; OFFLINE only on empty set).
 *
 * Map<userId, Set<socket.id>> — tracks every active socket per user so a user
 * stays ONLINE while at least one tab/window is connected.
 */
const socketsByUser = new Map<string, Set<string>>();

function addSocket(userId: string, socketId: string): { wasOffline: boolean } {
  let set = socketsByUser.get(userId);
  if (!set) {
    set = new Set();
    socketsByUser.set(userId, set);
  }
  const wasOffline = set.size === 0;
  set.add(socketId);
  return { wasOffline };
}

function removeSocket(userId: string, socketId: string): { wentOffline: boolean } {
  const set = socketsByUser.get(userId);
  if (!set) return { wentOffline: false };
  set.delete(socketId);
  if (set.size === 0) {
    socketsByUser.delete(userId);
    return { wentOffline: true };
  }
  return { wentOffline: false };
}

/**
 * Broadcasts presence changes to the user's team rooms. The chat gateway is
 * responsible for joining the socket to `team:<teamId>` rooms on connect.
 * Falls back to the user's channel rooms if no team rooms are joined yet.
 */
function broadcastPresence(socket: Socket, userId: string, status: PresenceStatus): void {
  const teamRooms = Array.from(socket.rooms).filter((r) => r.startsWith('team:'));
  if (teamRooms.length > 0) {
    socket
      .to(teamRooms)
      .except(socket.id)
      .emit('presence:changed', { userId, status });
    return;
  }
  // Fallback: at least notify channels the socket is in. Happens during a brief
  // window if team rooms haven't been joined yet (chat gateway runs async).
  const channelRooms = Array.from(socket.rooms).filter((r) => r.startsWith('channel:'));
  if (channelRooms.length > 0) {
    socket
      .to(channelRooms)
      .except(socket.id)
      .emit('presence:changed', { userId, status });
  }
}

export function attachPresenceGateway(io: Server): (socket: Socket) => void {
  return (socket: Socket) => {
    const userId = socket.data.user?.id;
    if (!userId) return;

    const { wasOffline } = addSocket(userId, socket.id);
    if (wasOffline) {
      // Defer one tick so chat.gateway has had a chance to join team rooms.
      setImmediate(() => broadcastPresence(socket, userId, 'ONLINE'));
    }

    socket.on('disconnect', () => {
      const { wentOffline } = removeSocket(userId, socket.id);
      if (wentOffline) {
        broadcastPresence(socket, userId, 'OFFLINE');
      }
    });
  };
}

/**
 * Exposes the current online userIds — used by a small REST endpoint on the
 * realtime side so newly-connected clients can hydrate their presence state.
 * (Not implemented in this iteration — fetched lazily as events arrive.)
 */
export function getOnlineUserIds(): string[] {
  return Array.from(socketsByUser.keys());
}
