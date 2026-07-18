import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type EventAttendance, type EventInput, endpoints, type MultiplierEvent } from '@/lib/api'

const key = (guildId: string) => ['events', guildId] as const

export function useEvents(guildId: string) {
  return useQuery<MultiplierEvent[]>({
    queryKey: key(guildId),
    queryFn: () => endpoints.events.list(guildId),
    enabled: guildId.length > 0,
  })
}

/** Per-member voice-duration summary for one event. Polls so it stays live during an event. */
export function useEventAttendance(guildId: string, eventId: number | null) {
  return useQuery<EventAttendance>({
    queryKey: ['event-attendance', guildId, eventId] as const,
    queryFn: () => endpoints.events.attendance(guildId, eventId as number),
    enabled: guildId.length > 0 && eventId != null,
    refetchInterval: 10_000,
  })
}

export function useCreateEvent(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: EventInput) => endpoints.events.create(guildId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(guildId) })
    },
  })
}

export function usePatchEvent(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<EventInput> }) =>
      endpoints.events.patch(guildId, id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(guildId) })
    },
  })
}

export function useDeleteEvent(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => endpoints.events.remove(guildId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(guildId) })
    },
  })
}
