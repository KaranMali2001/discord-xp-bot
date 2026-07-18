import { CalendarClock, Mic } from 'lucide-react'
import * as React from 'react'
import { EmptyState, SkeletonRows } from '@/components/States'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useEventAttendance, useEvents } from '@/hooks/useEvents'
import type { EventAttendanceRow } from '@/lib/api'

/** seconds → compact "1h 04m" / "4m 12s" / "38s". */
function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

function Summary({ rows }: { rows: EventAttendanceRow[] }) {
  const attendees = rows.length
  const totalPresent = rows.reduce((n, r) => n + r.presentSeconds, 0)
  const totalSpeaking = rows.reduce((n, r) => n + r.speakingSeconds, 0)
  const avgStay = attendees > 0 ? totalPresent / attendees : 0

  const stat = (label: string, value: string) => (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stat('Attendees', String(attendees))}
      {stat('Avg. stay', fmtDuration(avgStay))}
      {stat('Total present', fmtDuration(totalPresent))}
      {stat('Total talk time', fmtDuration(totalSpeaking))}
    </div>
  )
}

export function AttendanceTab({ guildId }: { guildId: string }) {
  const events = useEvents(guildId)
  const [eventId, setEventId] = React.useState<number | null>(null)

  // Default to the first event once loaded.
  React.useEffect(() => {
    const first = events.data?.[0]
    if (eventId == null && first) setEventId(first.id)
  }, [events.data, eventId])

  const attendance = useEventAttendance(guildId, eventId)
  const rows = attendance.data?.rows ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          <CardDescription>
            Voice duration per member for an event — how long they stayed, how much was unmuted vs
            muted, and actual talk time. Summed across every day the event ran · refreshes every
            10s.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="attendance-event">Event</Label>
            <select
              id="attendance-event"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={eventId ?? ''}
              onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : null)}
            >
              {(events.data ?? []).length === 0 && <option value="">No events yet</option>}
              {(events.data ?? []).map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                  {ev.countsAttendance ? '' : ' (attendance off)'}
                </option>
              ))}
            </select>
          </div>

          {eventId != null && rows.length > 0 && <Summary rows={rows} />}

          {attendance.isLoading ? (
            <SkeletonRows rows={5} />
          ) : eventId == null ? (
            <EmptyState
              icon={CalendarClock}
              title="No event selected"
              hint="Pick an event above to see who showed up and for how long."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Mic}
              title="No voice activity yet"
              hint="Attendance appears here once members join voice while this event is running."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="w-28 text-right">Stayed</TableHead>
                  <TableHead className="w-28 text-right">Unmuted</TableHead>
                  <TableHead className="w-28 text-right">Muted</TableHead>
                  <TableHead className="w-28 text-right">Talk time</TableHead>
                  <TableHead className="w-16 text-right">Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.userId}>
                    <TableCell className="font-medium">#{i + 1}</TableCell>
                    <TableCell>{r.username || r.userId}</TableCell>
                    <TableCell className="text-right">{fmtDuration(r.presentSeconds)}</TableCell>
                    <TableCell className="text-right">
                      {fmtDuration(r.presentSeconds - r.mutedSeconds)}
                    </TableCell>
                    <TableCell className="text-right">{fmtDuration(r.mutedSeconds)}</TableCell>
                    <TableCell className="text-right">{fmtDuration(r.speakingSeconds)}</TableCell>
                    <TableCell className="text-right">{r.days}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
