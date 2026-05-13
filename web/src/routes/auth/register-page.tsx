import { Link } from 'react-router-dom';
import { RegisterForm } from '@/features/auth/register-form';
import { GoogleSignInButton } from '@/features/auth/google-sign-in';
import { isGoogleOAuthEnabled } from '@/providers/google-oauth-provider';

export function RegisterPage() {
  return (
    <div>
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Get started with TeamForge in under a minute.
        </p>
      </div>

      <RegisterForm />

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
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
