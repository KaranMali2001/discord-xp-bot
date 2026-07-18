import { Trash2 } from 'lucide-react'
import * as React from 'react'
import { RolePicker } from '@/components/RolePicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { useCreateRole } from '@/hooks/useDiscord'
import {
  useDeleteLevelReward,
  useLevelRewards,
  useUpsertLevelReward,
} from '@/hooks/useLevelRewards'

type Mode = 'create' | 'existing'

/** Global fallback used when a tier has no custom message (mirrors core DEFAULT_CONFIG). */
const DEFAULT_TIER_MESSAGE = '🎖️ {user} is now {role}!'

/** #rrggbb → Discord integer colour. */
function hexToInt(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16) || 0
}

export function LevelRewardsTab({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const query = useLevelRewards(guildId)
  const upsert = useUpsertLevelReward(guildId)
  const remove = useDeleteLevelReward(guildId)
  const createRole = useCreateRole(guildId)

  const [mode, setMode] = React.useState<Mode>('create')
  const [level, setLevel] = React.useState(5)
  const [name, setName] = React.useState('')
  const [color, setColor] = React.useState('#5865f2')
  const [roleId, setRoleId] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState('')

  const busy = upsert.isPending || createRole.isPending

  const reset = () => {
    setName('')
    setRoleId(null)
    setMessage('')
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      let targetRoleId = roleId
      if (mode === 'create') {
        if (!name.trim()) return toast('Enter a role name', 'error')
        const role = await createRole.mutateAsync({
          name: name.trim(),
          color: hexToInt(color),
          hoist: true,
        })
        targetRoleId = role.id
      }
      if (!targetRoleId) return toast('Pick a role', 'error')
      await upsert.mutateAsync({ level, roleId: targetRoleId, message: message.trim() || null })
      toast('Tier saved')
      reset()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  const rewards = [...(query.data ?? [])].sort((a, b) => a.level - b.level)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Level tiers</CardTitle>
          <CardDescription>
            One rank role per member — reaching a higher tier replaces the lower one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tiers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Level</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewards.map((reward) => (
                  <TableRow key={reward.level}>
                    <TableCell>{reward.level}</TableCell>
                    <TableCell className="font-mono text-xs">
                      &lt;@&amp;{reward.roleId}&gt;
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {reward.message || <span className="italic">default</span>}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete tier"
                        onClick={() =>
                          remove.mutate(reward.level, {
                            onSuccess: () => toast('Tier deleted'),
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

      <Card>
        <CardHeader>
          <CardTitle>Add tier</CardTitle>
          <CardDescription>Create a new hoisted role, or map one you already have.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button
              type="button"
              variant={mode === 'create' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('create')}
            >
              Create new role
            </Button>
            <Button
              type="button"
              variant={mode === 'existing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('existing')}
            >
              Use existing role
            </Button>
          </div>

          <form onSubmit={onSubmit} className="grid items-end gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="lr-level">Level</Label>
              <Input
                id="lr-level"
                type="number"
                min={1}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value) || 1)}
              />
            </div>

            {mode === 'create' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="lr-name">Role name</Label>
                  <Input
                    id="lr-name"
                    placeholder="e.g. Veteran"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lr-color">Colour</Label>
                  <Input
                    id="lr-color"
                    type="color"
                    className="h-9 w-full p-1"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="lr-role">Role</Label>
                <RolePicker id="lr-role" guildId={guildId} value={roleId} onChange={setRoleId} />
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="lr-msg">Announcement (optional)</Label>
              <Input
                id="lr-msg"
                placeholder={DEFAULT_TIER_MESSAGE}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Blank uses the default: <span className="font-mono">{DEFAULT_TIER_MESSAGE}</span>.
                Supports {'{user}'}, {'{role}'}, {'{level}'}.
              </p>
            </div>

            <div className="sm:col-span-3">
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save tier'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
