import {
  MIN_LEAD_SEC,
  applyTicketSetup,
  authService,
  badgesService,
  formatIst,
  istWallClockToEpochSec,
  levelProgress,
  nowSec,
  rulesDao,
  xpService,
} from '@xp/core'
import {
  ChannelType,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type RESTPostAPIApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js'
import { buildAnnounceComponents, startAnnounceDraft } from './features/announce'

export interface Command {
  data: RESTPostAPIApplicationCommandsJSONBody
  execute: (i: ChatInputCommandInteraction) => Promise<void>
}

/** Config-editing commands require Discord MANAGE_GUILD or the core admin allowlist. */
function isManager(i: ChatInputCommandInteraction): boolean {
  const hasPerm = i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false
  return i.guildId ? authService.canManage(i.guildId, i.user.id, hasPerm) : false
}

async function denyIfNotManager(i: ChatInputCommandInteraction): Promise<boolean> {
  if (isManager(i)) return false
  await i.reply({ content: '⛔ You need **Manage Server** to do that.', ephemeral: true })
  return true
}

const rank: Command = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your (or someone else’s) level and XP')
    .addUserOption((o) => o.setName('user').setDescription('Whose rank to show'))
    .toJSON(),
  async execute(i) {
    if (!i.guildId) return
    const target = i.options.getUser('user') ?? i.user
    const m = xpService.get(i.guildId, target.id)
    if (!m) {
      await i.reply({ content: `${target.username} has no XP yet.`, ephemeral: true })
      return
    }
    const p = levelProgress(m.xp)
    const rankNo = xpService.rank(i.guildId, target.id)
    const embed = new EmbedBuilder()
      .setTitle(`${target.username} — Level ${p.level}`)
      .setDescription(
        [
          `**Rank:** #${rankNo}`,
          `**XP:** ${m.xp} (${p.into}/${p.need} to next)`,
          `**Messages:** ${m.messageCount}`,
          `**Voice:** ${Math.floor(m.voiceSeconds / 60)} min (spoke ${Math.floor(m.speakingSeconds / 60)} min)`,
        ].join('\n'),
      )
    await i.reply({ embeds: [embed] })
  },
}

const leaderboard: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Top members by XP')
    .toJSON(),
  async execute(i) {
    if (!i.guildId) return
    const top = xpService.leaderboard(i.guildId, 10)
    if (top.length === 0) {
      await i.reply({ content: 'No XP yet — start chatting or hop in voice!', ephemeral: true })
      return
    }
    const lines = top.map((m, idx) => `**${idx + 1}.** ${m.username} — L${m.level} (${m.xp} XP)`)
    await i.reply({
      embeds: [new EmbedBuilder().setTitle('🏆 Leaderboard').setDescription(lines.join('\n'))],
    })
  },
}

const badges: Command = {
  data: new SlashCommandBuilder()
    .setName('badges')
    .setDescription('Show earned badges')
    .addUserOption((o) => o.setName('user').setDescription('Whose badges to show'))
    .toJSON(),
  async execute(i) {
    if (!i.guildId) return
    const target = i.options.getUser('user') ?? i.user
    const owned = new Set(badgesService.owned(i.guildId, target.id))
    const defs = badgesService.list(i.guildId).filter((b) => owned.has(b.key))
    const body = defs.length
      ? defs.map((b) => `${b.emoji} **${b.name}** — ${b.description}`).join('\n')
      : 'No badges yet.'
    await i.reply({
      embeds: [new EmbedBuilder().setTitle(`${target.username}’s badges`).setDescription(body)],
    })
  },
}

const setMessageXp: Command = {
  data: new SlashCommandBuilder()
    .setName('setmessagexp')
    .setDescription('Set base XP per message (Manage Server)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((o) =>
      o
        .setName('amount')
        .setDescription('XP per message')
        .setMinValue(0)
        .setMaxValue(1000)
        .setRequired(true),
    )
    .toJSON(),
  async execute(i) {
    if (!i.guildId || (await denyIfNotManager(i))) return
    const amount = i.options.getInteger('amount', true)
    rulesDao.upsertConfig(i.guildId, { messageXp: amount })
    await i.reply({ content: `✅ Base message XP set to **${amount}**.`, ephemeral: true })
  },
}

const setChannel: Command = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set a channel’s XP multiplier or disable XP there (Manage Server)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true))
    .addNumberOption((o) =>
      o
        .setName('multiplier')
        .setDescription('XP multiplier (e.g. 2 = double)')
        .setMinValue(0)
        .setMaxValue(100),
    )
    .addBooleanOption((o) => o.setName('noxp').setDescription('Disable XP in this channel'))
    .toJSON(),
  async execute(i) {
    if (!i.guildId || (await denyIfNotManager(i))) return
    const channel = i.options.getChannel('channel', true)
    const multiplier = i.options.getNumber('multiplier') ?? 1
    const noXp = i.options.getBoolean('noxp') ?? false
    const kind =
      channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice
        ? 'voice'
        : 'text'
    rulesDao.upsertChannelRule(i.guildId, { channelId: channel.id, kind, multiplier, noXp })
    await i.reply({
      content: noXp
        ? `✅ XP disabled in <#${channel.id}>.`
        : `✅ <#${channel.id}> multiplier set to **×${multiplier}**.`,
      ephemeral: true,
    })
  },
}

