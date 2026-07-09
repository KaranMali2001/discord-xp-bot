import { authService } from '@xp/core'
import { z } from 'zod'
import { parse } from '../lib/validate'

const addAdminBody = z.object({ userId: z.string().min(1) })

export const adminsController = {
  list(guildId: string) {
    return authService.listAdmins(guildId)
  },

  add(guildId: string, body: unknown) {
    const { userId } = parse(addAdminBody, body)
    authService.addAdmin(guildId, userId)
    return { ok: true, userId }
  },

  remove(guildId: string, userId: string) {
    authService.removeAdmin(guildId, userId)
    return { ok: true }
  },
}
