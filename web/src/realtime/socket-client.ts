import { io, Socket } from 'socket.io-client';

const WS_PATH = '/socket.io';
const WS_URL = '/ws';

let currentSocket: Socket | null = null;

/**
 * Lazily creates a single Socket.IO connection. We pass `auth.token` rather
 * than an Authorization header because Socket.IO's WS upgrade path strips
 * custom headers in some browsers, but the `auth` payload is always preserved.
 *
 * The realtime server's `jwtHandshake` middleware reads from both `auth.token`
 * and the Authorization header, so either would work — we use `auth` because
 * the official client docs prefer it.
 */
export function connectSocket(getToken: () => string | null): Socket {
  if (currentSocket?.connected || currentSocket?.active) return currentSocket;

  const socket = io(WS_URL, {
    path: WS_PATH,
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    auth: (cb) => {
      // Called for every (re)connect attempt — re-reads the latest token so a
      // refreshed access token is automatically used on reconnect.
      const token = getToken();
      cb({ token: token ?? '' });
    },
  });

  currentSocket = socket;
  return socket;
}

export function disconnectSocket(): void {
  if (currentSocket) {
    currentSocket.removeAllListeners();
    currentSocket.disconnect();
    currentSocket = null;
  }
}

export function getSocket(): Socket | null {
  return currentSocket;
}
