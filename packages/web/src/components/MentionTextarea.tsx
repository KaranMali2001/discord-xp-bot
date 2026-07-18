import { Mention, MentionsInput, type SuggestionDataItem } from 'react-mentions'
import { useDiscordRoles } from '@/hooks/useDiscord'
import { endpoints } from '@/lib/api'

type MentionTextareaProps = {
  guildId: string
  /** react-mentions markup value: `@[Display](u:ID)` / `@[Display](r:ID)`. */
  value: string
  onChange: (markup: string) => void
  placeholder?: string
  id?: string
}

/**
 * Discord-style composer: type `@` to mention a member or role inline, anywhere in the
 * message. Members are searched server-side; roles are filtered from the loaded list.
 * The value is react-mentions markup — convert with lib/mentions before sending.
 */
export function MentionTextarea({
  guildId,
  value,
  onChange,
  placeholder,
  id,
}: MentionTextareaProps) {
  const rolesQuery = useDiscordRoles(guildId)

  // Combined suggestions: roles (client-filtered) + members (server search).
  const fetchData = (query: string, callback: (data: SuggestionDataItem[]) => void) => {
    const q = query.toLowerCase()
    const roleItems: SuggestionDataItem[] = (rolesQuery.data ?? [])
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 10)
      .map((r) => ({ id: `r:${r.id}`, display: r.name }))

    endpoints.discord
      .members(guildId, query || undefined)
      .then((members) => {
        const memberItems: SuggestionDataItem[] = members
          .slice(0, 15)
          .map((m) => ({ id: `u:${m.id}`, display: m.displayName }))
        callback([...roleItems, ...memberItems])
      })
      .catch(() => callback(roleItems))
  }

  return (
    <MentionsInput
      id={id}
      value={value}
      onChange={(_e, newValue) => onChange(newValue)}
      placeholder={placeholder}
      allowSpaceInQuery
      a11ySuggestionsListLabel="Members and roles"
      style={mentionsInputStyle}
    >
      <Mention
        trigger="@"
        data={fetchData}
        markup="@[__display__](__id__)"
        displayTransform={(_id, display) => `@${display}`}
        appendSpaceOnAdd
        style={{ backgroundColor: 'hsl(var(--accent))', borderRadius: 3 }}
      />
    </MentionsInput>
  )
}

// react-mentions is styled via a nested style object; map it onto the app's theme vars.
const mentionsInputStyle = {
  control: { fontSize: 14, fontFamily: 'inherit', width: '100%' },
  '&multiLine': {
    control: { minHeight: 120 },
    highlighter: { padding: '8px 12px', minHeight: 120 },
    input: {
      padding: '8px 12px',
      minHeight: 120,
      border: '1px solid hsl(var(--input))',
      borderRadius: 6,
      outline: 'none',
      color: 'hsl(var(--foreground))',
    },
  },
  suggestions: {
    zIndex: 50,
    list: {
      backgroundColor: 'hsl(var(--popover))',
      color: 'hsl(var(--popover-foreground))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 6,
      fontSize: 14,
      maxHeight: 220,
      overflowY: 'auto' as const,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    },
    item: {
      padding: '6px 10px',
      '&focused': {
        backgroundColor: 'hsl(var(--accent))',
        color: 'hsl(var(--accent-foreground))',
      },
    },
  },
}
