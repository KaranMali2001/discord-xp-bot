import { ChannelPicker } from '@/components/ChannelPicker'
import { ChannelTag } from '@/components/EntityTag'
import { EmptyState, SkeletonRows } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { useCreateEvent, useDeleteEvent, useEvents, usePatchEvent } from '@/hooks/useEvents'
import type { EventInput } from '@/lib/api'
import { DAY_NAMES, hhmmToMinutes, minutesToHhmm } from '@/lib/time'
import { CalendarClock, Trash2 } from 'lucide-react'
import * as React from 'react'

type FormState = {
  name: string
  multiplier: number
  dayOfWeek: number
  start: string
  end: string
  countsAttendance: boolean
  channelId: string | null
}

const EMPTY: FormState = {
  name: '',
  multiplier: 2,
  dayOfWeek: 5,
  start: '18:00',
  end: '22:00',
  countsAttendance: true,
  channelId: null,
}

function describeWindow(
  dayOfWeek: number | null,
  startMinute: number | null,
  endMinute: number | null,
) {
  if (dayOfWeek == null || startMinute == null || endMinute == null) return 'one-off'
  const day = DAY_NAMES[dayOfWeek] ?? `day ${dayOfWeek}`
  return `${day} ${minutesToHhmm(startMinute)}–${minutesToHhmm(endMinute)} IST`
}

export function EventsTab({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const query = useEvents(guildId)
  const create = useCreateEvent(guildId)
  const patch = usePatchEvent(guildId)
  const remove = useDeleteEvent(guildId)
  const [form, setForm] = React.useState<FormState>(EMPTY)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const startMinute = hhmmToMinutes(form.start)
    const endMinute = hhmmToMinutes(form.end)
    if (!form.name.trim() || startMinute == null || endMinute == null) {
      toast('Enter a name and valid HH:MM start/end times', 'error')
      return
    }
    const body: EventInput = {
      name: form.name.trim(),
      multiplier: form.multiplier,
      enabled: true,
      countsAttendance: form.countsAttendance,
      dayOfWeek: form.dayOfWeek,
      startMinute,
      endMinute,
      channelId: form.channelId,
    }
    create.mutate(body, {
      onSuccess: () => {
        toast('Event created')
        setForm(EMPTY)
      },
      onError: (err) => toast((err as Error).message, 'error'),
    })
  }

  const events = query.data ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Multiplier events</CardTitle>
          <CardDescription>Recurring weekly XP windows (e.g. Friday game night).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {query.isLoading ? (
            <SkeletonRows rows={3} />
          ) : events.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No events yet"
              hint="Create a recurring window below — e.g. double XP every Friday night."
            />
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {ev.name} <span className="text-muted-foreground">×{ev.multiplier}</span>
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    {describeWindow(ev.dayOfWeek, ev.startMinute, ev.endMinute)}
                    {ev.countsAttendance ? ' · counts attendance' : ''}
                    {ev.channelId ? (
                      <>
                        {' · '}
                        <ChannelTag guildId={guildId} channelId={ev.channelId} />
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={ev.enabled}
                      onCheckedChange={(checked) =>
                        patch.mutate(
                          { id: ev.id, body: { enabled: checked } },
                          { onError: (err) => toast((err as Error).message, 'error') },
                        )
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {ev.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete event"
                    onClick={() =>
                      remove.mutate(ev.id, {
                        onSuccess: () => toast('Event deleted'),
                        onError: (err) => toast((err as Error).message, 'error'),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create recurring event</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid items-end gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-name">Name</Label>
              <Input
                id="ev-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-mult">Multiplier</Label>
              <Input
                id="ev-mult"
                type="number"
                min={0}
                step="0.5"
                value={form.multiplier}
                onChange={(e) => setForm({ ...form, multiplier: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-day">Day of week</Label>
              <select
                id="ev-day"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.dayOfWeek}
                onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
              >
                {DAY_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="ev-attend"
                checked={form.countsAttendance}
                onCheckedChange={(checked) => setForm({ ...form, countsAttendance: checked })}
              />
              <Label htmlFor="ev-attend">Counts attendance</Label>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ev-channel">Restrict to channel (optional)</Label>
              <ChannelPicker
                id="ev-channel"
                guildId={guildId}
                placeholder="(blank = applies guild-wide)"
                value={form.channelId}
                onChange={(next) => setForm({ ...form, channelId: next })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-start">Start (HH:MM IST)</Label>
              <Input
                id="ev-start"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-end">End (HH:MM IST)</Label>
              <Input
                id="ev-end"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create event'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
