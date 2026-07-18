import { announcementsService, formatIst, scheduledAnnouncementsService } from '@xp/core'
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  RoleSelectMenuBuilder,
  type RoleSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type UserSelectMenuInteraction,
} from 'discord.js'
import { log } from '../lib/log'
import { noteScheduledAt } from './scheduled-tick'

/**
 * `/announce` is stateful across three interactions — the slash command opens the
 * pickers, each select menu reports its own values, and the modal carries the body.
 * We stitch those together with a short-lived per-user draft, keyed by guild+user.
 * Single-process bot, so an in-memory Map is enough (drafts expire after TTL_MS).
 */
type Draft = {
  channelId: string
  userIds: string[]
  roleIds: string[]
  // Epoch seconds to post at, or null to post immediately.
  fireAt: number | null
  updatedAt: number
}

const drafts = new Map<string, Draft>()
const TTL_MS = 15 * 60 * 1000

export const ANNOUNCE_IDS = {
  users: 'announce:users',
  roles: 'announce:roles',
  compose: 'announce:compose',
  modal: 'announce:modal',
  message: 'announce:message',
} as const

const draftKey = (guildId: string, userId: string) => `${guildId}:${userId}`

/** True for the select menus / button that belong to the announce flow. */
export function isAnnounceComponent(customId: string): boolean {
  return (
    customId === ANNOUNCE_IDS.users ||
    customId === ANNOUNCE_IDS.roles ||
    customId === ANNOUNCE_IDS.compose
  )
}

function getDraft(guildId: string, userId: string): Draft | undefined {
  const key = draftKey(guildId, userId)
  const draft = drafts.get(key)
  if (!draft) return undefined
  if (Date.now() - draft.updatedAt > TTL_MS) {
    drafts.delete(key)
    return undefined
  }
  return draft
}

/**
 * Called by the slash command to seed a fresh draft for the chosen channel.
 * `fireAt` (epoch seconds) schedules for later; null posts immediately on submit.
 */
export function startAnnounceDraft(
  guildId: string,
  userId: string,
  channelId: string,
  fireAt: number | null = null,
): void {
  drafts.set(draftKey(guildId, userId), {
    channelId,
    userIds: [],
    roleIds: [],
    fireAt,
    updatedAt: Date.now(),
  })
}

/** The pickers + send button shown in the ephemeral compose reply. */
export function buildAnnounceComponents(): ActionRowBuilder<
  UserSelectMenuBuilder | RoleSelectMenuBuilder | ButtonBuilder
>[] {
  const users = new UserSelectMenuBuilder()
    .setCustomId(ANNOUNCE_IDS.users)
    .setPlaceholder('Mention members (optional)')
    .setMinValues(0)
    .setMaxValues(25)
  const roles = new RoleSelectMenuBuilder()
    .setCustomId(ANNOUNCE_IDS.roles)
    .setPlaceholder('Mention roles / tags (optional)')
    .setMinValues(0)
    .setMaxValues(25)
  const compose = new ButtonBuilder()
    .setCustomId(ANNOUNCE_IDS.compose)
    .setLabel('Write message & send')
    .setStyle(ButtonStyle.Primary)

  return [
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(users),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roles),
    new ActionRowBuilder<ButtonBuilder>().addComponents(compose),
  ]
}

const EXPIRED = '⌛ This announcement draft expired. Run `/announce` again.'

/** Handle a select-menu change (store it) or the compose button (open the modal). */
export async function handleAnnounceComponent(
  interaction: UserSelectMenuInteraction | RoleSelectMenuInteraction | ButtonInteraction,
): Promise<void> {
  if (!interaction.guildId) return
  const draft = getDraft(interaction.guildId, interaction.user.id)
  if (!draft) {
    await interaction.reply({ content: EXPIRED, flags: MessageFlags.Ephemeral })
    return
  }

  if (interaction.isUserSelectMenu()) {
    draft.userIds = [...interaction.values]
    draft.updatedAt = Date.now()
    await interaction.deferUpdate()
    return
  }
  if (interaction.isRoleSelectMenu()) {
    draft.roleIds = [...interaction.values]
    draft.updatedAt = Date.now()
    await interaction.deferUpdate()
    return
  }

  // Compose button → pop the message modal.
  const input = new TextInputBuilder()
    .setCustomId(ANNOUNCE_IDS.message)
    .setLabel('Announcement message')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1900)
  const modal = new ModalBuilder()
    .setCustomId(ANNOUNCE_IDS.modal)
    .setTitle('Announcement')
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))
  await interaction.showModal(modal)
}

/** Modal submit → post the announcement and clear the draft. */
export async function handleAnnounceModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guildId) return
  const draft = getDraft(interaction.guildId, interaction.user.id)
  if (!draft) {
    await interaction.reply({ content: EXPIRED, flags: MessageFlags.Ephemeral })
    return
  }

  const message = interaction.fields.getTextInputValue(ANNOUNCE_IDS.message)
  const payload = {
    channelId: draft.channelId,
    message,
    memberIds: draft.userIds,
    roleIds: draft.roleIds,
    mentionEveryone: false,
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
  try {
    if (draft.fireAt != null) {
      await scheduledAnnouncementsService.schedule(interaction.guildId, interaction.user.id, {
        ...payload,
        fireAt: draft.fireAt,
      })
      // This process runs the scheduler — update its in-memory gate so the new row fires on
      // time without waiting for the backstop re-sync (§2.1).
      noteScheduledAt(draft.fireAt)
      await interaction.editReply(
        `📅 Announcement scheduled for **${formatIst(draft.fireAt)}** in <#${draft.channelId}>.`,
      )
    } else {
      await announcementsService.send(payload)
      await interaction.editReply(`✅ Announcement posted to <#${draft.channelId}>.`)
    }
    drafts.delete(draftKey(interaction.guildId, interaction.user.id))
  } catch (err) {
    log.error('announce', `failed to post: ${(err as Error).message}`)
    await interaction.editReply(
      '⚠️ Failed to post the announcement. Check the bot’s channel access.',
    )
  }
}
