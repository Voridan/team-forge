import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ChannelsService } from './channels.service';

/**
 * "What channels can I see right now?" — used by the realtime service when a
 * client opens a WebSocket so it can auto-join the appropriate Socket.IO rooms.
 * Authorization piggybacks on the global JwtMiddleware (any logged-in user).
 */
@Controller('users/me/channels')
export class MyChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.channels.listForUser(user.id);
  }
}
