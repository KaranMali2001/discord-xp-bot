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

    // Allow-list exactly who may ping: the explicit id lists (slash command's select
    // menus) PLUS any mentions typed inline in the message (the dashboard's @-composer).
    // A stray "@everyone" in the body stays inert unless mentionEveryone was set on purpose.
    const users = new Set(input.memberIds)
    const roles = new Set(input.roleIds)
    for (const m of content.matchAll(/<@(\d+)>/g)) users.add(m[1] as string)
    for (const m of content.matchAll(/<@&(\d+)>/g)) roles.add(m[1] as string)

    await discordRest.sendMessage(input.channelId, content, {
      allowedMentions: {
        parse: input.mentionEveryone ? ['everyone'] : [],
        users: [...users],
        roles: [...roles],
      },
    })
    return { ok: true, content }
  },
}
