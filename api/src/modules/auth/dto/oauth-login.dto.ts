import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OAuthLoginDto {
  @IsString()
  idToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  invitationToken?: string;
}
