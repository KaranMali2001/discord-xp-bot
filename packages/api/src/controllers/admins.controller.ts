import { authService } from '@xp/core'
import { z } from 'zod'
import { parse } from '../lib/validate'

const addAdminBody = z.object({ userId: z.string().min(1) })

export const adminsController = {
  list(guildId: string) {
    return authService.listAdmins(guildId)
  },

  async add(guildId: string, body: unknown) {
    const { userId } = parse(addAdminBody, body)
    await authService.addAdmin(guildId, userId)
    return { ok: true, userId }
  },

  async remove(guildId: string, userId: string) {
    await authService.removeAdmin(guildId, userId)
    return { ok: true }
  },
}
