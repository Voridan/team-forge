import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { CallsPublisher } from './calls.publisher';
import { CallsService, parseRoomName } from './calls.service';
import { LivekitService } from './livekit.service';

/**
 * LiveKit posts webhook events to this endpoint as `application/webhook+json`
 * with a signed JWT in the Authorization header. The raw body is required to
 * verify the signature, so an `express.raw()` middleware is wired in main.ts
 * for this specific path.
 *
 * The JWT middleware is NOT applied here — the LiveKit signature is the
 * credential. This is enforced by excluding the path in AuthModule.configure().
 */
@Controller('internal/livekit')
export class LivekitWebhookController {
  private readonly logger = new Logger(LivekitWebhookController.name);

  constructor(
    private readonly livekit: LivekitService,
    private readonly calls: CallsService,
    private readonly publisher: CallsPublisher,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() req: Request,
    @Headers('authorization') authHeader: string | undefined,
  ): Promise<void> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing LiveKit signature');
    }

    // express.raw() middleware leaves req.body as a Buffer for this path.
    const rawBody = req.body as Buffer | string;
    let event;
    try {
      event = await this.livekit.verifyWebhook(rawBody, authHeader);
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid LiveKit signature');
    }

    const room = event.room;
    if (!room?.name) {
      this.logger.debug(`Ignoring webhook ${event.event} without room context`);
      return;
    }
    const ids = parseRoomName(room.name);
    if (!ids) {
      this.logger.debug(`Ignoring webhook for non-team room: ${room.name}`);
      return;
    }

    switch (event.event) {
      case 'participant_joined':
        await this.handleParticipantJoined(ids.teamId, ids.callId, event.participant?.identity);
        break;
      case 'participant_left':
        await this.handleParticipantLeft(ids.teamId, ids.callId, event.participant?.identity);
        break;
      case 'room_finished':
        await this.handleRoomFinished(ids.teamId, ids.callId);
        break;
      case 'room_started':
        // No-op: DB row already exists from the /calls POST that minted the room.
        break;
      default:
        this.logger.debug(`Ignoring webhook event: ${event.event}`);
    }
  }

  private async handleParticipantJoined(
    teamId: string,
    callId: string,
    identity: string | undefined,
  ): Promise<void> {
    if (!identity) return;
    const summary = await this.calls.recordParticipantJoined(teamId, callId, identity);
    if (!summary) return;
    await this.publisher.publish({
      type: 'call:participant-joined',
      teamId,
      callId,
      participant: summary,
    });
  }

  private async handleParticipantLeft(
    teamId: string,
    callId: string,
    identity: string | undefined,
  ): Promise<void> {
    if (!identity) return;
    const changed = await this.calls.recordParticipantLeft(callId, identity);
    if (!changed) return;
    await this.publisher.publish({
      type: 'call:participant-left',
      teamId,
      callId,
      userId: identity,
    });
  }

  private async handleRoomFinished(teamId: string, callId: string): Promise<void> {
    const ended = await this.calls.recordRoomFinished(callId);
    if (!ended) return;
    await this.publisher.publish({
      type: 'call:ended',
      teamId,
      callId,
      durationSec: ended.durationSec ?? 0,
    });
  }
}
