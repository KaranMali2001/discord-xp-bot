import { type DiscordChannel, type DiscordMember, endpoints } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

/** Text + voice channels for pickers. Cached a while — channels rarely change. */
export function useDiscordChannels(guildId: string) {
  return useQuery<DiscordChannel[]>({
    queryKey: ['discord', 'channels', guildId],
    queryFn: () => endpoints.discord.channels(guildId),
    enabled: !!guildId,
    staleTime: 60_000,
    retry: false,
  })
}

/** Guild members, optionally prefix-searched. */
export function useDiscordMembers(guildId: string, query: string) {
  return useQuery<DiscordMember[]>({
    queryKey: ['discord', 'members', guildId, query],
    queryFn: () => endpoints.discord.members(guildId, query || undefined),
    enabled: !!guildId,
    staleTime: 30_000,
    retry: false,
  })
}
