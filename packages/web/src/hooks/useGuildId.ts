import * as React from 'react'

const STORAGE_KEY = 'xp.guildId'

/** Optional dev default so the dashboard renders without typing a guild id. */
const DEFAULT_GUILD_ID = (import.meta.env.VITE_DEFAULT_GUILD_ID as string | undefined) ?? ''

/** Guild id persisted to localStorage; drives every guild-scoped query. */
export function useGuildId() {
  const [guildId, setGuildIdState] = React.useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_GUILD_ID,
  )

  const setGuildId = React.useCallback((next: string) => {
    setGuildIdState(next)
    if (next) localStorage.setItem(STORAGE_KEY, next)
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { guildId, setGuildId }
}
