import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints, type LevelReward } from '@/lib/api'

const key = (guildId: string) => ['level-rewards', guildId] as const

export function useLevelRewards(guildId: string) {
  return useQuery<LevelReward[]>({
    queryKey: key(guildId),
    queryFn: () => endpoints.levelRewards.list(guildId),
    enabled: guildId.length > 0,
  })
}

export function useUpsertLevelReward(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LevelReward) => endpoints.levelRewards.put(guildId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(guildId) })
    },
  })
}

export function useDeleteLevelReward(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (level: number) => endpoints.levelRewards.remove(guildId, level),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(guildId) })
    },
  })
}
