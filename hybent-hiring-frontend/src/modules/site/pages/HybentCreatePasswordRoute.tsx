import { useNavigate, useSearchParams } from 'react-router-dom'

import HybentCreatePasswordPortal from './HybentCreatePasswordPortal'
import { authApi } from '@/api/auth'
import { AUTH } from '@/app/paths'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * Wires the Create Password portal to the platform.
 *
 * An invite token and a reset token are the same shape and are consumed by the
 * same endpoint, so this posts to reset-password — the difference is only what
 * the visitor is told, since they have never had a password here before.
 */
export default function HybentCreatePasswordRoute() {
  useDocumentTitle(
    'Create your password — HYBENT',
    'Set the password for your new Hybent account.'
  )

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const handleSubmit = async (password: string) => {
    try {
      await authApi.resetPassword(token, password)
    } catch (err: any) {
      throw new Error(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          'We could not set your password. The invite link may have expired.'
      )
    }
  }

  return (
    <HybentCreatePasswordPortal
      token={token}
      name={searchParams.get('name') || undefined}
      email={searchParams.get('email') || undefined}
      onSubmit={handleSubmit}
      onSignIn={() => navigate(AUTH.login)}
    />
  )
}
