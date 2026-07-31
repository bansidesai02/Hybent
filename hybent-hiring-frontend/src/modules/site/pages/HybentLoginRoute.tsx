import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import HybentLoginPortal from './HybentLoginPortal'
import type { HybentLoginValues } from './HybentLoginPortal'
import { authApi } from '@/api/auth'
import { AUTH, workspaceForRole } from '@/app/paths'
import { useAuthStore } from '@/store/authStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * Wires the presentational Hybent Login Portal to the platform's auth.
 *
 * One account spans the company site and every product, so this signs in
 * against the same endpoint as the Hybent Hiring form and lands the caller in
 * whichever workspace their role owns.
 */
export default function HybentLoginRoute() {
  useDocumentTitle(
    'Log in — HYBENT',
    'Sign in to Hybent to reach Hybent Hiring and the rest of the platform.'
  )

  const navigate = useNavigate()
  const location = useLocation()
  const { setTokens, isAuthenticated, user } = useAuthStore()

  /* RequireAuth parks the page the visitor wanted here, same as the product form. */
  const intended = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(intended || workspaceForRole(user.role), { replace: true })
    }
  }, [isAuthenticated, user, intended, navigate])

  const handleSubmit = async ({ email, password, remember }: HybentLoginValues) => {
    try {
      const { data } = await authApi.login(email, password)
      setTokens(data.access_token, data.refresh_token, data.user, remember)
      navigate(intended || workspaceForRole(data.user?.role), { replace: true })
    } catch (err: any) {
      throw new Error(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          'Invalid email or password. Please try again.'
      )
    }
  }

  return (
    <HybentLoginPortal
      onSubmit={handleSubmit}
      onForgotPassword={() => navigate(AUTH.resetPassword)}
      onCreateAccount={() => navigate(AUTH.register)}
    />
  )
}
