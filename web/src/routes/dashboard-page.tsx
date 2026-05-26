import { Link } from 'react-router-dom';
import { ArrowRight, Users, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth';
import { useTeamsQuery } from '@/features/teams/queries';
import { CreateTeamDialog } from '@/features/teams/create-team-dialog';
import { RoleBadge } from '@/features/teams/role-badge';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: teams, isLoading } = useTeamsQuery();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting}{user ? `, ${user.firstName}` : ''}.
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's a quick look at your workspaces.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
            YOUR TEAMS
          </h2>
          <Link
            to="/teams"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : teams && teams.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.slice(0, 4).map((team) => (
              <Link key={team.id} to={`/teams/${team.id}`}>
                <Card className="transition-all hover:border-foreground/20 hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{team.name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3" />
                        {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                    <RoleBadge role={team.role} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-primary/10">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base">Start a team</CardTitle>
                <CardDescription>
                  Create a workspace to organize tasks and chat with your team.
                </CardDescription>
              </div>
              <CreateTeamDialog />
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
