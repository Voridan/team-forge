import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MailModule } from './modules/mail/mail.module';
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
    AuthModule,
    UsersModule,
    TeamsModule,
    TasksModule,
    InvitationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
