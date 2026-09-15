import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

export interface Me {
  username: string
  authDisabled: boolean
}

export const authKeys = { me: ['auth', 'me'] as const }

/** Who is logged in. 401 -> error (the guard redirects to /login). */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => api<Me>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { username: string; password: string }) => api<Me>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (me) => qc.setQueryData(authKeys.me, me),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => qc.clear(),
  })
}
