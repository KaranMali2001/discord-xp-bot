import { authService, imageStore, ticketsService } from "@xp/core";
import {
  ActionRowBuilder,
  type Attachment,
  AttachmentBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  FileUploadBuilder,
  type GuildMember,
  type GuildTextThreadManager,
  LabelBuilder,
  type Message,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { log } from "../lib/log";

/**
 * Ticket system. A button in a PUBLIC, read-only panel channel opens a modal (subject +
 * description + images). On submit the ticket is posted to a staff-only COLLECTION channel
 * with a "Create thread" button — no thread yet. When staff click it, a PRIVATE thread is
 * created in the panel channel (invisible to everyone but its members) and the submitter is
 * added. Staff can pull a third person in by @mentioning them in the thread; a non-staff
 * mention can't — the message guard removes anyone a non-staff member tries to add.
 */
export const TICKET_IDS = {
  open: "ticket:open", // panel button
  modal: "ticket:modal",
  subject: "ticket:subject",
  description: "ticket:description",
  images: "ticket:images",
} as const;

const MAX_IMAGES = 10;
// Per-image cap — bounds each Cloudinary upload (the Free plan suspends on storage overage).
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** True for any component (button) that belongs to the ticket flow. */
export function isTicketComponent(customId: string): boolean {
  return customId.startsWith("ticket:");
}

/**
 * Staff = the configured staff role, or (fallback) Manage Threads / Manage Server / the
 * core admin allowlist. Uses a resolved GuildMember so role checks are reliable in both
 * button interactions and thread messages (channel-overwrite perms don't show on a raw
 * member's guild-level permission set).
 */
async function memberIsStaff(guildId: string, member: GuildMember): Promise<boolean> {
  const cfg = await ticketsService.getConfig(guildId);
  if (cfg?.staffRoleId && member.roles.cache.has(cfg.staffRoleId)) return true;
  const manageThreads = member.permissions.has(PermissionFlagsBits.ManageThreads);
  const manageGuild = member.permissions.has(PermissionFlagsBits.ManageGuild);
  return manageThreads || (await authService.canManage(guildId, member.id, manageGuild));
}

// ── the raise-ticket modal ──────────────────────────────────

function buildTicketModal(): ModalBuilder {
  const subject = new LabelBuilder()
    .setLabel("Subject")
    .setTextInputComponent(new TextInputBuilder().setCustomId(TICKET_IDS.subject).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200).setPlaceholder("Short summary of your issue"));
  const description = new LabelBuilder()
    .setLabel("Description")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(TICKET_IDS.description)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(2000)
        .setPlaceholder("What happened? Steps, links, anything useful."),
    );
  const images = new LabelBuilder()
    .setLabel("Attach images (optional)")
    .setDescription("Screenshots or photos — up to 10, 8MB each.")
    .setFileUploadComponent(new FileUploadBuilder().setCustomId(TICKET_IDS.images).setMinValues(0).setMaxValues(MAX_IMAGES).setRequired(false));
  return new ModalBuilder().setCustomId(TICKET_IDS.modal).setTitle("Raise a ticket").addLabelComponents(subject, description, images);
}

// ── the ticket message (posted inside the thread) ───────────

/**
 * Buttons on the collection-channel message: create/open the thread + resolve + close.
 * Before a thread exists it's a "Create thread" action button; after, a link to the thread.
 */
