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
import {
  useDeleteLevelReward,
  useLevelRewards,
  useUpsertLevelReward,
} from '@/hooks/useLevelRewards'
import { Trash2 } from 'lucide-react'
import * as React from 'react'

export function LevelRewardsTab({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const query = useLevelRewards(guildId)
  const upsert = useUpsertLevelReward(guildId)
  const remove = useDeleteLevelReward(guildId)
  const [level, setLevel] = React.useState(1)
  const [roleId, setRoleId] = React.useState('')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roleId.trim()) return
    upsert.mutate(
      { level, roleId: roleId.trim() },
      {
        onSuccess: () => {
          toast('Reward saved')
          setRoleId('')
        },
        onError: (err) => toast((err as Error).message, 'error'),
      },
    )
  }

  const rewards = [...(query.data ?? [])].sort((a, b) => a.level - b.level)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Level rewards</CardTitle>
          <CardDescription>Roles granted when a member reaches a level.</CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No level rewards yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Role id</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewards.map((reward) => (
                  <TableRow key={reward.level}>
                    <TableCell>{reward.level}</TableCell>
                    <TableCell className="font-mono text-xs">{reward.roleId}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete reward"
                        onClick={() =>
                          remove.mutate(reward.level, {
                            onSuccess: () => toast('Reward deleted'),
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
          <CardTitle>Add / update reward</CardTitle>
        </CardHeader>
        <CardContent>
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lr-role">Role id</Label>
              <Input id="lr-role" value={roleId} onChange={(e) => setRoleId(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? 'Saving…' : 'Save reward'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
