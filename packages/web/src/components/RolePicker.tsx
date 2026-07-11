import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { useDiscordRoles } from '@/hooks/useDiscord'

type RolePickerProps = {
  guildId: string
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  id?: string
}

/**
 * Role dropdown backed by the guild's real roles. Roles the bot can't assign (above its
 * own highest role) are flagged in the hint. Falls back to a raw-id input if the list
 * can't be loaded.
 */
export function RolePicker({
  guildId,
  value,
  onChange,
  placeholder = 'Select a role…',
  id,
}: RolePickerProps) {
  const query = useDiscordRoles(guildId)

  if (query.isError) {
    return (
      <Input
        id={id}
        placeholder="Role id (couldn't load list)"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.trim() || null)}
      />
    )
  }

  const options: ComboboxOption[] = (query.data ?? []).map((r) => ({
    value: r.id,
    label: r.name,
    hint: r.assignable ? r.id : '⚠ above the bot — not assignable',
  }))

  return (
    <Combobox
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      loading={query.isLoading}
      placeholder={placeholder}
    />
  )
}
