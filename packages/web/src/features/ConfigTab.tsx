import * as React from 'react'
import { ChannelPicker } from '@/components/ChannelPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { useConfig, useUpdateConfig } from '@/hooks/useConfig'
import type { GuildConfig } from '@/lib/api'

type NumericField =
  | 'messageXp'
  | 'messageCooldownSec'
  | 'voicePresenceXpPerMin'
  | 'voiceSpeakingXpPerMin'

const NUMERIC_FIELDS: { key: NumericField; label: string; hint: string }[] = [
  { key: 'messageXp', label: 'Message XP', hint: 'XP granted per eligible message' },
  {
    key: 'messageCooldownSec',
    label: 'Message cooldown (sec)',
    hint: 'Min seconds between XP grants',
  },
  {
    key: 'voicePresenceXpPerMin',
    label: 'Voice presence XP / min',
    hint: 'XP per minute in voice',
  },
  {
    key: 'voiceSpeakingXpPerMin',
    label: 'Voice speaking XP / min',
    hint: 'XP per minute speaking',
  },
]

export function ConfigTab({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const query = useConfig(guildId)
  const update = useUpdateConfig(guildId)
  const [form, setForm] = React.useState<GuildConfig | null>(null)

  React.useEffect(() => {
    if (query.data) setForm(query.data)
  }, [query.data])

  if (query.isLoading || !form) {
    return <p className="text-sm text-muted-foreground">Loading config…</p>
  }
  if (query.isError) {
    return <p className="text-sm text-destructive">Failed to load config.</p>
  }

  const current = form

  const setNumber = (key: NumericField, value: string) => {
    setForm({ ...current, [key]: Number(value) || 0 })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    update.mutate(
      {
        messageXp: current.messageXp,
        messageCooldownSec: current.messageCooldownSec,
        voicePresenceXpPerMin: current.voicePresenceXpPerMin,
        voiceSpeakingXpPerMin: current.voiceSpeakingXpPerMin,
        ignoreMutedVoice: current.ignoreMutedVoice,
        levelUpChannelId: current.levelUpChannelId,
        levelUpMessage: current.levelUpMessage,
      },
      {
        onSuccess: () => toast('Config saved'),
        onError: (err) => toast((err as Error).message, 'error'),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guild config</CardTitle>
        <CardDescription>Global XP knobs for this guild.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {NUMERIC_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type="number"
                  min={0}
                  value={current[field.key]}
                  onChange={(e) => setNumber(field.key, e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{field.hint}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="ignoreMuted">Ignore muted voice</Label>
              <p className="text-xs text-muted-foreground">
                Skip XP for members who are muted in voice.
              </p>
            </div>
            <Switch
              id="ignoreMuted"
              checked={current.ignoreMutedVoice}
              onCheckedChange={(checked) => setForm({ ...current, ignoreMutedVoice: checked })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="levelUpChannelId">Level-up channel</Label>
            <ChannelPicker
              id="levelUpChannelId"
              guildId={guildId}
              kind="text"
              placeholder="(blank = announce in the same channel)"
              value={current.levelUpChannelId}
              onChange={(next) => setForm({ ...current, levelUpChannelId: next })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="levelUpMessage">Level-up message</Label>
            <Input
              id="levelUpMessage"
              value={current.levelUpMessage}
              onChange={(e) => setForm({ ...current, levelUpMessage: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Supports {'{user}'} and {'{level}'} placeholders.
            </p>
          </div>

          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
