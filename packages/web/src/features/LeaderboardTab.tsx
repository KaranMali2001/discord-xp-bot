import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLeaderboard } from '@/hooks/useLeaderboard'

const LIMIT = 25

export function LeaderboardTab({ guildId }: { guildId: string }) {
  const query = useLeaderboard(guildId, LIMIT, 0)
  const entries = query.data?.entries ?? []

  return (
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
  )
}
