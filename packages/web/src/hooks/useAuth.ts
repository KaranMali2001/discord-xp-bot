import { type AuthUser, endpoints } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const AUTH_KEY = ['auth', 'me'] as const

export function useMe() {
  return useQuery<AuthUser | null>({
    queryKey: AUTH_KEY,
    queryFn: () => endpoints.auth.me(),
    retry: false,
    staleTime: 30_000,
  })
}

export function useDevLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { userId: string; username: string; guildId: string }) =>
      endpoints.auth.devLogin(body),
    onSuccess: (user) => {
      qc.setQueryData(AUTH_KEY, user)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => endpoints.auth.logout(),
    onSuccess: () => {
      qc.setQueryData(AUTH_KEY, null)
    },
  })
}
