import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { AnalyticsSettingsModule } from './modules/analytics-settings/analytics-settings.module';
import { AuthModule } from './modules/auth/auth.module';
import { CallsModule } from './modules/calls/calls.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MailModule } from './modules/mail/mail.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { StorageModule } from './modules/storage/storage.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TeamsModule } from './modules/teams/teams.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    MailModule,
    StorageModule,
    AuthModule,
    UsersModule,
    TeamsModule,
    TasksModule,
    InvitationsModule,
    MessagingModule,
    CallsModule,
    AnalyticsSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
