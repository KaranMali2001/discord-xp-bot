import { MemberPicker } from '@/components/MemberPicker'
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
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useBoostXp } from '@/hooks/useMembers'
import * as React from 'react'

const LIMIT = 25

function BoostXpCard({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const boost = useBoostXp(guildId)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [delta, setDelta] = React.useState(100)

  const onBoost = () => {
    if (!userId) return toast('Pick a member', 'error')
    if (!delta) return toast('Enter a non-zero amount', 'error')
    boost.mutate(
      { userId, delta },
      {
        onSuccess: (res) =>
          toast(
            res.leveledUp ? `Boosted — now level ${res.newLevel}` : `Boosted by ${res.awarded} XP`,
          ),
        onError: (err) => toast((err as Error).message, 'error'),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Boost XP</CardTitle>
        <CardDescription>
          Manually add or remove a member's XP. Roles, badges, and announcements follow
          automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="boost-member">Member</Label>
            <MemberPicker id="boost-member" guildId={guildId} value={userId} onChange={setUserId} />
          </div>
          <div className="w-32 space-y-1.5">
            <Label htmlFor="boost-delta">XP (+/−)</Label>
            <Input
              id="boost-delta"
              type="number"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value) || 0)}
            />
          </div>
          <Button onClick={onBoost} disabled={boost.isPending}>
            {boost.isPending ? 'Boosting…' : 'Apply'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function LeaderboardTab({ guildId }: { guildId: string }) {
  const query = useLeaderboard(guildId, LIMIT, 0)
  const entries = query.data?.entries ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>
            Top {LIMIT} members{query.data ? ` of ${query.data.total}` : ''} · refreshes every 5s.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="w-20">Level</TableHead>
                  <TableHead className="w-24">XP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, index) => (
                  <TableRow key={entry.userId}>
                    <TableCell className="font-medium">#{index + 1}</TableCell>
                    <TableCell>{entry.username || entry.userId}</TableCell>
                    <TableCell>{entry.level}</TableCell>
                    <TableCell>{entry.xp.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BoostXpCard guildId={guildId} />
    </div>
  )
}
