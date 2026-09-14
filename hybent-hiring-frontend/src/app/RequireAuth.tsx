import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types'
import { AUTH, workspaceForRole } from './paths'

type RequireAuthProps = {
  children: ReactNode
  roles?: UserRole[]
}

/**
 * Gate for the authenticated Hybent Hiring workspaces.
 *
 * An anonymous visitor is sent to sign in with the page they wanted recorded,
 * so they land where they were going instead of on a generic dashboard. A
 * signed-in user who lacks the role for this workspace is redirected to their
 * own — never bounced back to the login screen.
 */
export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { isAuthenticated, user, hasHydrated } = useAuthStore()
  const location = useLocation()

  // zustand's persist rehydration is async — on a cold page load (a browser
  // refresh, or landing back here after the Gmail OAuth redirect) this
  // renders once before the saved session is read back in. Deciding
  // "logged out" during that one tick would bounce an actually-signed-in
  // user to /login every time, so wait for hydration to actually finish.
  if (!hasHydrated) {
    return null
  }

  if (!isAuthenticated) {
    // `state` only survives a client-side <Navigate> — it's gone on a full
    // page load (a browser refresh, or landing back here after the Gmail
    // OAuth redirect, which is a real top-level navigation through Google
    // and the backend). Stash the same target in sessionStorage too, so
    // HybentLoginRoute can still recover it after a cold reload.
    try {
      sessionStorage.setItem(
        'hybent_intended_path',
        location.pathname + location.search
      )
    } catch {
      // Storage can throw in a locked-down browsing context — losing the
      // "return to" target isn't worth failing the redirect over.
    }
    return <Navigate to={AUTH.login} state={{ from: location }} replace />
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={workspaceForRole(user.role)} replace />
  }

  return <>{children}</>
}
