import { type GuildConfig, endpoints } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const key = (guildId: string) => ['config', guildId] as const

export function useConfig(guildId: string) {
  return useQuery<GuildConfig>({
    queryKey: key(guildId),
    queryFn: () => endpoints.config.get(guildId),
    enabled: guildId.length > 0,
  })
}

export function useUpdateConfig(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<GuildConfig>) => endpoints.config.put(guildId, body),
    onSuccess: (data) => {
      qc.setQueryData(key(guildId), data)
    },
  })
}
