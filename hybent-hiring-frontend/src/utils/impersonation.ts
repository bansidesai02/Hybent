import { superAdminApi, type SupportSessionStart } from '@/api/superAdmin'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

/**
 * Super admin support sessions ("impersonation"), browser side.
 *
 * Starting one swaps the super admin's sign-in for a short-lived token of the
 * target user and parks the super admin's own tokens beside it. Ending one —
 * Exit, the time limit, or the API refusing the token — puts them back and
 * tells the API the session is over, which stops the token and records the
 * end. The super admin's refresh token is taken out of reach for the whole
 * session: refreshing with it would silently turn the session back into the
 * super admin while every screen still showed the client.
 */

const ACCESS = 'hybent_hiring_access_token'
const REFRESH = 'hybent_hiring_refresh_token'
const BACKUP = {
  access: 'hybent_hiring_super_admin_access_token',
  refresh: 'hybent_hiring_super_admin_refresh_token',
  user: 'hybent_hiring_super_admin_user',
}
const SESSION = 'hybent_hiring_support_session'
const NOTICE = 'hybent_hiring_support_session_notice'

export interface SupportSession {
  id: string
  expiresAt: string
  allowChanges: boolean
  /** Where ending the session returns the super admin to. */
  returnTo: string
}

const read = (key: string) => {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key)
  } catch {
    return null
  }
}

const forget = (key: string) => {
  try {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

export function getSupportSession(): SupportSession | null {
  try {
    const raw = read(SESSION)
    return raw ? (JSON.parse(raw) as SupportSession) : null
  } catch {
    return null
  }
}

export function beginSupportSession(started: SupportSessionStart, superAdmin: User, returnTo: string) {
  // Keep the backup where the super admin's own sign-in lives ("remember me" or not).
  const storage = localStorage.getItem(ACCESS) ? localStorage : sessionStorage
  const access = read(ACCESS)
  const refresh = read(REFRESH)
  if (access) storage.setItem(BACKUP.access, access)
  if (refresh) storage.setItem(BACKUP.refresh, refresh)
  storage.setItem(BACKUP.user, JSON.stringify(superAdmin))
  const session: SupportSession = {
    id: started.session.id,
    expiresAt: started.session.expires_at,
    allowChanges: started.session.allow_changes,
    returnTo,
  }
  storage.setItem(SESSION, JSON.stringify(session))

  forget(REFRESH)
  useAuthStore.getState().setTokens(started.access_token, undefined, started.user)
}

let ending: Promise<string> | null = null

/**
 * Restore the super admin and record the end. Resolves to where to go next.
 * Concurrent and repeated calls (several requests failing at once) share one run.
 */
export function endSupportSession(reason: 'exit' | 'expired'): Promise<string> {
  ending ??= restoreSuperAdmin(reason).finally(() => {
    ending = null
  })
  return ending
}

async function restoreSuperAdmin(reason: 'exit' | 'expired'): Promise<string> {
  const session = getSupportSession()
  const access = read(BACKUP.access)
  const refresh = read(BACKUP.refresh)
  const userRaw = read(BACKUP.user)
  Object.values(BACKUP).forEach(forget)
  forget(SESSION)

  const { user, setTokens, logout } = useAuthStore.getState()
  if (!access || !userRaw) {
    // Already restored (a late failure from the old token): nothing to undo.
    if (!user?.is_impersonating) return session?.returnTo || '/hiring/super-admin'
    logout()
    return '/login'
  }

  setTokens(access, refresh ?? undefined, JSON.parse(userRaw))
  if (session) {
    try {
      await superAdminApi.endImpersonation(session.id, reason)
    } catch {
      // The API also closes sessions whose time ran out on its own.
    }
  }
  return session?.returnTo || '/hiring/super-admin'
}

/**
 * For code outside React (the API client, timers): end the session, leave a
 * message for the next page, and reload into the super admin portal.
 */
export async function leaveSupportSession(reason: 'exit' | 'expired', notice: string) {
  const to = await endSupportSession(reason)
  try {
    sessionStorage.setItem(NOTICE, notice)
  } catch {
    /* the toast is a courtesy */
  }
  window.location.assign(to)
}

/** The message a session left when it ended away from the page, once. */
export function takeSupportSessionNotice(): string | null {
  try {
    const notice = sessionStorage.getItem(NOTICE)
    if (notice) sessionStorage.removeItem(NOTICE)
    return notice
  } catch {
    return null
  }
}
