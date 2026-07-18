import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ChannelRule, endpoints } from '@/lib/api'

const key = (guildId: string) => ['channel-rules', guildId] as const

export function useChannelRules(guildId: string) {
  return useQuery<ChannelRule[]>({
    queryKey: key(guildId),
    queryFn: () => endpoints.channelRules.list(guildId),
    enabled: guildId.length > 0,
  })
}

export function useUpsertChannelRule(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ChannelRule) => endpoints.channelRules.put(guildId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(guildId) })
    },
  })
}

export function useDeleteChannelRule(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (channelId: string) => endpoints.channelRules.remove(guildId, channelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(guildId) })
    },
  })
}
