import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, raw } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { FieldError } from './common/errors/problem-details';

const LIVEKIT_WEBHOOK_PATH = '/api/v1/internal/livekit/webhook';

function camelToSnakeUpper(input: string): string {
  return input.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own: FieldError[] = Object.entries(error.constraints ?? {}).map(
      ([code, message]) => ({
        field: path,
        code: camelToSnakeUpper(code),
        message,
      }),
    );
    const nested = error.children?.length
      ? flattenValidationErrors(error.children, path)
      : [];
    return [...own, ...nested];
  });
}

async function bootstrap() {
  // Disable Nest's default body parser so we can install a route-specific raw
  // parser for the LiveKit webhook BEFORE the JSON parser. LiveKit signs the
  // raw bytes, so any prior parse step would invalidate the HMAC.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // LiveKit posts with Content-Type: application/webhook+json. Capture the
  // raw body for HMAC verification before any JSON parser touches it. The
  // default JSON parser is then re-applied to every other route.
  app.use(LIVEKIT_WEBHOOK_PATH, raw({ type: '*/*' }));
  app.use(json());

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: 'Validation failed',
          errors: flattenValidationErrors(errors),
        }),
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
