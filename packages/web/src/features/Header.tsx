import { LogOut, Trophy } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useDevLogin, useLogout, useMe } from '@/hooks/useAuth'
import { endpoints } from '@/lib/api'

export function Header({
  guildId,
  onGuildIdChange,
}: {
  guildId: string
  onGuildIdChange: (value: string) => void
}) {
  const { toast } = useToast()
  const me = useMe()
  const devLogin = useDevLogin()
  const logout = useLogout()

  const [userId, setUserId] = React.useState('')
  const [username, setUsername] = React.useState('')

  const onDevLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId.trim() || !username.trim() || !guildId.trim()) {
      toast('Enter guild id, user id and username', 'error')
      return
    }
    devLogin.mutate(
      { userId: userId.trim(), username: username.trim(), guildId: guildId.trim() },
      {
        onSuccess: () => toast('Logged in'),
        onError: (err) => toast((err as Error).message, 'error'),
      },
    )
  }

  return (
    <header className="border-b bg-card">
      <div className="container flex flex-col gap-4 py-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="size-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold leading-none">XP Dashboard</h1>
            <p className="text-xs text-muted-foreground">Manage your guild leveling system</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="guild-id">Guild id</Label>
            <Input
              id="guild-id"
              className="w-56"
              placeholder="Discord guild id"
              value={guildId}
              onChange={(e) => onGuildIdChange(e.target.value.trim())}
            />
          </div>

          {me.data ? (
            <div className="flex items-center gap-3">
              <span className="text-sm">
                Signed in as <span className="font-medium">{me.data.username}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  logout.mutate(undefined, {
                    onSuccess: () => toast('Logged out'),
                    onError: (err) => toast((err as Error).message, 'error'),
                  })
                }
              >
                <LogOut /> Logout
              </Button>
            </div>
          ) : (
            <form onSubmit={onDevLogin} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="dev-user-id">User id</Label>
                <Input
                  id="dev-user-id"
                  className="w-36"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dev-username">Username</Label>
                <Input
                  id="dev-username"
                  className="w-36"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={devLogin.isPending}>
                Dev login
              </Button>
              <Button variant="link" size="sm" asChild>
                <a href={endpoints.auth.loginUrl()}>Discord login</a>
              </Button>
            </form>
          )}
        </div>
      </div>
    </header>
  )
}
