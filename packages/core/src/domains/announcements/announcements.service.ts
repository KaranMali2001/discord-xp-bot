import { discordRest } from '../../lib/discord-rest'
import { type AnnouncementInput, announcementInput } from './announcements.schema'

/**
 * Announcements — the one place that turns "channel + text + who to ping" into a
 * posted Discord message. Shared by the `/announce` slash command and the dashboard
 * API so both build the message and gate the pings identically (ADR 0001).
 */
export const announcementsService = {
  /** Prefix a mentions line (roles then members) above the body. */
  buildContent(input: AnnouncementInput): string {
    const mentions: string[] = []
    if (input.mentionEveryone) mentions.push('@everyone')
    mentions.push(...input.roleIds.map((id) => `<@&${id}>`))
    mentions.push(...input.memberIds.map((id) => `<@${id}>`))
    return mentions.length ? `${mentions.join(' ')}\n\n${input.message}` : input.message
  },

  async send(raw: AnnouncementInput): Promise<{ ok: true; content: string }> {
    const input = announcementInput.parse(raw)
    const content = this.buildContent(input)
    // Explicit id lists: only the picked members/roles ping — a stray "@everyone"
    // typed into the body stays inert unless mentionEveryone was ticked on purpose.
    await discordRest.sendMessage(input.channelId, content, {
      allowedMentions: {
        parse: input.mentionEveryone ? ['everyone'] : [],
        users: input.memberIds,
        roles: input.roleIds,
      },
    })
    return { ok: true, content }
  },
}
