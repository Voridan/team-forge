import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[a-z0-9][a-z0-9-_]*$/i, {
    message: 'name must start with a letter/digit and contain only letters, digits, "-" or "_"',
  })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
