import type { Server, Socket } from 'socket.io';
import type { ChannelMembership } from '../types/events';

const REFRESH_EVENT = 'channels:refresh';

/**
 * Returns a function to wire per-socket behaviour: fetch channel memberships
 * via the api (using the socket's JWT), join the corresponding Socket.IO rooms,
 * and listen for `channels:refresh` so the frontend can ask us to re-sync after
 * creating a new channel.
 */
export function attachChatGateway(
  io: Server,
  apiBaseUrl: string,
  log: (msg: string) => void,
): (socket: Socket) => void {
  return (socket: Socket) => {
    const userId = socket.data.user?.id;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    void joinRoomsForUser(socket, apiBaseUrl, log);

    socket.on(REFRESH_EVENT, () => {
      void joinRoomsForUser(socket, apiBaseUrl, log);
    });
  };
}

async function joinRoomsForUser(
  socket: Socket,
  apiBaseUrl: string,
  log: (msg: string) => void,
): Promise<void> {
  // Forward the user's JWT so the api applies its standard auth and the same
  // visibility rules used by REST endpoints.
  const token =
    (socket.handshake.auth?.token as string | undefined) ??
    extractBearerFromHeader(socket.handshake.headers.authorization);

  if (!token) {
    socket.disconnect(true);
    return;
  }

  let memberships: ChannelMembership[];
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/users/me/channels`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      log(`channel-memberships fetch failed: ${response.status} for socket ${socket.id}`);
      memberships = [];
    } else {
      const body = (await response.json()) as { data: ChannelMembership[] };
      memberships = body.data ?? [];
    }
  } catch (err) {
    log(`channel-memberships fetch error for socket ${socket.id}: ${(err as Error).message}`);
    return;
  }

  // Leave rooms we previously joined (so revoked access actually revokes).
  for (const room of socket.rooms) {
    if (room.startsWith('channel:') || room.startsWith('team:')) {
      await socket.leave(room);
    }
  }

  const teamIds = new Set<string>();
  for (const m of memberships) {
    await socket.join(`channel:${m.channelId}`);
    teamIds.add(m.teamId);
  }
  for (const teamId of teamIds) {
    await socket.join(`team:${teamId}`);
  }
  log(
    `socket ${socket.id} (user ${socket.data.user?.id}) joined ${memberships.length} channel(s) across ${teamIds.size} team(s)`,
  );
}

function extractBearerFromHeader(header: string | string[] | undefined): string | undefined {
  if (typeof header !== 'string') return undefined;
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
}
