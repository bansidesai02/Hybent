import { useNavigate, useSearchParams } from 'react-router-dom'

import HybentResetPasswordPortal from './HybentResetPasswordPortal'
import { authApi } from '@/api/auth'
import { AUTH } from '@/app/paths'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Wires the Hybent Reset Password Portal to the platform's reset endpoint. */
export default function HybentResetPasswordRoute() {
  useDocumentTitle(
    'Set a new password — HYBENT',
    'Choose a new password for your Hybent account.'
  )

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const handleSubmit = async (password: string) => {
    try {
      await authApi.resetPassword(token, password)
    } catch (err: any) {
      const data = err?.response?.data
      // 422s carry the real reason (e.g. a password rule) in details.errors.
      const fieldError = data?.details?.errors?.[0]
      throw new Error(
        fieldError?.ctx?.error ||
          data?.detail ||
          data?.message ||
          err?.message ||
          'We could not reset your password. The link may have expired.'
      )
    }
  }

  const handleRequestLink = async (email: string) => {
    try {
      await authApi.forgotPassword(email)
    } catch (err: any) {
      throw new Error(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          'We could not send the reset link. Please try again.'
      )
    }
  }

  return (
    <HybentResetPasswordPortal
      token={token}
      onSubmit={handleSubmit}
      onRequestLink={handleRequestLink}
      onSignIn={() => navigate(AUTH.login)}
      onRequestNewLink={() => navigate(AUTH.resetPassword)}
    />
  )
}
