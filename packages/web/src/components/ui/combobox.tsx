import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import * as React from 'react'

export type ComboboxOption = {
  value: string
  label: string
  hint?: string
}

type ComboboxProps = {
  options: ComboboxOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  /** Called as the user types — lets callers drive server-side search. */
  onSearchChange?: (query: string) => void
  loading?: boolean
  error?: string | null
  disabled?: boolean
  allowClear?: boolean
  className?: string
  id?: string
}

/**
 * Minimal searchable select — no extra deps. A button reveals a filtered list;
 * clicking outside or picking an option closes it. When `onSearchChange` is set,
 * filtering is delegated to the caller (server search); otherwise it filters
 * `options` locally by label.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  onSearchChange,
  loading,
  error,
  disabled,
  allowClear = true,
  className,
  id,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const rootRef = React.useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value) ?? null

  React.useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const filtered = onSearchChange
    ? options
    : options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))

  const setQuery = (q: string) => {
    setSearch(q)
    onSearchChange?.(q)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {allowClear && value && !disabled && (
            <X
              className="size-4 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
            />
          )}
          <ChevronsUpDown className="size-4 opacity-50" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="border-b p-2">
            {/* biome-ignore lint/a11y/noAutofocus: focus the filter when the panel opens */}
            <input
              autoFocus
              value={search}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="h-8 w-full rounded-sm border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {loading ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>
            ) : error ? (
              <p className="px-2 py-3 text-sm text-destructive">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No matches.</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && (
                      <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>
                    )}
                  </span>
                  {o.value === value && <Check className="size-4 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
