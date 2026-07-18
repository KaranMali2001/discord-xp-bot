import { ShieldCheck, Trash2 } from 'lucide-react'
import * as React from 'react'
import { MemberTag } from '@/components/EntityTag'
import { MemberPicker } from '@/components/MemberPicker'
import { EmptyState, SkeletonRows } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useAddAdmin, useAdmins, useRemoveAdmin } from '@/hooks/useAdmins'

export function AdminsTab({ guildId }: { guildId: string }) {
  const { toast } = useToast()
  const query = useAdmins(guildId)
  const add = useAddAdmin(guildId)
  const remove = useRemoveAdmin(guildId)
  const [pick, setPick] = React.useState<string | null>(null)

  const admins = query.data ?? []

  const onAdd = () => {
    if (!pick) {
      toast('Pick a member first', 'error')
      return
    }
    add.mutate(pick, {
      onSuccess: () => {
        toast('Admin added')
        setPick(null)
      },
      onError: (err) => toast((err as Error).message, 'error'),
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard admins</CardTitle>
          <CardDescription>
            Members allowed to manage this guild (in addition to anyone with the Discord Manage
            Server permission).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {query.isLoading ? (
            <SkeletonRows rows={3} />
          ) : admins.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No explicit admins yet"
              hint="Anyone with Discord’s Manage Server permission can already manage this guild. Add a member below to grant access without it."
            />
          ) : (
            admins.map((userId) => (
              <div key={userId} className="flex items-center justify-between rounded-lg border p-3">
                <MemberTag guildId={guildId} userId={userId} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove admin"
                  onClick={() =>
                    remove.mutate(userId, {
                      onSuccess: () => toast('Admin removed'),
                      onError: (err) => toast((err as Error).message, 'error'),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add admin</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1 space-y-1.5">
              <Label htmlFor="admin-member">Member</Label>
              <MemberPicker id="admin-member" guildId={guildId} value={pick} onChange={setPick} />
            </div>
            <Button onClick={onAdd} disabled={add.isPending}>
              {add.isPending ? 'Adding…' : 'Add admin'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
