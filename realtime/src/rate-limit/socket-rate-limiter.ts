import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import type { Socket } from 'socket.io';

const EVENTS_PER_MINUTE = 60;
const WINDOW_SECONDS = 60;
const KEY_PREFIX = 'rt:rl:sock';

/**
 * Per-socket event rate limiter. Each emit from the client passes through the
 * `socket.use(...)` middleware; we consume one token per event. Exceeding the
 * limit disconnects the socket and surfaces a `rate_limit` error on the client.
 *
 * Redis-backed so limits hold across multiple realtime instances. The key is
 * (socket.id, userId) — using userId alone would let an attacker exhaust the
 * limit by closing/reopening sockets faster than the window.
 */
export function attachSocketRateLimiter(redisUrl: string): {
  apply: (socket: Socket) => void;
  close: () => Promise<void>;
} {
  const redis = new Redis(redisUrl, { enableOfflineQueue: false });

  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: KEY_PREFIX,
    points: EVENTS_PER_MINUTE,
    duration: WINDOW_SECONDS,
  });

  return {
    apply(socket: Socket): void {
      socket.use((_event, next) => {
        const userId = socket.data.user?.id ?? 'anon';
        limiter
          .consume(`${userId}:${socket.id}`)
          .then(() => next())
          .catch(() => {
            next(new Error('rate_limit'));
            socket.disconnect(true);
          });
      });
    },
    async close(): Promise<void> {
      await redis.quit();
    },
  };
}
