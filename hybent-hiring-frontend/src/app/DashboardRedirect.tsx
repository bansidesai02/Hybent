import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { AUTH, workspaceForRole } from './paths'

/**
 * `/dashboard` is the one URL anyone can be sent to — an email, a bookmark, a
 * support reply — without knowing the recipient's role. It resolves to that
 * person's workspace, or to sign-in if there is nobody signed in.
 */
export function DashboardRedirect() {
  const { isAuthenticated, user, hasHydrated } = useAuthStore()

  // Same async-rehydration race as RequireAuth — this component exists
  // specifically for cold-load entry points, so it's the most exposed to it.
  if (!hasHydrated) return null

  if (!isAuthenticated) return <Navigate to={AUTH.login} replace />
  return <Navigate to={workspaceForRole(user?.role)} replace />
}
