import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, MailCheck, Sparkles, UserPlus, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/store/auth';
import { useAcceptInvitation, useInvitationPreview } from '@/features/invitations/queries';

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation();

  // Auto-accept when the logged-in user already matches the invite email.
  useEffect(() => {
    if (
      token &&
      preview.data &&
      me &&
      me.email.toLowerCase() === preview.data.email.toLowerCase() &&
      !accept.isPending &&
      !accept.isSuccess
    ) {
      // Don't auto-accept silently — let the user confirm via the button.
    }
  }, [token, preview.data, me, accept.isPending, accept.isSuccess]);

  if (!token) {
    return (
      <Shell title="Missing invitation token" description="This link looks incomplete.">
        <Button asChild variant="outline">
          <Link to="/">Back home</Link>
        </Button>
      </Shell>
    );
  }

  if (preview.isLoading) {
    return (
      <Shell title="Checking invitation…" description="Hang on.">
        <Spinner />
      </Shell>
    );
  }

  if (preview.error || !preview.data) {
    const message =
      preview.error instanceof ApiError
        ? preview.error.problem.detail ?? preview.error.problem.title
        : 'This invitation is no longer valid.';
    return (
      <Shell title="Invitation unavailable" description={message}>
        <Button asChild variant="outline">
          <Link to="/login">Sign in to TeamForge</Link>
        </Button>
      </Shell>
    );
  }

  const inv = preview.data;
  const sameAccount = me && me.email.toLowerCase() === inv.email.toLowerCase();
  const wrongAccount = me && !sameAccount;

  const onAccept = () => {
    accept.mutate(token, {
      onSuccess: ({ teamId }) => {
        toast.success(`Welcome to ${inv.teamName}`);
        navigate(`/teams/${teamId}`);
      },
      onError: (err) => {
        const msg =
          err instanceof ApiError ? err.problem.detail ?? err.problem.title : 'Could not accept';
        toast.error(msg);
      },
    });
  };

  return (
    <Shell
      title={`Join ${inv.teamName}`}
      description={
        inv.inviterName
          ? `${inv.inviterName} invited you as ${inv.role.toLowerCase()}.`
          : `You've been invited to join as ${inv.role.toLowerCase()}.`
      }
    >
      <p className="text-sm text-muted-foreground">
        This invitation is addressed to <span className="font-medium text-foreground">{inv.email}</span>.
      </p>

      {sameAccount && (
        <Button onClick={onAccept} disabled={accept.isPending} className="w-full">
          {accept.isPending && <Loader2 className="animate-spin" />}
          Accept and join {inv.teamName}
        </Button>
      )}

      {wrongAccount && (
        <div className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm">
          <p className="font-medium text-destructive">
            You're signed in as {me.email}.
          </p>
          <p className="text-destructive/80">
            Sign out and use {inv.email} to accept this invitation.
          </p>
        </div>
      )}

      {!me && (
        <div className="space-y-2">
          <Button asChild className="w-full">
            <Link
              to={{
                pathname: '/register',
                search: `?invitation=${encodeURIComponent(token)}&email=${encodeURIComponent(inv.email)}`,
              }}
            >
              <UserPlus />
              Create an account
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link
              to={{
                pathname: '/login',
                search: `?invitation=${encodeURIComponent(token)}&email=${encodeURIComponent(inv.email)}`,
              }}
            >
              <LogIn />
              I already have an account
            </Link>
          </Button>
        </div>
      )}
    </Shell>
  );
}

function Shell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-full place-items-center px-6 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="size-4 text-primary" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}
