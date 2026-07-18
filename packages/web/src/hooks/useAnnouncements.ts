import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type AnnouncementInput,
  endpoints,
  type ScheduleAnnouncementInput,
  type ScheduledAnnouncement,
} from '@/lib/api'

/** Post an announcement to a channel immediately. */
export function useSendAnnouncement(guildId: string) {
  return useMutation({
    mutationFn: (body: AnnouncementInput) => endpoints.announcements.send(guildId, body),
  })
}

const scheduledKey = (guildId: string) => ['scheduled-announcements', guildId] as const

/** Upcoming (still pending) scheduled announcements. */
export function useScheduledAnnouncements(guildId: string) {
  return useQuery<ScheduledAnnouncement[]>({
    queryKey: scheduledKey(guildId),
    queryFn: () => endpoints.announcements.listScheduled(guildId),
    enabled: guildId.length > 0,
  })
}

export function useScheduleAnnouncement(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ScheduleAnnouncementInput) =>
      endpoints.announcements.schedule(guildId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduledKey(guildId) }),
  })
}

export function useCancelScheduledAnnouncement(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => endpoints.announcements.cancelScheduled(guildId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduledKey(guildId) }),
  })
}
