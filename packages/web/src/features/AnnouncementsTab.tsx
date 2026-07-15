import { ChannelPicker } from '@/components/ChannelPicker'
import { MemberPicker } from '@/components/MemberPicker'
import { RolePicker } from '@/components/RolePicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { useDiscordMembers, useDiscordRoles } from '@/hooks/useDiscord'
import { formatIst, istDateTimeLocalToEpochSec } from '@/lib/time'
import { cn } from '@/lib/utils'
import { Trash2, X } from 'lucide-react'
import * as React from 'react'

/** A removable mention chip. */
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1">
      {label}
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove}>
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}

export function AnnouncementsTab({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const send = useSendAnnouncement(guildId)
  const schedule = useScheduleAnnouncement(guildId)
  const cancel = useCancelScheduledAnnouncement(guildId)
  const upcoming = useScheduledAnnouncements(guildId)

  // First page of members/roles gives us names for the selected-id chips.
  const membersQuery = useDiscordMembers(guildId, '')
  const rolesQuery = useDiscordRoles(guildId)

  const [channelId, setChannelId] = React.useState<string | null>(null)
  const [memberIds, setMemberIds] = React.useState<string[]>([])
  const [roleIds, setRoleIds] = React.useState<string[]>([])
  const [message, setMessage] = React.useState('')
  const [mentionEveryone, setMentionEveryone] = React.useState(false)
  const [scheduleLater, setScheduleLater] = React.useState(false)
  const [fireAtLocal, setFireAtLocal] = React.useState('')

  const memberName = (id: string) => membersQuery.data?.find((m) => m.id === id)?.displayName ?? id
  const roleName = (id: string) => rolesQuery.data?.find((r) => r.id === id)?.name ?? id

  const addMember = (id: string | null) => {
    if (id && !memberIds.includes(id)) setMemberIds((prev) => [...prev, id])
  }
  const addRole = (id: string | null) => {
    if (id && !roleIds.includes(id)) setRoleIds((prev) => [...prev, id])
  }

  const mentionsLine = [
    ...(mentionEveryone ? ['@everyone'] : []),
    ...roleIds.map((id) => `@${roleName(id)}`),
    ...memberIds.map((id) => `@${memberName(id)}`),
  ].join(' ')
  const preview = mentionsLine ? `${mentionsLine}\n\n${message}` : message

  const busy = send.isPending || schedule.isPending

  const reset = () => {
    setMemberIds([])
    setRoleIds([])
    setMessage('')
    setMentionEveryone(false)
    setScheduleLater(false)
    setFireAtLocal('')
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!channelId) return toast('Pick a channel', 'error')
    if (!message.trim()) return toast('Write a message', 'error')

    const payload = { channelId, message: message.trim(), memberIds, roleIds, mentionEveryone }
    try {
      if (scheduleLater) {
        const fireAt = istDateTimeLocalToEpochSec(fireAtLocal)
        if (fireAt == null) return toast('Pick a valid date & time', 'error')
        if (fireAt < Math.floor(Date.now() / 1000) + 60)
          return toast('Pick a time at least a minute from now', 'error')
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
            Post a message to a channel and ping the members and roles you choose. Only the people
            you pick here are notified.
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="an-members">Mention members</Label>
                <MemberPicker id="an-members" guildId={guildId} value={null} onChange={addMember} />
                {memberIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {memberIds.map((id) => (
                      <Chip
                        key={id}
                        label={memberName(id)}
                        onRemove={() => setMemberIds((prev) => prev.filter((x) => x !== id))}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="an-roles">Mention roles / tags</Label>
                <RolePicker id="an-roles" guildId={guildId} value={null} onChange={addRole} />
                {roleIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {roleIds.map((id) => (
                      <Chip
                        key={id}
                        label={roleName(id)}
                        onRemove={() => setRoleIds((prev) => prev.filter((x) => x !== id))}
                      />
                    ))}
                  </div>
                )}
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

            <div className="space-y-1.5">
              <Label htmlFor="an-message">Message</Label>
              <textarea
                id="an-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1900}
                placeholder="What do you want to announce?"
                className={cn(
                  'flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
                  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              />
              <p className="text-right text-xs text-muted-foreground">{message.length}/1900</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
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
                <div className="flex items-center gap-2">
                  <Input
                    id="an-fireat"
                    type="datetime-local"
                    value={fireAtLocal}
                    onChange={(e) => setFireAtLocal(e.target.value)}
                    className="w-auto"
                  />
                  <span className="text-xs text-muted-foreground">IST</span>
                </div>
              )}
            </div>

            {preview.trim() && (
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
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : scheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
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
                    <TableCell className="font-mono text-xs">&lt;#{a.channelId}&gt;</TableCell>
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
