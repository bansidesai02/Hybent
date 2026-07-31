import { useNavigate, useSearchParams } from 'react-router-dom'

import HybentVerifyEmailPortal from './HybentVerifyEmailPortal'
import type { HybentVerifyStatus } from './HybentVerifyEmailPortal'
import { AUTH } from '@/app/paths'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const TITLES: Record<HybentVerifyStatus, [string, string]> = {
  sent: ['Check your email — HYBENT', 'Confirm your email address to activate your Hybent account.'],
  verifying: ['Verifying your email — HYBENT', 'Confirming your Hybent email address.'],
  success: ['Email verified — HYBENT', 'Your Hybent account is verified and ready to use.'],
  error: ['Link expired — HYBENT', 'Request a new Hybent verification link.'],
}

/**
 * Drives the verify-email states from the URL.
 *
 *   /verify-email?email=…      the page a new account lands on
 *   /verify-email?status=success   where the emailed link returns them
 *   /verify-email?status=error     an expired or already-used link
 *
 * The backend has no verify-email endpoint yet, so `onResend` is intentionally
 * left unwired — the button surfaces its own failure rather than pretending a
 * mail went out.
 */
export default function HybentVerifyEmailRoute() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const raw = searchParams.get('status')
  const status: HybentVerifyStatus =
    raw === 'success' || raw === 'error' || raw === 'verifying' ? raw : 'sent'

  const [title, description] = TITLES[status]
  useDocumentTitle(title, description)

  return (
    <HybentVerifyEmailPortal
      status={status}
      email={searchParams.get('email') || undefined}
      onContinue={() => navigate(AUTH.login)}
      onBackToSignIn={() => navigate(AUTH.login)}
    />
  )
}
