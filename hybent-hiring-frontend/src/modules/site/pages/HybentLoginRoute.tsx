import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'

import HybentLoginPortal from './HybentLoginPortal'
import type { HybentLoginValues } from './HybentLoginPortal'
import { useAuthProduct, withProduct } from './useAuthProduct'
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
  const product = useAuthProduct()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)

  /* RequireAuth parks the page the visitor wanted here. `location.state` only
     survives a client-side redirect — it's empty after a full page load (a
     browser refresh, or landing back here after the Gmail OAuth round trip
     through Google and the backend), so sessionStorage is the fallback that
     actually survives that. */
  const stateIntended = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
  const intended =
    stateIntended ? stateIntended.pathname! + (stateIntended.search ?? '') : sessionStorageIntended()

  function sessionStorageIntended(): string | undefined {
    try {
      return sessionStorage.getItem('hybent_intended_path') ?? undefined
    } catch {
      return undefined
    }
  }

  useEffect(() => {
    if (isAuthenticated && user) {
      try {
        sessionStorage.removeItem('hybent_intended_path')
      } catch {
        // best-effort cleanup only
      }
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

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true)
      setGoogleError(null)
      try {
        const token = tokenResponse.access_token
        const { data } = await authApi.googleLogin(token)
        setTokens(data.access_token, data.refresh_token, data.user, true)
        navigate(intended || workspaceForRole(data.user?.role), { replace: true })
      } catch (err: any) {
        setGoogleError(
          err?.response?.data?.message ||
            err?.response?.data?.detail ||
            err?.message ||
            'Google sign-in failed. Please try again.'
        )
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: (errorResponse) => {
      setGoogleLoading(false)
      if ((errorResponse as any)?.error !== 'popup_closed_by_user') {
        setGoogleError('Google sign-in failed or was cancelled.')
      }
    },
  })

  const handleGoogleSignIn = () => {
    setGoogleError(null)
    setGoogleLoading(true)
    triggerGoogleLogin()
  }

  return (
    <HybentLoginPortal
      onSubmit={handleSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      externalError={googleError}
      externalGoogleLoading={googleLoading}
      /* `?product=` rides along, or the "Hybent Hiring" kicker disappears the
         moment someone clicks through to reset or sign-up — which is exactly
         the hand-off the deleted product-branded pages existed to prevent. */
      onForgotPassword={() => navigate(withProduct(AUTH.resetPassword, product.key))}
      onCreateAccount={() => navigate(withProduct(AUTH.register, product.key))}
    />
  )
}