function statusButtons(guildId: string, ticket: { id: number; status: "open" | "resolved" | "closed"; threadId: string | null }) {
  const threadBtn = ticket.threadId
    ? new ButtonBuilder().setLabel("Open thread").setEmoji("💬").setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guildId}/${ticket.threadId}`)
    : new ButtonBuilder()
        .setCustomId(`ticket:thread:${ticket.id}`)
        .setLabel("Create thread")
        .setEmoji("💬")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(ticket.status === "closed");
  const resolve = new ButtonBuilder()
    .setCustomId(`ticket:resolve:${ticket.id}`)
    .setLabel("Resolve")
    .setEmoji("✅")
    .setStyle(ButtonStyle.Success)
    .setDisabled(ticket.status !== "open");
  const close = new ButtonBuilder()
    .setCustomId(`ticket:close:${ticket.id}`)
    .setLabel("Close")
    .setEmoji("🔒")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(ticket.status === "closed");
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(threadBtn, resolve, close)];
}

const STATUS_COLOR = { open: 0xfaa61a, resolved: 0x57f287, closed: 0x99aab5 } as const;

function ticketEmbed(t: { id: number; userId: string; subject: string; description: string; status: "open" | "resolved" | "closed"; imageCount: number }): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Ticket #${t.id} — ${t.subject}`)
    .setColor(STATUS_COLOR[t.status])
    .setDescription(t.description || "_No description provided._")
    .addFields({ name: "Raised by", value: `<@${t.userId}>`, inline: true }, { name: "Status", value: t.status, inline: true }, { name: "Images", value: String(t.imageCount), inline: true })
    .setTimestamp(new Date());
}

// ── handlers ────────────────────────────────────────────────

