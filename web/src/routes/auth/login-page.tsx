import { Link } from 'react-router-dom';
import { LoginForm } from '@/features/auth/login-form';
import { GoogleSignInButton } from '@/features/auth/google-sign-in';
import { isGoogleOAuthEnabled } from '@/providers/google-oauth-provider';

export function LoginPage() {
  return (
    <div>
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your TeamForge account.
        </p>
      </div>

      <LoginForm />

      {isGoogleOAuthEnabled && (
        <>
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <GoogleSignInButton />
        </>
      )}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-foreground hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
