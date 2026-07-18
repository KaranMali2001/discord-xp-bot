import * as React from 'react'
import { ChannelPicker } from '@/components/ChannelPicker'
import { RolePicker } from '@/components/RolePicker'
import { SkeletonRows } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useSaveTicketConfig, useTicketConfig } from '@/hooks/useTickets'

export function TicketsTab({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const query = useTicketConfig(guildId)
  const save = useSaveTicketConfig(guildId)

  const [panelChannelId, setPanelChannelId] = React.useState<string | null>(null)
  const [ticketChannelId, setTicketChannelId] = React.useState<string | null>(null)
  const [staffRoleId, setStaffRoleId] = React.useState<string | null>(null)

  // Seed the form from saved config once it loads.
  React.useEffect(() => {
    if (query.data) {
      setPanelChannelId(query.data.panelChannelId)
      setTicketChannelId(query.data.ticketChannelId)
      setStaffRoleId(query.data.staffRoleId)
    }
  }, [query.data])

  const ready = Boolean(panelChannelId && ticketChannelId && staffRoleId)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!panelChannelId || !ticketChannelId || !staffRoleId) {
      toast('Pick a panel channel, a ticket channel, and a staff role.', 'error')
      return
    }
    save.mutate(
      { panelChannelId, ticketChannelId, staffRoleId },
      {
        onSuccess: () => toast('Ticket system set up — permissions applied & panel posted.'),
        onError: (err) => toast((err as Error).message, 'error'),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ticket system</CardTitle>
        <CardDescription>
          Pick the channels and staff role — the bot applies all Discord permissions for you: it
          makes the panel channel read-only, hides the collection channel from everyone, grants the
          staff role access, and posts the “Raise a ticket” panel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <SkeletonRows rows={3} />
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="panelChannel">Panel channel (public)</Label>
              <ChannelPicker
                id="panelChannel"
                guildId={guildId}
                kind="text"
                placeholder="Where members click “Raise a ticket”"
                value={panelChannelId}
                onChange={setPanelChannelId}
              />
              <p className="text-xs text-muted-foreground">
                Everyone can see this and click the button — the bot makes it read-only. Private
                ticket threads are created here but stay invisible to everyone but the participants.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ticketChannel">Collection channel (staff-only)</Label>
              <ChannelPicker
                id="ticketChannel"
                guildId={guildId}
                kind="text"
                placeholder="Where submitted tickets land for staff"
                value={ticketChannelId}
                onChange={setTicketChannelId}
              />
              <p className="text-xs text-muted-foreground">
                The bot hides this from @everyone. Each submission (info + images) posts here with a
                “Create thread” button — staff decide when to open the private conversation.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staffRole">Staff role</Label>
              <RolePicker
                id="staffRole"
                guildId={guildId}
                value={staffRoleId}
                onChange={setStaffRoleId}
                placeholder="Role that can see all tickets"
              />
              <p className="text-xs text-muted-foreground">
                This role sees every ticket and can pull a third person into a thread by @mentioning
                them. Others cannot.
              </p>
            </div>

            <Button type="submit" disabled={save.isPending || !ready}>
              {save.isPending ? 'Applying…' : 'Save & apply'}
            </Button>

            <p className="text-xs text-muted-foreground">
              Note: the bot’s role must sit <strong>above</strong> the staff role and have Manage
              Roles + Manage Channels, so it can edit the channel’s permissions.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
