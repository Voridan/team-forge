import type { TeamRole } from '@/api/types';
import { Badge } from '@/components/ui/badge';

const variantMap: Record<TeamRole, 'default' | 'secondary' | 'outline' | 'success' | 'warning'> = {
  OWNER: 'default',
  ADMIN: 'success',
  MEMBER: 'secondary',
  GUEST: 'outline',
};

const labelMap: Record<TeamRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  GUEST: 'Guest',
};

export function RoleBadge({ role }: { role: TeamRole }) {
  return <Badge variant={variantMap[role]}>{labelMap[role]}</Badge>;
}
