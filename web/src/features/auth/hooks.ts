import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi, type LoginPayload, type RegisterPayload } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

export function useLogin() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (payload: LoginPayload & { invitationToken?: string }) =>
      authApi.login(payload),
    onSuccess: ({ user, tokens, acceptedInvitationTeamId }) => {
      setSession(user, tokens);
      navigate(acceptedInvitationTeamId ? `/teams/${acceptedInvitationTeamId}` : '/', {
        replace: true,
      });
    },
  });
}

export function useRegister() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (payload: RegisterPayload & { invitationToken?: string }) =>
      authApi.register(payload),
    onSuccess: ({ user, tokens, acceptedInvitationTeamId }) => {
      setSession(user, tokens);
      navigate(acceptedInvitationTeamId ? `/teams/${acceptedInvitationTeamId}` : '/', {
        replace: true,
      });
    },
  });
}

export function useGoogleLogin() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: ({ idToken, invitationToken }: { idToken: string; invitationToken?: string }) =>
      authApi.oauthLogin('google', idToken, invitationToken),
    onSuccess: ({ user, tokens, acceptedInvitationTeamId }) => {
      setSession(user, tokens);
      navigate(acceptedInvitationTeamId ? `/teams/${acceptedInvitationTeamId}` : '/', {
        replace: true,
      });
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        try {
          await authApi.logout(refreshToken);
        } catch {
          // Ignore — clearing local session anyway
        }
      }
    },
    onSettled: () => {
      useAuthStore.getState().clearSession();
      navigate('/login', { replace: true });
    },
  });
}
