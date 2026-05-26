import { io, Socket } from 'socket.io-client';

// Two routing modes:
//   - Dev: VITE_REALTIME_URL set → connect directly to the realtime service
//     (http://localhost:3001), bypassing Vite's WebSocket proxy. Vite's proxy
//     drops the `Connection: Upgrade` header for Socket.IO, forcing a
//     polling-only fallback. Direct connect avoids that.
//   - Prod: VITE_REALTIME_URL empty → connect via page origin. Nginx routes
//     /ws/ to realtime (with trailing-slash prefix strip) and handles the
//     WebSocket upgrade correctly.
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? '';
const WS_PATH = REALTIME_URL ? '/socket.io' : '/ws/socket.io';

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

  const socket = io(REALTIME_URL, {
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
