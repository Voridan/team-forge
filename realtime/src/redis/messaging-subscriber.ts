import Redis from 'ioredis';
import type { Server } from 'socket.io';
import type { MessagingEvent } from '../types/events';

const CHANNEL_PATTERN = 'channel:*';

/**
 * Subscribes to all `channel:<id>` topics the api publishes to. For each event
 * it receives, it broadcasts to the matching Socket.IO room (`channel:<id>`)
 * so only sockets that have joined that room (per their channel membership
 * on handshake) receive the event.
 *
 * Uses a dedicated Redis connection separate from the adapter's pub/sub
 * because a single ioredis client cannot mix `SUBSCRIBE` with regular commands.
 */
export function startMessagingSubscriber(
  io: Server,
  redisUrl: string,
  log: (msg: string) => void,
): { close: () => Promise<void> } {
  const sub = new Redis(redisUrl);

  sub.psubscribe(CHANNEL_PATTERN).then(() => {
    log(`Subscribed to Redis pattern "${CHANNEL_PATTERN}"`);
  });

  sub.on('pmessage', (_pattern, channel, message) => {
    let event: MessagingEvent;
    try {
      event = JSON.parse(message) as MessagingEvent;
    } catch {
      log(`Dropping malformed event on ${channel}`);
      return;
    }

    // Guard against accidentally forwarding events with mismatched topics —
    // the topic is the source of truth for the room id.
    const channelIdFromTopic = channel.split(':')[1];
    if (!channelIdFromTopic) return;

    const roomId = `channel:${channelIdFromTopic}`;
    const room = io.to(roomId);

    switch (event.type) {
      case 'message:created':
      case 'message:edited':
        room.emit(event.type, { channelId: event.channelId, payload: event.payload });
        break;
      case 'message:deleted':
        room.emit(event.type, { channelId: event.channelId, messageId: event.messageId });
        break;
    }
  });

  return {
    close: async () => {
      await sub.punsubscribe(CHANNEL_PATTERN);
      await sub.quit();
    },
  };
}
