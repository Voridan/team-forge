import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateTeamDialog } from '@/features/teams/create-team-dialog';
import { RoleBadge } from '@/features/teams/role-badge';
import { useTeamsQuery } from '@/features/teams/queries';

export function TeamsPage() {
  const { data: teams, isLoading } = useTeamsQuery();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Workspaces you belong to. Create one or jump in.
          </p>
        </div>
        <CreateTeamDialog />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : teams && teams.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link key={team.id} to={`/teams/${team.id}`} className="group">
              <Card className="h-full transition-all hover:border-foreground/20 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1 text-base">
                      {team.name}
                    </CardTitle>
                    <RoleBadge role={team.role} />
                  </div>
                  <CardDescription className="mt-1.5 line-clamp-2 min-h-[2.5rem]">
                    {team.description || 'No description'}
                  </CardDescription>
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-secondary">
              <Users className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base">No teams yet</CardTitle>
              <CardDescription>
                Start by creating your first team. You'll be the owner.
              </CardDescription>
            </div>
            <div className="mt-2">
              <CreateTeamDialog />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
