import { type Client, Events, MessageFlags } from 'discord.js'
import { commandMap } from '../commands'
import { log } from '../lib/log'

export function registerInteractionCreate(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return
    const command = commandMap.get(interaction.commandName)
    if (!command) return
    log.info('cmd', `/${interaction.commandName} by ${interaction.user.username}`)
    try {
      await command.execute(interaction)
    } catch (err) {
      console.error(`Command /${interaction.commandName} failed:`, err)
      const content = '⚠️ Something went wrong running that command.'
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {})
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {})
      }
    }
  })
}
