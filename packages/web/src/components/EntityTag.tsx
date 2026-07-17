import { useDiscordChannels, useDiscordMembers, useDiscordRoles } from '@/hooks/useDiscord'
import { cn } from '@/lib/utils'
import { AtSign, Hash, Volume2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

/**
 * Chips that turn a stored Discord snowflake into the human-readable name.
 * Names come from the same cached `discord/*` queries the pickers use, so
 * rendering one of these anywhere costs no extra request. When the entity can't
 * be resolved (list still loading, or it was deleted in Discord) the chip falls
 * back to the raw id in monospace so nothing ever renders blank.
 */

const chipBase =
  'inline-flex max-w-[16rem] items-center gap-1 rounded-md border border-transparent bg-muted px-1.5 py-0.5 align-middle text-xs font-medium'

function Chip({
  icon: Icon,
  label,
  resolved,
  style,
  title,
  className,
}: {
  icon: LucideIcon
  label: string
  resolved: boolean
  style?: React.CSSProperties
  title?: string
  className?: string
}) {
  return (
    <span
      className={cn(chipBase, !resolved && 'text-muted-foreground', className)}
      style={style}
      title={title}
    >
      <Icon className="size-3 shrink-0 opacity-70" />
      <span className={cn('truncate', !resolved && 'font-mono')}>{label}</span>
    </span>
  )
}

/** Discord colour int (0 = "no colour") → tinted chip styles, or undefined for the default look. */
function roleTint(color: number): React.CSSProperties | undefined {
  if (!color) return undefined
  const hex = `#${color.toString(16).padStart(6, '0')}`
  return { color: hex, backgroundColor: `${hex}1f`, borderColor: `${hex}3d` }
}

export function ChannelTag({
  guildId,
  channelId,
  className,
}: {
  guildId: string
  channelId: string
  className?: string
}) {
  const { data, isLoading } = useDiscordChannels(guildId)
  const channel = data?.find((c) => c.id === channelId)
  const Icon = channel?.kind === 'voice' ? Volume2 : Hash
  return (
    <Chip
      icon={Icon}
      label={channel?.name ?? channelId}
      resolved={!!channel}
      title={
        channel ? `#${channel.name} · ${channelId}` : isLoading ? undefined : 'Deleted channel'
      }
      className={className}
    />
  )
}

export function RoleTag({
  guildId,
  roleId,
  className,
}: {
  guildId: string
  roleId: string
  className?: string
}) {
  const { data, isLoading } = useDiscordRoles(guildId)
  const role = data?.find((r) => r.id === roleId)
  return (
    <Chip
      icon={AtSign}
      label={role?.name ?? roleId}
      resolved={!!role}
      style={role ? roleTint(role.color) : undefined}
      title={role ? `@${role.name} · ${roleId}` : isLoading ? undefined : 'Deleted role'}
      className={className}
    />
  )
}

export function MemberTag({
  guildId,
  userId,
  className,
}: {
  guildId: string
  userId: string
  className?: string
}) {
  // Empty query returns the resolvable member set; shared cache with the picker.
  const { data, isLoading } = useDiscordMembers(guildId, '')
  const member = data?.find((m) => m.id === userId)
  return (
    <Chip
      icon={AtSign}
      label={member?.displayName ?? userId}
      resolved={!!member}
      title={member ? `@${member.username} · ${userId}` : isLoading ? undefined : userId}
      className={className}
    />
  )
}