/** Panel button → modal; staff buttons on the collection message → create thread / status. */
export async function handleTicketButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) return;

  if (interaction.customId === TICKET_IDS.open) {
    if (!(await ticketsService.isReady(interaction.guildId))) {
      await interaction.reply({
        content: "⚠️ The ticket system isn’t set up yet. Ask a mod to run `/ticket-setup`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.showModal(buildTicketModal());
    return;
  }

  // Staff controls: ticket:thread:<id> / ticket:resolve:<id> / ticket:close:<id>
  const [, action, rawId] = interaction.customId.split(":");
  const id = Number(rawId);
  if ((action !== "thread" && action !== "resolve" && action !== "close") || !Number.isInteger(id)) {
    return;
  }

  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  if (!member || !(await memberIsStaff(interaction.guildId, member))) {
    await interaction.reply({
      content: "⛔ Only staff can manage tickets.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === "thread") {
    await createThread(interaction, id);
    return;
  }

  const next = action === "resolve" ? "resolved" : "closed";
  const ticket = await ticketsService.setStatus(interaction.guildId, id, next);
  if (!ticket) {
    await interaction.reply({ content: "Ticket not found.", flags: MessageFlags.Ephemeral });
    return;
  }

  const imageCount = (await ticketsService.listAttachmentMeta(interaction.guildId, id)).length;
  await interaction.update({
    embeds: [
      ticketEmbed({
        id: ticket.id,
        userId: ticket.userId,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        imageCount,
      }),
    ],
    components: statusButtons(interaction.guildId, ticket),
  });

  // On close: lock + archive the thread (if one exists) so it can't be reopened.
  if (next === "closed" && ticket.threadId) {
    try {
      const thread = await interaction.client.channels.fetch(ticket.threadId);
      if (thread?.isThread()) {
        await thread.setLocked(true);
        await thread.setArchived(true);
      }
    } catch (err) {
      log.warn("tickets", `close cleanup failed for #${ticket.id}: ${(err as Error).message}`);
    }
  }
}

/**
 * Staff pressed "Create thread" on a collection message. Spin up the private thread in the
 * PUBLIC panel channel (the submitter can see it there, but the thread is private so nobody
 * else can), add the submitter, and flip the collection message's button to a link.
 */
async function createThread(interaction: ButtonInteraction, id: number): Promise<void> {
  if (!interaction.guildId) return;
  const ticket = await ticketsService.get(interaction.guildId, id);
  if (!ticket) {
    await interaction.reply({ content: "Ticket not found.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (ticket.threadId) {
    await interaction.reply({
      content: `🧵 Thread already exists: <#${ticket.threadId}>`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const cfg = await ticketsService.getConfig(interaction.guildId);
  if (!cfg?.panelChannelId) {
    await interaction.reply({ content: "⚠️ Setup incomplete.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();
  try {
    const channel = await interaction.client.channels.fetch(cfg.panelChannelId);
    if (channel?.type !== ChannelType.GuildText) {
      throw new Error("panel channel must be a standard text channel");
    }
    const threads = channel.threads as GuildTextThreadManager<ChannelType.PublicThread | ChannelType.PrivateThread>;
    const thread = await threads.create({
      name: `ticket-${ticket.id}-${ticket.username}`.slice(0, 90),
      type: ChannelType.PrivateThread,
      invitable: false,
    });
    await thread.members.add(ticket.userId);
    await ticketsService.setThread(ticket.id, thread.id);
    await ticketsService.addParticipant(interaction.guildId, ticket.id, ticket.userId, "owner");

    const imageCount = (await ticketsService.listAttachmentMeta(interaction.guildId, ticket.id)).length;
    await thread.send({
      content: `<@${ticket.userId}> a staff member opened this thread about your ticket **#${ticket.id}**. Only you and the team can see it.`,
      embeds: [
        ticketEmbed({
          id: ticket.id,
          userId: ticket.userId,
          subject: ticket.subject,
          description: ticket.description,
          status: ticket.status,
          imageCount,
        }),
      ],
    });

    const updated = { id: ticket.id, status: ticket.status, threadId: thread.id };
    await interaction.editReply({ components: statusButtons(interaction.guildId, updated) });
    await interaction.followUp({
      content: `🧵 Thread created with <@${ticket.userId}>: <#${thread.id}>`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    log.error("tickets", `failed to create thread for #${ticket.id}: ${(err as Error).message}`);
    await interaction.followUp({
      content: `⚠️ Couldn’t create the thread.\n\`\`\`${(err as Error).message}\`\`\``,
      flags: MessageFlags.Ephemeral,
    });
  }
}

/** Download one modal attachment into a Buffer, rejecting non-images / oversized files. */
async function fetchImage(att: Attachment): Promise<{ data: Buffer; filename: string; contentType: string; sizeBytes: number } | null> {
  const contentType = att.contentType ?? "";
  if (!contentType.startsWith("image/")) return null;
  if (att.size > MAX_IMAGE_BYTES) return null;
  const res = await fetch(att.url);
  if (!res.ok) return null;
  const data = Buffer.from(await res.arrayBuffer());
  if (data.byteLength > MAX_IMAGE_BYTES) return null;
  return { data, filename: att.name ?? "image", contentType, sizeBytes: data.byteLength };
}

/**
 * Modal submit → store the ticket + images and post it to the staff collection channel with
 * a "Create thread" button. No thread yet — staff decides when to open one.
 */
export async function handleTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const cfg = await ticketsService.getConfig(interaction.guildId);
  if (!cfg?.ticketChannelId) {
    await interaction.reply({
      content: "⚠️ The ticket system isn’t set up. Please tell a mod.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const subject = interaction.fields.getTextInputValue(TICKET_IDS.subject);
  const description = interaction.fields.getTextInputValue(TICKET_IDS.description);

  const ticket = await ticketsService.create(interaction.guildId, {
    userId: interaction.user.id,
    username: interaction.user.username,
    subject,
    description,
  });

  // Download images for the staff embed + persist an attachment reference per image.
  const uploaded = interaction.fields.getUploadedFiles(TICKET_IDS.images);
  const files: AttachmentBuilder[] = [];
  let stored = 0;
  let skipped = 0;
  for (const att of uploaded?.values() ?? []) {
    try {
      const img = await fetchImage(att);
      if (!img) {
        skipped++;
        continue;
      }
      // Upload the bytes to Cloudinary (off-DB, §2.2) and store only the reference. Best-effort:
      // if Cloudinary isn't configured or the upload fails, keep the ticket with an empty ref and
      // log — never throw out of the handler (Phase-0 rule). The image is shown to staff via the
      // Discord embed below regardless.
      let ref = { cloudinaryPublicId: "", url: "" };
      if (imageStore.isConfigured()) {
        try {
          const up = await imageStore.upload(img.data, {
            folder: `tickets/${interaction.guildId}`,
            contentType: img.contentType,
          });
          // Persist ONLY the public_id — never the returned secure_url. For an authenticated
          // asset that url already embeds a permanent signature (directly viewable), so storing
          // it at rest would put an openable private-image link in the DB/backups. The API mints
          // a fresh signed URL from public_id on demand instead.
          ref = { cloudinaryPublicId: up.publicId, url: "" };
        } catch (err) {
          log.warn("tickets", `cloudinary upload failed for #${ticket.id} — storing ref-less: ${(err as Error).message}`);
        }
      }
      await ticketsService.addAttachment(interaction.guildId, ticket.id, {
        filename: img.filename,
        contentType: img.contentType,
        sizeBytes: img.sizeBytes,
        ...ref,
      });
      files.push(new AttachmentBuilder(img.data, { name: img.filename }));
      stored++;
    } catch (err) {
      skipped++;
      log.warn("tickets", `image download failed for #${ticket.id}: ${(err as Error).message}`);
    }
  }

  const embed = ticketEmbed({
    id: ticket.id,
    userId: ticket.userId,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    imageCount: stored,
  });
  if (files[0]) embed.setImage(`attachment://${files[0].name}`);

  try {
    const channel = await interaction.client.channels.fetch(cfg.ticketChannelId);
    if (!channel?.isTextBased() || !("send" in channel)) {
      throw new Error("collection channel is not a text channel");
    }
    await channel.send({
      embeds: [embed],
      components: statusButtons(interaction.guildId, {
        id: ticket.id,
        status: "open",
        threadId: null,
      }),
      files,
    });

    const extra = skipped > 0 ? ` (${skipped} file${skipped === 1 ? "" : "s"} skipped — images only, max 8MB)` : "";
    await interaction.editReply(`✅ Ticket **#${ticket.id}** submitted — our staff will review it shortly.${extra}`);
  } catch (err) {
    log.error("tickets", `failed to post ticket #${ticket.id}: ${(err as Error).message}`);
    await interaction.editReply(`⚠️ Ticket **#${ticket.id}** was saved but couldn’t be posted to staff. A mod will need to check the bot’s access to the collection channel.`);
  }
}

/**
 * Guard for messages inside ticket threads. Discord already stops outsiders (they can't
 * view the hidden channel), so this exists to (a) let STAFF pull a third person in by
 * @mentioning them — the bot grants that person access — and (b) as a backstop, remove
 * anyone a non-staff member somehow pulled in who isn't a participant.
 */
export async function handleThreadMessage(message: Message): Promise<void> {
  if (message.author.bot || !message.guildId || !message.channel.isThread()) return;
  const thread = message.channel;
  const ticket = await ticketsService.getByThread(thread.id);
  if (!ticket || ticket.status === "closed") return;

  const mentioned = message.mentions.users.filter((u) => !u.bot && u.id !== message.author.id);
  if (mentioned.size === 0) return;

  const author = message.member ?? (await message.guild?.members.fetch(message.author.id).catch(() => null));
  const authorIsStaff = author ? await memberIsStaff(message.guildId, author) : false;

  for (const user of mentioned.values()) {
    if (await ticketsService.isParticipant(ticket.id, user.id)) continue;
    // A mentioned user who is already staff has access via their role — leave them.
    const targetMember = await message.guild?.members.fetch(user.id).catch(() => null);
    if (targetMember && (await memberIsStaff(message.guildId, targetMember))) continue;

    if (authorIsStaff) {
      // Staff pulling a third person in: add them to the thread (panel channel is public, so
      // no extra permission grant is needed) and record them as a participant.
      try {
        await thread.members.add(user.id);
        await ticketsService.addParticipant(message.guildId, ticket.id, user.id, "staff");
      } catch (err) {
        log.warn("tickets", `failed to add <@${user.id}> to #${ticket.id}: ${(err as Error).message}`);
      }
    } else {
      // Non-staff can't pull anyone in — remove them if the mention managed to add them.
      await thread.members.remove(user.id).catch(() => {});
    }
  }
}
