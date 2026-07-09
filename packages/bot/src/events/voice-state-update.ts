import { type Client, Events } from 'discord.js'
import { log } from '../lib/log'
import { tracker } from '../voice/tracker'

/**
 * Tracks join / leave / move / mute changes into in-memory sessions. It does NOT
 * make the bot join voice — that's decided by the tick's reconcile step, which only
 * connects while an event is active on a channel. Presence XP needs no connection.
 */
export function registerVoiceStateUpdate(client: Client): void {
  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const member = newState.member ?? oldState.member
    if (!member || member.user.bot) return

    const name = member.displayName
    const before = oldState.channelId
    const channel = newState.channel

    // "muted" for XP = self/server mute OR deaf. config.ignoreMutedVoice decides if it counts.
    const wasMuted = Boolean(
      oldState.mute || oldState.deaf || oldState.selfMute || oldState.selfDeaf,
    )
    const isMuted = Boolean(
      newState.mute || newState.deaf || newState.selfMute || newState.selfDeaf,
    )

    if (channel) {
      tracker.upsert({
        guildId: newState.guild.id,
        userId: member.id,
        username: name,
        channelId: channel.id,
        muted: isMuted,
      })
      if (before !== channel.id) {
        log.info('voice', `${name} joined #${channel.name} (muted=${isMuted})`)
      } else if (wasMuted !== isMuted) {
        log.info('voice', `${name} ${isMuted ? '🔇 muted' : '🎙️ unmuted'} in #${channel.name}`)
      } else {
        log.debug('voice', `${name} state change in #${channel.name}`)
      }
    } else {
      tracker.remove(newState.guild.id, member.id)
      log.info('voice', `${name} left voice`)
    }
  })
}
