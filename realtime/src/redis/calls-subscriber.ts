import Redis from 'ioredis';
import type { Server } from 'socket.io';
import type { CallEvent } from '../types/events';

const TEAM_PATTERN = 'team:*';

/**
 * Subscribes to `team:<id>` Redis topics the api publishes call events to.
 * Fans each event out to the matching Socket.IO room (`team:<id>`), which all
 * team members joined on connect (see chat.gateway.ts).
 *
 * Dedicated Redis connection — pub/sub clients cannot run regular commands.
 */
export function startCallsSubscriber(
  io: Server,
  redisUrl: string,
  log: (msg: string) => void,
): { close: () => Promise<void> } {
  const sub = new Redis(redisUrl);

  sub.psubscribe(TEAM_PATTERN).then(() => {
    log(`Subscribed to Redis pattern "${TEAM_PATTERN}"`);
  });

  sub.on('pmessage', (_pattern, topic, message) => {
    let event: CallEvent;
    try {
      event = JSON.parse(message) as CallEvent;
    } catch {
      log(`Dropping malformed event on ${topic}`);
      return;
    }

    const teamIdFromTopic = topic.split(':')[1];
    if (!teamIdFromTopic) return;

    const roomId = `team:${teamIdFromTopic}`;
    io.to(roomId).emit(event.type, event);
  });

  return {
    close: async () => {
      await sub.punsubscribe(TEAM_PATTERN);
      await sub.quit();
    },
  };
}
