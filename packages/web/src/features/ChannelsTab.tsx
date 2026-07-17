import { ChannelPicker } from '@/components/ChannelPicker'
import { ChannelTag } from '@/components/EntityTag'
import { EmptyState, SkeletonRows } from '@/components/States'
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
  useChannelRules,
  useDeleteChannelRule,
  useUpsertChannelRule,
} from '@/hooks/useChannelRules'
import type { ChannelRule } from '@/lib/api'
import { Hash, Trash2 } from 'lucide-react'
import * as React from 'react'

const EMPTY: ChannelRule = { channelId: '', kind: 'text', multiplier: 1, noXp: false }

export function ChannelsTab({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const query = useChannelRules(guildId)
  const upsert = useUpsertChannelRule(guildId)
  const remove = useDeleteChannelRule(guildId)
  const [form, setForm] = React.useState<ChannelRule>(EMPTY)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.channelId.trim()) return
    upsert.mutate(
      { ...form, channelId: form.channelId.trim() },
      {
        onSuccess: () => {
          toast('Channel rule saved')
          setForm(EMPTY)
        },
        onError: (err) => toast((err as Error).message, 'error'),
      },
    )
  }

  const rules = query.data ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Channel rules</CardTitle>
          <CardDescription>Per-channel multipliers and XP exclusions.</CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <SkeletonRows />
          ) : rules.length === 0 ? (
            <EmptyState
              icon={Hash}
              title="No channel rules yet"
              hint="Add a rule below to boost or mute XP in a specific channel."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Multiplier</TableHead>
                  <TableHead>No XP</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.channelId}>
                    <TableCell>
                      <ChannelTag guildId={guildId} channelId={rule.channelId} />
                    </TableCell>
                    <TableCell className="capitalize">{rule.kind}</TableCell>
                    <TableCell>×{rule.multiplier}</TableCell>
                    <TableCell>{rule.noXp ? 'yes' : 'no'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete rule"
                        onClick={() =>
                          remove.mutate(rule.channelId, {
                            onSuccess: () => toast('Rule deleted'),
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
          <CardTitle>Add / update rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid items-end gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="channelId">Channel</Label>
              <ChannelPicker
                id="channelId"
                guildId={guildId}
                kind={form.kind}
                value={form.channelId || null}
                onChange={(next) => setForm({ ...form, channelId: next ?? '' })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kind">Kind</Label>
              <select
                id="kind"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as ChannelRule['kind'] })}
              >
                <option value="text">text</option>
                <option value="voice">voice</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="multiplier">Multiplier</Label>
              <Input
                id="multiplier"
                type="number"
                min={0}
                step="0.1"
                value={form.multiplier}
                onChange={(e) => setForm({ ...form, multiplier: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="noXp"
                checked={form.noXp}
                onCheckedChange={(checked) => setForm({ ...form, noXp: checked })}
              />
              <Label htmlFor="noXp">No XP in this channel</Label>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? 'Saving…' : 'Save rule'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
