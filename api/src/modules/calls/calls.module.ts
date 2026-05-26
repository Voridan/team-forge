import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { CallsController } from './calls.controller';
import { CallsPublisher } from './calls.publisher';
import { CallsService } from './calls.service';
import { LivekitService } from './livekit.service';
import { LivekitWebhookController } from './livekit-webhook.controller';

@Module({
  imports: [TeamsModule],
  controllers: [CallsController, LivekitWebhookController],
  providers: [CallsService, CallsPublisher, LivekitService],
  exports: [CallsService],
})
export class CallsModule {}
