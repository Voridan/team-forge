import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server } from 'socket.io';

/**
 * Configures the Redis adapter so multiple realtime instances can coordinate
 * emits. Without this, a `io.to('room').emit()` only reaches sockets connected
 * to the same Node process.
 *
 * Uses a pub + sub pair (the adapter requires distinct connections — a Redis
 * client in subscribe mode can't issue regular commands).
 */
export function attachRedisAdapter(io: Server, redisUrl: string): { close: () => Promise<void> } {
  const pub = new Redis(redisUrl);
  const sub = pub.duplicate();

  io.adapter(createAdapter(pub, sub));

  return {
    close: async () => {
      await Promise.all([pub.quit(), sub.quit()]);
    },
  };
}
