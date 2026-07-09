import * as React from 'react'

const STORAGE_KEY = 'xp.guildId'

/** Guild id persisted to localStorage; drives every guild-scoped query. */
export function useGuildId() {
  const [guildId, setGuildIdState] = React.useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? '',
  )

  const setGuildId = React.useCallback((next: string) => {
    setGuildIdState(next)
    if (next) localStorage.setItem(STORAGE_KEY, next)
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { guildId, setGuildId }
}
