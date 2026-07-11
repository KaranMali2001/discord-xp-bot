import { type DiscordChannel, type DiscordMember, type DiscordRole, endpoints } from '@/lib/api'
import { useMutation, useQuery } from '@tanstack/react-query'

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

/** Assignable-aware guild roles for the role picker. */
export function useDiscordRoles(guildId: string) {
  return useQuery<DiscordRole[]>({
    queryKey: ['discord', 'roles', guildId],
    queryFn: () => endpoints.discord.roles(guildId),
    enabled: !!guildId,
    staleTime: 60_000,
    retry: false,
  })
}

/** Create a hoisted, coloured tier role (dashboard-creates flow). */
export function useCreateRole(guildId: string) {
  return useMutation({
    mutationFn: (body: { name: string; color?: number; hoist?: boolean }) =>
      endpoints.discord.createRole(guildId, body),
  })
}
