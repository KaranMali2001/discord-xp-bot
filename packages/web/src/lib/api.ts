const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

type FetchOptions = {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

/** Typed fetch wrapper. Sends cookies, JSON-encodes bodies, throws on non-2xx. */
export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = opts
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    signal,
    headers: body != null ? { 'content-type': 'application/json' } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { error?: string; message?: string }
      message = data.error ?? data.message ?? message
    } catch {
      // response had no JSON body — keep the default message
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ── shared entity types (mirror @xp/core row/input shapes) ────────────

export type GuildConfig = {
  messageXp: number
  messageCooldownSec: number
  voicePresenceXpPerMin: number
  voiceSpeakingXpPerMin: number
  ignoreMutedVoice: boolean
  levelUpChannelId: string | null
  levelUpMessage: string
}

export type ChannelRule = {
  channelId: string
  kind: 'text' | 'voice'
  multiplier: number
  noXp: boolean
}

export type MultiplierEvent = {
  id: number
  name: string
  multiplier: number
  enabled: boolean
  countsAttendance: boolean
  channelId: string | null
  dayOfWeek: number | null
  startMinute: number | null
  endMinute: number | null
  startsAt: number | null
  endsAt: number | null
}

export type EventInput = {
  name: string
  multiplier: number
  enabled: boolean
  countsAttendance: boolean
  channelId?: string | null
  dayOfWeek?: number | null
  startMinute?: number | null
  endMinute?: number | null
  startsAt?: number | null
  endsAt?: number | null
}

export type LevelReward = {
  level: number
  roleId: string
}

export const BADGE_CRITERIA = [
  'level',
  'messages',
  'voice_minutes',
  'speaking_minutes',
  'fridays_attended',
] as const
export type BadgeCriteria = (typeof BADGE_CRITERIA)[number]

export type Badge = {
  key: string
  name: string
  description: string
  emoji: string
  criteria: BadgeCriteria
  threshold: number
}

export type LeaderboardEntry = {
  userId: string
  username: string
  level: number
  xp: number
}

export type LeaderboardPage = {
  entries: LeaderboardEntry[]
  total: number
}

export type AuthUser = {
  userId: string
  username: string
}

// ── endpoint helpers ──────────────────────────────────────────────────

const g = (guildId: string) => `/api/guilds/${encodeURIComponent(guildId)}`

export const endpoints = {
  auth: {
    me: () => apiFetch<AuthUser | null>('/auth/me'),
    logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    devLogin: (body: { userId: string; username: string; guildId: string }) =>
      apiFetch<AuthUser>('/auth/dev-login', { method: 'POST', body }),
    loginUrl: () => `${API_URL}/auth/login`,
  },

  config: {
    get: (guildId: string) => apiFetch<GuildConfig>(`${g(guildId)}/config`),
    put: (guildId: string, body: Partial<GuildConfig>) =>
      apiFetch<GuildConfig>(`${g(guildId)}/config`, { method: 'PUT', body }),
  },

  channelRules: {
    list: (guildId: string) => apiFetch<ChannelRule[]>(`${g(guildId)}/channel-rules`),
    put: (guildId: string, body: ChannelRule) =>
      apiFetch<ChannelRule>(`${g(guildId)}/channel-rules`, { method: 'PUT', body }),
    remove: (guildId: string, channelId: string) =>
      apiFetch<void>(`${g(guildId)}/channel-rules/${encodeURIComponent(channelId)}`, {
        method: 'DELETE',
      }),
  },

  events: {
    list: (guildId: string) => apiFetch<MultiplierEvent[]>(`${g(guildId)}/events`),
    create: (guildId: string, body: EventInput) =>
      apiFetch<MultiplierEvent>(`${g(guildId)}/events`, { method: 'POST', body }),
    patch: (guildId: string, id: number, body: Partial<EventInput>) =>
      apiFetch<MultiplierEvent>(`${g(guildId)}/events/${id}`, { method: 'PATCH', body }),
    remove: (guildId: string, id: number) =>
      apiFetch<void>(`${g(guildId)}/events/${id}`, { method: 'DELETE' }),
  },

  levelRewards: {
    list: (guildId: string) => apiFetch<LevelReward[]>(`${g(guildId)}/level-rewards`),
    put: (guildId: string, body: LevelReward) =>
      apiFetch<LevelReward>(`${g(guildId)}/level-rewards`, { method: 'PUT', body }),
    remove: (guildId: string, level: number) =>
      apiFetch<void>(`${g(guildId)}/level-rewards/${level}`, { method: 'DELETE' }),
  },

  badges: {
    list: (guildId: string) => apiFetch<Badge[]>(`${g(guildId)}/badges`),
    put: (guildId: string, body: Badge) =>
      apiFetch<Badge>(`${g(guildId)}/badges`, { method: 'PUT', body }),
    remove: (guildId: string, key: string) =>
      apiFetch<void>(`${g(guildId)}/badges/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  },

  leaderboard: {
    get: (guildId: string, limit: number, offset: number) =>
      apiFetch<LeaderboardPage>(`${g(guildId)}/leaderboard?limit=${limit}&offset=${offset}`),
  },
}
