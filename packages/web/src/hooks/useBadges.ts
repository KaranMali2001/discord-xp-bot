import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Badge, endpoints } from '@/lib/api'

const key = (guildId: string) => ['badges', guildId] as const

export function useBadges(guildId: string) {
  return useQuery<Badge[]>({
    queryKey: key(guildId),
    queryFn: () => endpoints.badges.list(guildId),
    enabled: guildId.length > 0,
  })
}

export function useUpsertBadge(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Badge) => endpoints.badges.put(guildId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(guildId) })
    },
  })
}

export function useDeleteBadge(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (badgeKey: string) => endpoints.badges.remove(guildId, badgeKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(guildId) })
    },
  })
}
