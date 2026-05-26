import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  invitationToken?: string;
}
