import { authDao } from './auth.dao'

/**
 * Identity/authorization *data* only — transport-agnostic (shared by bot & api).
 * HTTP session/OAuth enforcement lives in packages/api/middleware, not here.
 *
 * A user may edit config if EITHER they hold Discord MANAGE_GUILD (the caller
 * passes `hasManageGuild`, since only the transport layer can know it) OR they're
 * on the explicit allowlist.
 */
export const authService = {
  listAdmins: authDao.list,
  addAdmin: authDao.add,
  removeAdmin: authDao.remove,

  canManage(guildId: string, userId: string, hasManageGuild: boolean): boolean {
    return hasManageGuild || authDao.isAdmin(guildId, userId)
  },
}
