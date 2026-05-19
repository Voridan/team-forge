import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvironmentVariables } from '../../config/env.validation';

export type MessagingEvent =
  | { type: 'message:created'; channelId: string; teamId: string; payload: unknown }
  | { type: 'message:edited';  channelId: string; teamId: string; payload: unknown }
  | { type: 'message:deleted'; channelId: string; teamId: string; messageId: string };

/**
 * Fire-and-forget publisher to Redis pub/sub. The realtime service (Wave 8) will
 * subscribe on `channel:*` patterns and fan-out to connected Socket.IO clients.
 */
@Injectable()
export class MessagingPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingPublisher.name);
  private redis!: Redis;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  onModuleInit(): void {
    this.redis = new Redis(this.config.get('REDIS_URL', { infer: true }), {
      // Failure to publish should never block the message flow.
      enableOfflineQueue: true,
      maxRetriesPerRequest: 1,
    });
    this.redis.on('error', (err) => {
      this.logger.warn(`Redis publisher error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async publish(event: MessagingEvent): Promise<void> {
    const channel = `channel:${event.channelId}`;
    try {
      await this.redis.publish(channel, JSON.stringify(event));
    } catch (err) {
      // Live broadcast is best-effort; DB is the source of truth.
      this.logger.warn(`Failed to publish ${event.type}: ${(err as Error).message}`);
    }
  }
}
