import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints, type TicketConfig, type TicketSetupBody } from '@/lib/api'

const key = (guildId: string) => ['tickets', guildId] as const

export function useTicketConfig(guildId: string) {
  return useQuery<TicketConfig | null>({
    queryKey: key(guildId),
    queryFn: () => endpoints.tickets.get(guildId),
    enabled: guildId.length > 0,
  })
}

export function useSaveTicketConfig(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TicketSetupBody) => endpoints.tickets.save(guildId, body),
    onSuccess: (data) => {
      qc.setQueryData(key(guildId), data)
    },
  })
}
