import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { AUTH, workspaceForRole } from './paths'

/**
 * `/dashboard` is the one URL anyone can be sent to — an email, a bookmark, a
 * support reply — without knowing the recipient's role. It resolves to that
 * person's workspace, or to sign-in if there is nobody signed in.
 */
/* `?to=` destinations a role actually has — the installed app's home-screen
   shortcuts use them. Anything else falls back to the workspace home rather
   than an unknown path (which would land on the marketing site). */
const SHORTCUTS: Partial<Record<string, string[]>> = {
  recruiter: ['copilot', 'candidates', 'pipeline', 'interviews'],
  admin: ['copilot', 'candidates', 'pipeline', 'interviews'],
  interviewer: ['interviews'],
}

export function DashboardRedirect() {
  const { isAuthenticated, user, hasHydrated } = useAuthStore()
  const [params] = useSearchParams()

  // Same async-rehydration race as RequireAuth — this component exists
  // specifically for cold-load entry points, so it's the most exposed to it.
  if (!hasHydrated) return null

  if (!isAuthenticated) return <Navigate to={AUTH.login} replace />
  const home = workspaceForRole(user?.role)
  const to = params.get('to')
  const allowed = to && SHORTCUTS[user?.role ?? '']?.includes(to)
  return <Navigate to={allowed ? `${home}/${to}` : home} replace />
}
