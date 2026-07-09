import { endpoints } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const key = (guildId: string) => ['admins', guildId] as const

/** User ids explicitly allowed to manage this guild's dashboard. */
export function useAdmins(guildId: string) {
  return useQuery<string[]>({
    queryKey: key(guildId),
    queryFn: () => endpoints.admins.list(guildId),
    enabled: guildId.length > 0,
  })
}

export function useAddAdmin(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => endpoints.admins.add(guildId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(guildId) })
    },
  })
}

export function useRemoveAdmin(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => endpoints.admins.remove(guildId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(guildId) })
    },
  })
}
