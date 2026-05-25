import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvironmentVariables } from '../../config/env.validation';
import { CallEvent } from './calls.types';

@Injectable()
export class CallsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallsPublisher.name);
  private redis!: Redis;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  onModuleInit(): void {
    this.redis = new Redis(this.config.get('REDIS_URL', { infer: true }), {
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

  async publish(event: CallEvent): Promise<void> {
    const topic = `team:${event.teamId}`;
    try {
      await this.redis.publish(topic, JSON.stringify(event));
    } catch (err) {
      this.logger.warn(`Failed to publish ${event.type}: ${(err as Error).message}`);
    }
  }
}
