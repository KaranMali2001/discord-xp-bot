import { ChannelPicker } from '@/components/ChannelPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useConfig, useUpdateConfig } from '@/hooks/useConfig'
import { Mic, Square } from 'lucide-react'
import * as React from 'react'

/**
 * Dev control: make the bot join a voice channel *now* and track activity, without
 * creating an event. Writes the capture target to guild config; the bot's tick picks it
 * up within ~2s and joins (see reconcileConnections). Clearing it makes the bot leave.
 */
export function VoiceCaptureCard({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const config = useConfig(guildId)
  const update = useUpdateConfig(guildId)

  const activeChannelId = config.data?.voiceCaptureChannelId ?? null
  const [channelId, setChannelId] = React.useState<string | null>(null)

  // Reflect the persisted target once config loads.
  React.useEffect(() => {
    if (activeChannelId) setChannelId(activeChannelId)
  }, [activeChannelId])

  const start = () => {
    if (!channelId) return toast('Pick a voice channel first', 'error')
    update.mutate(
      { voiceCaptureChannelId: channelId },
      {
        onSuccess: () => toast('Bot joining — capturing voice activity'),
        onError: (e) => toast((e as Error).message, 'error'),
      },
    )
  }

  const stop = () => {
    update.mutate(
      { voiceCaptureChannelId: null },
      {
        onSuccess: () => toast('Capture stopped — bot leaving'),
        onError: (e) => toast((e as Error).message, 'error'),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="size-4 text-primary" /> Voice capture
        </CardTitle>
        <CardDescription>
          Make the bot join a voice channel now and track activity — no event required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="vc-channel">Voice channel</Label>
            <ChannelPicker
              id="vc-channel"
              guildId={guildId}
              kind="voice"
              value={channelId}
              onChange={setChannelId}
            />
          </div>
          {activeChannelId ? (
            <Button variant="outline" onClick={stop} disabled={update.isPending}>
              <Square /> Stop
            </Button>
          ) : (
            <Button onClick={start} disabled={update.isPending}>
              <Mic /> Start capture
            </Button>
          )}
        </div>
        {activeChannelId && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block size-2 animate-pulse rounded-full bg-red-500" />
            Capturing — the bot is in voice and tracking activity.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
