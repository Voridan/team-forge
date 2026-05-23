import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { jwtHandshake } from './auth/jwt-handshake';
import { attachChatGateway } from './gateway/chat.gateway';
import { attachPresenceGateway } from './gateway/presence.gateway';
import { attachTypingGateway } from './gateway/typing.gateway';
import { attachRedisAdapter } from './redis/redis-adapter';
import { startMessagingSubscriber } from './redis/messaging-subscriber';
import { attachSocketRateLimiter } from './rate-limit/socket-rate-limiter';

const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const REDIS_URL = process.env.REDIS_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const API_URL = process.env.API_URL || 'http://api:3000';
const MAX_HTTP_BUFFER_SIZE = 1_000_000; // 1 MB cap on emit payloads
const DISCONNECTION_RECOVERY_MS = 2 * 60 * 1000;
const PING_INTERVAL_MS = 25_000;
const PING_TIMEOUT_MS = 20_000;

if (!REDIS_URL) {
  console.error('REDIS_URL is required');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error('JWT_SECRET is required');
  process.exit(1);
}

const log = (msg: string) => console.log(`[realtime] ${msg}`);

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'realtime' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(',').map((s) => s.trim()),
    methods: ['GET', 'POST'],
    credentials: false,
  },
  maxHttpBufferSize: MAX_HTTP_BUFFER_SIZE,
  pingInterval: PING_INTERVAL_MS,
  pingTimeout: PING_TIMEOUT_MS,
  connectionStateRecovery: {
    maxDisconnectionDuration: DISCONNECTION_RECOVERY_MS,
    skipMiddlewares: false, // re-authenticate on resume — never trust a stale handshake
  },
});

const redisAdapter = attachRedisAdapter(io, REDIS_URL);
const subscriber = startMessagingSubscriber(io, REDIS_URL, log);
const rateLimiter = attachSocketRateLimiter(REDIS_URL);

io.use(jwtHandshake(JWT_SECRET));

const wireChat = attachChatGateway(io, API_URL, log);
const wirePresence = attachPresenceGateway(io);
const wireTyping = attachTypingGateway(io);

io.on('connection', (socket) => {
  rateLimiter.apply(socket);
  wireChat(socket);
  wirePresence(socket);
  wireTyping(socket);

  const userId = socket.data.user?.id;
  log(`connect socket=${socket.id} user=${userId ?? 'unknown'}`);

  socket.on('disconnect', (reason) => {
    log(`disconnect socket=${socket.id} reason=${reason}`);
  });
});

httpServer.listen(PORT, () => {
  log(`listening on :${PORT}, cors=${CORS_ORIGIN}, api=${API_URL}`);
});

const shutdown = async (signal: string) => {
  log(`received ${signal}, shutting down…`);
  await Promise.allSettled([
    subscriber.close(),
    redisAdapter.close(),
    rateLimiter.close(),
    new Promise<void>((resolve) => io.close(() => resolve())),
  ]);
  httpServer.close(() => process.exit(0));
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

export { io, httpServer };
