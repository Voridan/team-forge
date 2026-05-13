import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi, type UpdateUserPayload } from '@/api/users';
import { useAuthStore } from '@/store/auth';

export const userKeys = {
  all: ['users'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  byId: (id: string) => [...userKeys.all, 'detail', id] as const,
  search: (q: string) => [...userKeys.all, 'search', q] as const,
};

export function useMeQuery() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: usersApi.getMe,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (payload: UpdateUserPayload) => usersApi.updateMe(payload),
    onSuccess: (user) => {
      setUser(user);
      qc.setQueryData(userKeys.me(), user);
    },
  });
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: userKeys.search(query),
    queryFn: () => usersApi.search(query),
    enabled: query.length > 0,
  });
}