const friday: Command = {
  data: new SlashCommandBuilder()
    .setName('friday')
    .setDescription('Create a recurring Friday XP boost (Manage Server)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addNumberOption((o) =>
      o
        .setName('multiplier')
        .setDescription('Boost multiplier')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName('start_hour')
        .setDescription('Start hour IST (0-23)')
        .setMinValue(0)
        .setMaxValue(23)
        .setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName('end_hour')
        .setDescription('End hour IST (1-24)')
        .setMinValue(1)
        .setMaxValue(24)
        .setRequired(true),
    )
    .addChannelOption((o) => o.setName('channel').setDescription('Limit to one channel (optional)'))
    .toJSON(),
  async execute(i) {
    if (!i.guildId || (await denyIfNotManager(i))) return
    const multiplier = i.options.getNumber('multiplier', true)
    const startHour = i.options.getInteger('start_hour', true)
    const endHour = i.options.getInteger('end_hour', true)
    const channel = i.options.getChannel('channel')
    rulesDao.createEvent(i.guildId, {
      name: 'Friday Discussion',
      multiplier,
      enabled: true,
      countsAttendance: true,
      channelId: channel?.id ?? null,
      dayOfWeek: 5, // Friday
      startMinute: startHour * 60,
      endMinute: endHour * 60,
      startsAt: null,
      endsAt: null,
    })
    await i.reply({
      content: `✅ Friday boost ×${multiplier} created (${startHour}:00–${endHour}:00 IST${channel ? ` in <#${channel.id}>` : ''}).`,
      ephemeral: true,
    })
  },
}

const setLevelRole: Command = {
  data: new SlashCommandBuilder()
    .setName('setlevelrole')
    .setDescription('Map a level to a rank role (Manage Server)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((o) =>
      o
        .setName('level')
        .setDescription('Level threshold')
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(true),
    )
    .addRoleOption((o) =>
      o.setName('role').setDescription('Role to grant at that level').setRequired(true),
    )
    .addStringOption((o) =>
      o.setName('message').setDescription('Optional announcement — supports {user} {role} {level}'),
    )
    .toJSON(),
  async execute(i) {
    if (!i.guildId || (await denyIfNotManager(i))) return
    const level = i.options.getInteger('level', true)
    const role = i.options.getRole('role', true)
    const message = i.options.getString('message') ?? null
    rulesDao.upsertLevelReward(i.guildId, { level, roleId: role.id, message })
    await i.reply({
      content: `✅ Level **${level}** now grants <@&${role.id}>. Members get it on their next level-up.`,
      ephemeral: true,
    })
  },
}

const announce: Command = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post or schedule an announcement with member & role mentions (Manage Server)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel to post the announcement in')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName('time')
        .setDescription('Schedule for later (IST) — format: YYYY-MM-DD HH:MM. Omit to post now.'),
    )
    .toJSON(),
  async execute(i) {
    if (!i.guildId || (await denyIfNotManager(i))) return
    const channel = i.options.getChannel('channel', true)
    const timeStr = i.options.getString('time')

    let fireAt: number | null = null
    if (timeStr) {
      fireAt = istWallClockToEpochSec(timeStr)
      if (fireAt == null) {
        await i.reply({
          content:
            '⚠️ Couldn’t read that time. Use IST format `YYYY-MM-DD HH:MM`, e.g. `2026-07-20 18:30`.',
          flags: MessageFlags.Ephemeral,
        })
        return
      }
      if (fireAt < nowSec() + MIN_LEAD_SEC) {
        await i.reply({
          content: `⚠️ That time is in the past (or too soon). Pick a time at least ${MIN_LEAD_SEC}s from now, in IST.`,
          flags: MessageFlags.Ephemeral,
        })
        return
      }
    }

    startAnnounceDraft(i.guildId, i.user.id, channel.id, fireAt)
    const when = fireAt != null ? ` to be sent **${formatIst(fireAt)}**` : ''
    await i.reply({
      content: `📣 Composing an announcement for <#${channel.id}>${when}.\nPick who to mention (optional), then **Write message & send**.`,
      components: buildAnnounceComponents(),
      flags: MessageFlags.Ephemeral,
    })
  },
}

const ticketSetup: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('Set up the ticket system (Manage Server) — bot applies all permissions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o
        .setName('panel_channel')
        .setDescription('PUBLIC channel where the “Raise a ticket” button is posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addChannelOption((o) =>
      o
        .setName('ticket_channel')
        .setDescription('Channel to host ticket threads (bot will hide it from @everyone)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addRoleOption((o) =>
      o
        .setName('staff_role')
        .setDescription('Role that can see all tickets + pull others in')
        .setRequired(true),
    )
    .toJSON(),
  async execute(i) {
    if (!i.guildId || (await denyIfNotManager(i))) return
    const panel = i.options.getChannel('panel_channel', true)
    const ticket = i.options.getChannel('ticket_channel', true)
    const staff = i.options.getRole('staff_role', true)

    await i.deferReply({ flags: MessageFlags.Ephemeral })
    try {
      await applyTicketSetup(i.guildId, {
        panelChannelId: panel.id,
        ticketChannelId: ticket.id,
        staffRoleId: staff.id,
      })
      await i.editReply(
        [
          '✅ Ticket system ready.',
          `• Panel posted in <#${panel.id}>`,
          `• Tickets open as private threads in <#${ticket.id}> (now hidden from @everyone)`,
          `• <@&${staff.id}> can see all tickets and pull others in`,
        ].join('\n'),
      )
    } catch (err) {
      await i.editReply(
        `⚠️ Setup failed: ${(err as Error).message}\nMake sure the bot’s role is **above** the staff role and has **Manage Roles** + **Manage Channels**.`,
      )
    }
  },
}

export const commands: Command[] = [
  rank,
  leaderboard,
  badges,
  setMessageXp,
  setChannel,
  friday,
  setLevelRole,
  announce,
  ticketSetup,
]
export const commandMap = new Map(commands.map((c) => [c.data.name, c]))
