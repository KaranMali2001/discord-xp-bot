import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { useDiscordChannels } from '@/hooks/useDiscord'

type ChannelPickerProps = {
  guildId: string
  value: string | null
  onChange: (value: string | null) => void
  /** Restrict to one channel kind; omit for both. */
  kind?: 'text' | 'voice'
  placeholder?: string
  allowClear?: boolean
  id?: string
}

/**
 * Channel dropdown backed by the guild's real Discord channels. If the list
 * can't be loaded (bot offline / missing perms), degrades to a raw-id input so
 * the field is never a dead end.
 */
export function ChannelPicker({
  guildId,
  value,
  onChange,
  kind,
  placeholder = 'Select a channel…',
  allowClear = true,
  id,
}: ChannelPickerProps) {
  const query = useDiscordChannels(guildId)

  if (query.isError) {
    return (
      <Input
        id={id}
        placeholder="Channel id (couldn't load list)"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.trim() || null)}
      />
    )
  }

  const channels = (query.data ?? []).filter((c) => !kind || c.kind === kind)
  const options: ComboboxOption[] = channels.map((c) => ({
    value: c.id,
    label: `${c.kind === 'voice' ? '🔊' : '#'} ${c.name}`,
    hint: c.id,
  }))

  return (
    <Combobox
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      loading={query.isLoading}
      placeholder={placeholder}
      allowClear={allowClear}
    />
  )
}
