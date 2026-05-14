import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import {
  PublicInvitationsController,
  TeamInvitationsController,
} from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [TeamsModule],
  controllers: [TeamInvitationsController, PublicInvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
