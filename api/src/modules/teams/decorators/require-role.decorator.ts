import { SetMetadata } from '@nestjs/common';
import { TeamRole } from '../../../../generated/prisma/client';

export const REQUIRED_ROLE_KEY = 'team:requiredRole';

export const RequireRole = (role: TeamRole) => SetMetadata(REQUIRED_ROLE_KEY, role);
