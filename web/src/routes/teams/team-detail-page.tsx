import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, MoreHorizontal, LogOut, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/auth';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import {
  useDeleteTeam,
  useLeaveTeam,
  useRemoveMember,
  useTeamMembersQuery,
  useTeamQuery,
  useUpdateMemberRole,
} from '@/features/teams/queries';
import { AddMembersDialog } from '@/features/teams/add-members-dialog';
import { RoleBadge } from '@/features/teams/role-badge';
import { TasksBoard } from '@/features/tasks/tasks-board';
import { getInitials } from '@/lib/utils';
import type { TeamMemberPublic, TeamRole } from '@/api/types';

const ROLE_ORDER: Record<TeamRole, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, GUEST: 1 };

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  if (!teamId) return null;
  return <TeamDetail teamId={teamId} />;
}

function TeamDetail({ teamId }: { teamId: string }) {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const { data: team, isLoading: teamLoading, error: teamError } = useTeamQuery(teamId);
  const { data: members, isLoading: membersLoading } = useTeamMembersQuery(teamId);

  const myMembership = members?.find((m) => m.userId === me?.id);
  const myRole = myMembership?.role;

  const canAddMembers = myRole === 'OWNER' || myRole === 'ADMIN';
  const canDeleteTeam = myRole === 'OWNER';
  const canChangeRoles = myRole === 'OWNER';

  if (teamError instanceof ApiError && teamError.status === 404) {
    return <NotFound />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        to="/teams"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        All teams
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          {teamLoading ? (
            <>
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-72" />
            </>
          ) : team ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
              <p className="text-sm text-muted-foreground">
                {team.description || 'No description'}
              </p>
            </>
          ) : null}
        </div>

        <TeamMenu
          canDelete={canDeleteTeam}
          canLeave={!!myMembership}
          isLastOwner={
            myRole === 'OWNER' &&
            (members?.filter((m) => m.role === 'OWNER').length ?? 0) <= 1
          }
          onDelete={() => navigate('/teams')}
          teamId={teamId}
        />
      </div>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="members">
            Members
            {members && (
              <span className="ml-1.5 rounded bg-muted px-1.5 text-[10.5px] font-medium text-muted-foreground">
                {members.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          {members ? (
            <TasksBoard teamId={teamId} members={members} />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-72 shrink-0" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Members</CardTitle>
                <CardDescription>
                  {members?.length ?? 0} {members?.length === 1 ? 'person' : 'people'} in this team
                </CardDescription>
              </div>
              {canAddMembers && members && (
                <AddMembersDialog teamId={teamId} existingMembers={members} />
              )}
            </CardHeader>
            <CardContent className="p-0">
              {membersLoading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <ul className="divide-y">
                  {members?.map((member) => (
                    <MemberRow
                      key={member.userId}
                      teamId={teamId}
                      member={member}
                      isMe={member.userId === me?.id}
                      myRole={myRole}
                      canChangeRoles={canChangeRoles}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MemberRow({
  teamId,
  member,
  isMe,
  myRole,
  canChangeRoles,
}: {
  teamId: string;
  member: TeamMemberPublic;
  isMe: boolean;
  myRole: TeamRole | undefined;
  canChangeRoles: boolean;
}) {
  const updateRole = useUpdateMemberRole(teamId);
  const removeMember = useRemoveMember(teamId);

  const canRemove =
    !isMe && myRole && ROLE_ORDER[myRole] >= ROLE_ORDER.ADMIN;
  const canManage = canChangeRoles && !isMe;

  const onRoleChange = (role: TeamRole) =>
    updateRole.mutate(
      { userId: member.userId, role },
      {
        onSuccess: () => toast.success(`Updated role to ${role.toLowerCase()}`),
        onError: (err) =>
          toast.error(
            err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed',
          ),
      },
    );

  const onRemove = () =>
    removeMember.mutate(member.userId, {
      onSuccess: () => toast.success(`Removed ${member.firstName}`),
      onError: (err) =>
        toast.error(
          err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed',
        ),
    });

  return (
    <li className="flex items-center gap-3 px-6 py-3">
      <Avatar>
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
        <AvatarFallback>{getInitials(member.firstName, member.lastName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.firstName} {member.lastName}
          {isMe && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>
      <RoleBadge role={member.role} />

      {(canManage || canRemove) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Member actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManage &&
              (['OWNER', 'ADMIN', 'MEMBER', 'GUEST'] as TeamRole[]).map((role) => (
                <DropdownMenuItem
                  key={role}
                  disabled={role === member.role}
                  onSelect={() => onRoleChange(role)}
                >
                  Set as {role.toLowerCase()}
                </DropdownMenuItem>
              ))}
            {canManage && canRemove && <DropdownMenuSeparator />}
            {canRemove && (
              <DropdownMenuItem
                onSelect={onRemove}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Remove from team
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function TeamMenu({
  canDelete,
  canLeave,
  isLastOwner,
  onDelete,
  teamId,
}: {
  canDelete: boolean;
  canLeave: boolean;
  isLastOwner: boolean;
  onDelete: () => void;
  teamId: string;
}) {
  const deleteMutation = useDeleteTeam();
  const leaveMutation = useLeaveTeam();

  if (!canDelete && !canLeave) return null;

  const handleDelete = () => {
    if (!confirm('Delete this team? This cannot be undone.')) return;
    deleteMutation.mutate(teamId, {
      onSuccess: () => {
        toast.success('Team deleted');
        onDelete();
      },
      onError: (err) =>
        toast.error(
          err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed',
        ),
    });
  };

  const handleLeave = () => {
    leaveMutation.mutate(teamId, {
      onSuccess: () => {
        toast.success('You left the team');
        onDelete();
      },
      onError: (err) =>
        toast.error(
          err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Failed',
        ),
    });
  };

  const busy = deleteMutation.isPending || leaveMutation.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Team menu" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canLeave && (
          <DropdownMenuItem onSelect={handleLeave} disabled={isLastOwner}>
            <LogOut className="size-4" />
            Leave team
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            onSelect={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" />
            Delete team
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h2 className="text-xl font-semibold">Team not found</h2>
      <p className="text-sm text-muted-foreground">
        It might have been deleted, or you're not a member.
      </p>
      <Button asChild variant="outline">
        <Link to="/teams">Back to teams</Link>
      </Button>
    </div>
  );
}
