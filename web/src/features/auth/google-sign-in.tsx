import { GoogleLogin } from '@react-oauth/google';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/providers/theme-provider';
import { isGoogleOAuthEnabled } from '@/providers/google-oauth-provider';
import { useGoogleLogin } from './hooks';
import { ApiError } from '@/api/client';

export function GoogleSignInButton() {
  const { resolvedTheme } = useTheme();
  const googleLogin = useGoogleLogin();
  const [params] = useSearchParams();
  const invitationToken = params.get('invitation') ?? undefined;

  if (!isGoogleOAuthEnabled) return null;

  return (
    <div className="flex justify-center">
      <GoogleLogin
        theme={resolvedTheme === 'dark' ? 'filled_black' : 'outline'}
        size="large"
        text="continue_with"
        shape="rectangular"
        logo_alignment="center"
        onSuccess={(credentialResponse) => {
          if (!credentialResponse.credential) {
            toast.error('Google sign-in failed: no credential returned');
            return;
          }
          googleLogin.mutate(
            { idToken: credentialResponse.credential, invitationToken },
            {
              onError: (err) => {
                const message =
                  err instanceof ApiError
                    ? (err.problem.detail ?? err.problem.title)
                    : 'Google sign-in failed';
                toast.error(message);
              },
            },
          );
        }}
        onError={() => toast.error('Google sign-in was cancelled')}
      />
    </div>
  );
}
