import { env } from '@xp/core'
import { REST, Routes } from 'discord.js'
import { commands } from './commands'

/**
 * Registers slash commands. If DISCORD_GUILD_ID is set we register to that guild
 * (updates INSTANTLY — always dev this way); otherwise globally (up to ~1h to appear).
 * Run standalone: `pnpm --filter @xp/bot commands:deploy`.
 */
export async function deployCommands(): Promise<void> {
  const rest = new REST().setToken(env.DISCORD_TOKEN)
  const body = commands.map((c) => c.data)

  if (env.DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
      body,
    })
    console.log(`Deployed ${body.length} guild commands to ${env.DISCORD_GUILD_ID}.`)
  } else {
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body })
    console.log(`Deployed ${body.length} global commands.`)
  }
}

// Allow running this file directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  deployCommands().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
