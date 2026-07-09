import { listChannels, listMembers } from '../lib/discord'

/** Read-only guild metadata (channels, members) sourced from Discord for pickers. */
export const discordController = {
  channels(guildId: string) {
    return listChannels(guildId)
  },

  members(guildId: string, query?: string) {
    return listMembers(guildId, query)
  },
}
