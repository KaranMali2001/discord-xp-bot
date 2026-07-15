import { env } from '../../env'
import { discordRest } from '../../lib/discord-rest'
import type { TicketConfig } from './tickets.dao'
import { ticketsDao } from './tickets.dao'
import { type TicketSetupInput, ticketSetupInput } from './tickets.schema'

/**
 * Shared ticket setup, used by BOTH the dashboard (API) and the `/ticket-setup` command,
 * so the two behave identically. Applies the channel permission overwrites, (re)posts the
 * panel, and saves config — all via the shared REST client (bot token). See ADR 0001: one
 * implementation of "touch Discord".
 */

// Discord permission bits (BigInt — several live above bit 31).
const VIEW_CHANNEL = 1n << 10n
const SEND_MESSAGES = 1n << 11n
const READ_MESSAGE_HISTORY = 1n << 16n
const MANAGE_THREADS = 1n << 34n
const CREATE_PRIVATE_THREADS = 1n << 36n
const SEND_MESSAGES_IN_THREADS = 1n << 38n

// Panel channel: public + read-only body. Members see it and click the button, but can't
// chat; threads (created inside it) stay usable via SEND_MESSAGES_IN_THREADS.
const PANEL_BOT_ALLOW =
  VIEW_CHANNEL |
  SEND_MESSAGES |
  READ_MESSAGE_HISTORY |
  MANAGE_THREADS |
  CREATE_PRIVATE_THREADS |
  SEND_MESSAGES_IN_THREADS

// Collection channel: hidden from @everyone, visible to staff + bot.
const COLLECTION_STAFF_ALLOW = VIEW_CHANNEL | READ_MESSAGE_HISTORY | SEND_MESSAGES
const COLLECTION_BOT_ALLOW = VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY

// Custom id contract: the bot's panel-button handler matches on exactly this string.
const OPEN_BUTTON_ID = 'ticket:open'

/** The raw Discord message payload for the ticket panel (embed + open button). */
export function buildTicketPanelPayload(): Record<string, unknown> {
  return {
    embeds: [
      {
        title: '🎫 Need help? Raise a ticket',
        description: [
          'Click the button below to open a private ticket.',
          'You can add a subject, a description, and attach screenshots.',
          '',
          'Only you and the staff team can see your ticket.',
        ].join('\n'),
        color: 0x5865f2,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'Raise a ticket',
            emoji: { name: '🎫' },
            custom_id: OPEN_BUTTON_ID,
          },
        ],
      },
    ],
  }
}

/**
 * Apply setup end-to-end: make the panel channel read-only, hide the collection channel
 * from @everyone (open to staff + bot), (re)post the panel, and persist config. Threads are
 * created on demand inside the (public) panel channel, so no per-user overwrites are needed.
 * Throws (DiscordError / ZodError) on failure so callers can surface a precise message.
 */
export async function applyTicketSetup(
  guildId: string,
  raw: TicketSetupInput,
): Promise<TicketConfig> {
  const input = ticketSetupInput.parse(raw)
  const { panelChannelId, ticketChannelId, staffRoleId } = input
  const botId = env.DISCORD_CLIENT_ID

  // 1. Panel channel: keep it public but read-only (@everyone can't post in the body); the
  //    bot needs thread perms to spin up private ticket threads here.
  await discordRest.setChannelPermission(panelChannelId, guildId, { deny: SEND_MESSAGES, type: 0 })
  await discordRest.setChannelPermission(panelChannelId, botId, { allow: PANEL_BOT_ALLOW, type: 1 })

  // 2. Collection channel: hidden from @everyone (role id == guild id), open to staff + bot.
  await discordRest.setChannelPermission(ticketChannelId, guildId, { deny: VIEW_CHANNEL, type: 0 })
  await discordRest.setChannelPermission(ticketChannelId, staffRoleId, {
    allow: COLLECTION_STAFF_ALLOW,
    type: 0,
  })
  await discordRest.setChannelPermission(ticketChannelId, botId, {
    allow: COLLECTION_BOT_ALLOW,
    type: 1,
  })

  // 3. Replace any stale panel, then post a fresh one.
  const prev = ticketsDao.getConfig(guildId)
  if (prev?.panelChannelId && prev.panelMessageId) {
    await discordRest.deleteMessage(prev.panelChannelId, prev.panelMessageId).catch(() => {})
  }
  const msg = await discordRest.createMessage(panelChannelId, buildTicketPanelPayload())

  // 4. Persist.
  return ticketsDao.upsertConfig(guildId, {
    panelChannelId,
    ticketChannelId,
    staffRoleId,
    panelMessageId: msg.id,
    enabled: true,
  })
}
