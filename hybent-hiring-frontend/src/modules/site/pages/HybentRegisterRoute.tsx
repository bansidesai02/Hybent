import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'

import HybentRegisterPortal from './HybentRegisterPortal'
import type { HybentRegisterValues } from './HybentRegisterPortal'
import { authApi } from '@/api/auth'
import { AUTH, workspaceForRole } from '@/app/paths'
import { useAuthStore } from '@/store/authStore'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * Wires the Hybent Register Portal to the public demo-request endpoint — the
 * same lead pipeline the Hybent Hiring form posts to, so a request raised from
 * either brand surface lands in one place.
 */
export default function HybentRegisterRoute() {
  useDocumentTitle(
    'Create your account — HYBENT',
    'Request access to Hybent and start with Hybent Hiring, our AI recruitment platform.'
  )

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'
  const { setTokens } = useAuthStore()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)

  const handleSubmit = async ({ fullName, email, organization }: HybentRegisterValues) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || ''
    const [first, ...rest] = fullName.split(' ')
    const response = await fetch(`${apiBase}/api/public/demo-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: first || fullName,
        last_name: rest.join(' ') || 'User',
        work_email: email,
        company_name: organization,
        team_size: 'Lead from Hybent Register',
        monthly_hires: 'Lead from Hybent Register',
        hiring_challenge: isDemo ? 'Book a Demo Request' : 'Get Started Free Request',
      }),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'We could not submit your request. Please try again.')
    }
  }

  const triggerGoogleSignUp = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true)
      setGoogleError(null)
      try {
        const token = tokenResponse.access_token
        const { data } = await authApi.googleLogin(token)
        setTokens(data.access_token, data.refresh_token, data.user, true)
        navigate(workspaceForRole(data.user?.role), { replace: true })
      } catch (err: any) {
        setGoogleError(
          err?.response?.data?.message ||
            err?.response?.data?.detail ||
            err?.message ||
            'Google sign-up failed. Please try again.'
        )
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: (errorResponse) => {
      setGoogleLoading(false)
      if ((errorResponse as any)?.error !== 'popup_closed_by_user') {
        setGoogleError('Google sign-up failed or was cancelled.')
      }
    },
  })

  const handleGoogleSignUp = () => {
    setGoogleError(null)
    setGoogleLoading(true)
    triggerGoogleSignUp()
  }

  return (
    <HybentRegisterPortal
      onSubmit={handleSubmit}
      onGoogleSignUp={handleGoogleSignUp}
      externalError={googleError}
      externalGoogleLoading={googleLoading}
      onSignIn={() => navigate(AUTH.login)}
    />
  )
}
