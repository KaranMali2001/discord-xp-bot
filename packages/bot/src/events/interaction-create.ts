import { type Client, Events, type Interaction, MessageFlags } from 'discord.js'
import { commandMap } from '../commands'
import {
  ANNOUNCE_IDS,
  handleAnnounceComponent,
  handleAnnounceModal,
  isAnnounceComponent,
} from '../features/announce'
import {
  TICKET_IDS,
  handleTicketButton,
  handleTicketModal,
  isTicketComponent,
} from '../features/tickets'
import { log } from '../lib/log'

async function dispatch(interaction: Interaction): Promise<void> {
  // Slash commands.
  if (interaction.isChatInputCommand()) {
    const command = commandMap.get(interaction.commandName)
    if (!command) return
    log.info('cmd', `/${interaction.commandName} by ${interaction.user.username}`)
    await command.execute(interaction)
    return
  }

  // Modal submits.
  if (interaction.isModalSubmit()) {
    if (interaction.customId === ANNOUNCE_IDS.modal) await handleAnnounceModal(interaction)
    else if (interaction.customId === TICKET_IDS.modal) await handleTicketModal(interaction)
    return
  }

  // Ticket buttons (open panel + staff status controls).
  if (interaction.isButton() && isTicketComponent(interaction.customId)) {
    await handleTicketButton(interaction)
    return
  }

  // Select menus + buttons from the announce flow.
  if (
    (interaction.isUserSelectMenu() || interaction.isRoleSelectMenu() || interaction.isButton()) &&
    isAnnounceComponent(interaction.customId)
  ) {
    await handleAnnounceComponent(interaction)
  }
}

export function registerInteractionCreate(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await dispatch(interaction)
    } catch (err) {
      console.error('Interaction handler failed:', err)
      if (!interaction.isRepliable()) return
      const content = '⚠️ Something went wrong.'
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {})
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {})
      }
    }
  })
}
