import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, WebhookEvent, WebhookReceiver } from 'livekit-server-sdk';
import { EnvironmentVariables } from '../../config/env.validation';

const TOKEN_TTL_SECONDS = 60 * 60;

@Injectable()
export class LivekitService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly livekitUrl: string;
  private readonly receiver: WebhookReceiver;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.apiKey = config.get('LIVEKIT_API_KEY', { infer: true });
    this.apiSecret = config.get('LIVEKIT_API_SECRET', { infer: true });
    this.livekitUrl = config.get('LIVEKIT_URL', { infer: true });
    this.receiver = new WebhookReceiver(this.apiKey, this.apiSecret);
  }

  get url(): string {
    return this.livekitUrl;
  }

  async signParticipantToken(params: {
    roomName: string;
    userId: string;
    displayName: string;
  }): Promise<string> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: params.userId,
      name: params.displayName,
      ttl: TOKEN_TTL_SECONDS,
    });
    token.addGrant({
      roomJoin: true,
      room: params.roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return token.toJwt();
  }

  verifyWebhook(rawBody: string | Buffer, authHeader: string): Promise<WebhookEvent> {
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    return this.receiver.receive(body, authHeader);
  }
}
