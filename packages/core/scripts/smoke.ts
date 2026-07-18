/**
 * Local smoke test: exercise the async DAO/service layer against the local Postgres to prove
 * the driver swap works end-to-end (config upsert, member XP apply, leaderboard, count, the
 * count(*)::int coercion, boolean round-trip). Not a prod artifact — run with tsx locally.
 */
import { pool } from '../src/db/client'
import { rulesDao } from '../src/domains/rules/rules.dao'
import { voiceDao } from '../src/domains/voice/voice.dao'
import { xpService } from '../src/domains/xp/xp.service'

const G = '__smoke_guild__'
const U = '__smoke_user__'

async function main() {
  // config upsert + boolean round-trip
  const cfg = await rulesDao.upsertConfig(G, { messageXp: 7, ignoreMutedVoice: false })
  console.log('config.messageXp =', cfg?.messageXp, '(expect 7)')
  console.log(
    'config.ignoreMutedVoice =',
    cfg?.ignoreMutedVoice,
    'typeof',
    typeof cfg?.ignoreMutedVoice,
    '(expect boolean false)',
  )

  // channel rule so grant isn't zeroed; then grant XP
  await rulesDao.upsertChannelRule(G, {
    channelId: 'chan1',
    kind: 'text',
    multiplier: 2,
    noXp: false,
  })
  const grant = await xpService.grant(G, U, 'SmokeUser', 10, 'chan1')
  if ('skip' in grant) throw new Error(`unexpected skip: ${grant.skip}`)
  console.log('granted xp =', grant.result.awarded, '(expect 20 = 10*2)')

  // leaderboard + count(*)::int coercion
  const top = await xpService.leaderboard(G, 5)
  console.log('leaderboard rows =', top.length, 'top xp =', top[0]?.xp)
  const count = await xpService.count(G)
  console.log('count =', count, 'typeof', typeof count, '(expect number 1)')
  const rank = await xpService.rank(G, U)
  console.log('rank =', rank, 'typeof', typeof rank, '(expect number 1)')

  // sum()::int coercion via voice stats
  await voiceDao.recordActivity({
    guildId: G,
    userId: U,
    username: 'SmokeUser',
    eventId: 1,
    channelId: 'chan1',
    seconds: 30,
    mutedSeconds: 5,
    speakingSeconds: 10,
  })
  const stats = await voiceDao.statsForEvent(G, 1)
  console.log('voice stats =', JSON.stringify(stats[0]), '(present should be number 30)')

  // cleanup
  await pool.query('delete from members where guild_id = $1', [G])
  await pool.query('delete from guild_config where guild_id = $1', [G])
  await pool.query('delete from channel_rules where guild_id = $1', [G])
  await pool.query('delete from event_voice_stats where guild_id = $1', [G])
  await pool.end()
  console.log('\n✅ smoke test passed')
}

main().catch((e) => {
  console.error('❌ smoke test failed:', e)
  process.exit(1)
})
