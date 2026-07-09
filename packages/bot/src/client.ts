import { Client, GatewayIntentBits, Options, Partials } from 'discord.js'

/**
 * The bot lives in ONE server, so discord.js's default caches are wildly oversized.
 * We cap message cache hard (we award on the event, never re-read the cache) and
 * disable caches we never touch. This keeps RSS ~100MB instead of growing unbounded.
 */
export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, // privileged — enable in the dev portal
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers, // privileged — needed to assign level roles
    ],
    partials: [Partials.Channel],
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 25,
      PresenceManager: 0,
      ReactionManager: 0,
      GuildEmojiManager: 0,
      GuildStickerManager: 0,
    }),
    sweepers: {
      ...Options.DefaultSweeperSettings,
      messages: { interval: 300, lifetime: 600 },
    },
  })
}
