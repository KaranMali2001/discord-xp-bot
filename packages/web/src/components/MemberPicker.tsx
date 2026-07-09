import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { useDiscordMembers } from '@/hooks/useDiscord'
import * as React from 'react'

type MemberPickerProps = {
  guildId: string
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  id?: string
}

/** Searchable member dropdown backed by Discord's guild member search. */
export function MemberPicker({
  guildId,
  value,
  onChange,
  placeholder = 'Search members…',
  id,
}: MemberPickerProps) {
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const query = useDiscordMembers(guildId, debounced)

  const options: ComboboxOption[] = (query.data ?? []).map((m) => ({
    value: m.id,
    label: m.displayName,
    hint: `@${m.username} · ${m.id}`,
  }))

  return (
    <Combobox
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      onSearchChange={setSearch}
      loading={query.isLoading || query.isFetching}
      error={query.isError ? (query.error as Error).message : null}
      placeholder={placeholder}
    />
  )
}
