/**
 * react-mentions stores its value as markup: `@[Display](TYPE:ID)` where TYPE is
 * `u` (user) or `r` (role) — see MentionTextarea. These helpers convert that markup
 * to the two forms we need: Discord message content, and a plain human preview.
 */
const MARKUP_RE = /@\[([^\]]+)\]\((u|r):(\d+)\)/g

/** Markup → Discord content: `@[Alice](u:123)` → `<@123>`, `@[Mods](r:456)` → `<@&456>`. */
export function markupToDiscord(value: string): string {
  return value.replace(MARKUP_RE, (_m, _display, type, id) =>
    type === 'u' ? `<@${id}>` : `<@&${id}>`,
  )
}

/** Markup → plain preview: `@[Alice](u:123)` → `@Alice`. */
export function markupToPlain(value: string): string {
  return value.replace(MARKUP_RE, (_m, display) => `@${display}`)
}
