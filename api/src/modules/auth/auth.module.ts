import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EnvironmentVariables } from '../../config/env.validation';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtMiddleware } from './middleware/jwt.middleware';
import { OAuthProviderRegistry } from './oauth/oauth-provider.registry';
import { GoogleProvider } from './oauth/providers/google.provider';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_EXPIRY', { infer: true }),
          algorithm: 'HS256',
        },
        verifyOptions: {
          algorithms: ['HS256'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtMiddleware, GoogleProvider, OAuthProviderRegistry],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(JwtMiddleware)
      .exclude(
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/refresh', method: RequestMethod.POST },
        { path: 'auth/oauth/(.*)', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
