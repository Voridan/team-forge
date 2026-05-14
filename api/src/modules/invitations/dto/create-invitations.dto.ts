import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { TeamRole } from '../../../../generated/prisma/client';

export class CreateInvitationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsEmail({}, { each: true })
  emails!: string[];

  @IsOptional()
  @IsEnum(TeamRole)
  role?: Exclude<TeamRole, 'OWNER'>;
}
