import { ChannelPicker } from '@/components/ChannelPicker'
import { DateTimePicker } from '@/components/DateTimePicker'
import { ChannelTag } from '@/components/EntityTag'
import { MentionTextarea } from '@/components/MentionTextarea'
import { EmptyState, SkeletonRows } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import {
  useCancelScheduledAnnouncement,
  useScheduleAnnouncement,
  useScheduledAnnouncements,
  useSendAnnouncement,
} from '@/hooks/useAnnouncements'
import { markupToDiscord, markupToPlain } from '@/lib/mentions'
import { formatIst, istDateTimeLocalToEpochSec } from '@/lib/time'
import { cn } from '@/lib/utils'
import { CalendarClock, Trash2 } from 'lucide-react'
import * as React from 'react'

const MAX_LEN = 1900

export function AnnouncementsTab({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const send = useSendAnnouncement(guildId)
  const schedule = useScheduleAnnouncement(guildId)
  const cancel = useCancelScheduledAnnouncement(guildId)
  const upcoming = useScheduledAnnouncements(guildId)

  const [channelId, setChannelId] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState('') // react-mentions markup
  const [mentionEveryone, setMentionEveryone] = React.useState(false)
  const [scheduleLater, setScheduleLater] = React.useState(false)
  const [fireAtLocal, setFireAtLocal] = React.useState('')
  const [attempted, setAttempted] = React.useState(false)

  const content = markupToDiscord(message).trim() // what actually gets sent to Discord
  const preview = `${mentionEveryone ? '@everyone\n\n' : ''}${markupToPlain(message)}`.trim()
  const busy = send.isPending || schedule.isPending

  // Field-level validation, surfaced inline once the user has tried to submit.
  const fireAt = scheduleLater ? istDateTimeLocalToEpochSec(fireAtLocal) : null
  const errors = {
    channel: !channelId ? 'Pick a channel.' : null,
    message: !content
      ? 'Write a message.'
      : content.length > MAX_LEN
        ? `Message is too long by ${content.length - MAX_LEN} characters.`
        : null,
    fireAt:
      scheduleLater && fireAt == null
        ? 'Pick a date and time.'
        : scheduleLater && fireAt != null && fireAt < Math.floor(Date.now() / 1000) + 60
          ? 'Pick a time at least a minute from now.'
          : null,
  }

  const reset = () => {
    setMessage('')
    setMentionEveryone(false)
    setScheduleLater(false)
    setFireAtLocal('')
    setAttempted(false)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (errors.channel) return toast(errors.channel, 'error')
    if (errors.message) return toast(errors.message, 'error')
    if (errors.fireAt) return toast(errors.fireAt, 'error')

    if (!channelId) return
    // Mentions are inline in the message; core derives allowed-mentions from it.
    const payload = { channelId, message: content, memberIds: [], roleIds: [], mentionEveryone }
    try {
      if (scheduleLater && fireAt != null) {
        await schedule.mutateAsync({ ...payload, fireAt })
        toast(`Scheduled for ${formatIst(fireAt)}`)
      } else {
        await send.mutateAsync(payload)
        toast('Announcement posted')
      }
      reset()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  const scheduled = [...(upcoming.data ?? [])].sort((a, b) => a.fireAt - b.fireAt)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
          <CardDescription>
            Type <span className="font-mono">@</span> to mention a member or role anywhere in the
            message. Only the members and roles you mention are notified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="an-channel">Channel</Label>
              <ChannelPicker
                id="an-channel"
                guildId={guildId}
                kind="text"
                value={channelId}
                onChange={setChannelId}
              />
              {attempted && errors.channel && (
                <p className="text-xs text-destructive">{errors.channel}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="an-message">Message</Label>
              <MentionTextarea
                id="an-message"
                guildId={guildId}
                value={message}
                onChange={setMessage}
                placeholder="What do you want to announce? Type @ to mention someone…"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-destructive">
                  {attempted && errors.message ? errors.message : ''}
                </span>
                <span
                  className={cn(
                    'text-xs text-muted-foreground',
                    content.length > MAX_LEN && 'font-medium text-destructive',
                  )}
                >
                  {content.length}/{MAX_LEN}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="an-everyone"
                checked={mentionEveryone}
                onCheckedChange={setMentionEveryone}
              />
              <Label htmlFor="an-everyone" className="font-normal">
                Also ping <span className="font-mono">@everyone</span>
              </Label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="an-schedule"
                  checked={scheduleLater}
                  onCheckedChange={setScheduleLater}
                />
                <Label htmlFor="an-schedule" className="font-normal">
                  Schedule for later
                </Label>
              </div>
              {scheduleLater && (
                <div className="space-y-1.5">
                  <DateTimePicker id="an-fireat" value={fireAtLocal} onChange={setFireAtLocal} />
                  {attempted && errors.fireAt && (
                    <p className="text-xs text-destructive">{errors.fireAt}</p>
                  )}
                </div>
              )}
            </div>

            {preview && (
              <div className="space-y-1.5">
                <Label>Preview</Label>
                <pre className="whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-sm">
                  {preview}
                </pre>
              </div>
            )}

            <Button type="submit" disabled={busy}>
              {busy
                ? scheduleLater
                  ? 'Scheduling…'
                  : 'Posting…'
                : scheduleLater
                  ? 'Schedule announcement'
                  : 'Post announcement'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
          <CardDescription>Scheduled announcements that haven’t been posted yet.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.isLoading ? (
            <SkeletonRows rows={3} />
          ) : scheduled.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nothing scheduled"
              hint="Turn on “Schedule for later” above to queue an announcement."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">When (IST)</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduled.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatIst(a.fireAt)}
                    </TableCell>
                    <TableCell>
                      <ChannelTag guildId={guildId} channelId={a.channelId} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {a.message}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Cancel scheduled announcement"
                        onClick={() =>
                          cancel.mutate(a.id, {
                            onSuccess: () => toast('Cancelled'),
                            onError: (err) => toast((err as Error).message, 'error'),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
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
