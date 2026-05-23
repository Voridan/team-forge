import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagingPublisher } from './messaging.publisher';
import { MyChannelsController } from './my-channels.controller';

@Module({
  imports: [TeamsModule],
  controllers: [
    ChannelsController,
    MessagesController,
    AttachmentsController,
    MyChannelsController,
  ],
  providers: [ChannelsService, MessagesService, AttachmentsService, MessagingPublisher],
  exports: [ChannelsService, MessagesService, AttachmentsService],
})
export class MessagingModule {}
