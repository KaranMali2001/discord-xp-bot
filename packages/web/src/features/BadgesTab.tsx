import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useBadges, useDeleteBadge, useUpsertBadge } from '@/hooks/useBadges'
import { BADGE_CRITERIA, type Badge, type BadgeCriteria } from '@/lib/api'
import { Trash2 } from 'lucide-react'
import * as React from 'react'

type FormState = {
  key: string
  name: string
  emoji: string
  criteria: BadgeCriteria
  threshold: number
}

const EMPTY: FormState = {
  key: '',
  name: '',
  emoji: '🏅',
  criteria: 'level',
  threshold: 10,
}

export function BadgesTab({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const query = useBadges(guildId)
  const upsert = useUpsertBadge(guildId)
  const remove = useDeleteBadge(guildId)
  const [form, setForm] = React.useState<FormState>(EMPTY)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.key.trim() || !form.name.trim()) return
    const body: Badge = {
      key: form.key.trim(),
      name: form.name.trim(),
      description: '',
      emoji: form.emoji.trim() || '🏅',
      criteria: form.criteria,
      threshold: form.threshold,
    }
    upsert.mutate(body, {
      onSuccess: () => {
        toast('Badge saved')
        setForm(EMPTY)
      },
      onError: (err) => toast((err as Error).message, 'error'),
    })
  }

  const badges = query.data ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>Awarded when a member stat crosses the threshold.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : badges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No badges yet.</p>
          ) : (
            badges.map((badge) => (
              <div
                key={badge.key}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{badge.emoji}</span>
                  <div className="space-y-0.5">
                    <p className="font-medium">{badge.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{badge.key}</span> · {badge.criteria} ≥{' '}
                      {badge.threshold}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete badge"
                  onClick={() =>
                    remove.mutate(badge.key, {
                      onSuccess: () => toast('Badge deleted'),
                      onError: (err) => toast((err as Error).message, 'error'),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add / update badge</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid items-end gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-key">Key</Label>
              <Input
                id="b-key"
                placeholder="lowercase_key"
                value={form.key}
                onChange={(e) =>
                  setForm({
                    ...form,
                    // Enforce the server's key format as the user types.
                    key: e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, '_')
                      .replace(/[^a-z0-9_-]/g, ''),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, - and _ only.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-name">Name</Label>
              <Input
                id="b-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-emoji">Emoji</Label>
              <Input
                id="b-emoji"
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-criteria">Criteria</Label>
              <select
                id="b-criteria"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.criteria}
                onChange={(e) => setForm({ ...form, criteria: e.target.value as BadgeCriteria })}
              >
                {BADGE_CRITERIA.map((criteria) => (
                  <option key={criteria} value={criteria}>
                    {criteria}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-threshold">Threshold</Label>
              <Input
                id="b-threshold"
                type="number"
                min={1}
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) || 1 })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? 'Saving…' : 'Save badge'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
