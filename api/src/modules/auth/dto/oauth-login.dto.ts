import { IsString } from 'class-validator';

export class OAuthLoginDto {
  @IsString()
  idToken!: string;
}
