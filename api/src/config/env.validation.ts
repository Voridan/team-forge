import { plainToInstance } from 'class-transformer';
import { IsString, IsUrl, MinLength, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsUrl({ require_tld: false, require_protocol: true })
  DATABASE_URL!: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  REDIS_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  JWT_ACCESS_EXPIRY!: string;

  @IsString()
  JWT_REFRESH_EXPIRY!: string;

  @IsString()
  GOOGLE_CLIENT_ID!: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${messages}`);
  }

  return validated;
}
