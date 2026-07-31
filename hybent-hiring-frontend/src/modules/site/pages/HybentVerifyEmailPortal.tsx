import { useEffect, useState } from 'react'

import {
  AlertIcon,
  ArrowIcon,
  HybentAuthShell,
  MailIcon,
  SuccessIcon,
} from './HybentAuthKit'

/**
 * Hybent Verify Email Portal — one component, three states.
 *
 * `sent` is the page a new account lands on, `success` is where the emailed
 * link returns them, and `error` covers an expired or already-used link. They
 * share a card, so the journey never changes shape underneath the visitor.
 */

export type HybentVerifyStatus = 'sent' | 'verifying' | 'success' | 'error'

export type HybentVerifyEmailPortalProps = {
  status?: HybentVerifyStatus
  /** Shown on the `sent` state so the visitor can confirm where to look. */
  email?: string
  /** Message for the `error` state. */
  errorMessage?: string
  /** Resolve when the mail is queued; reject with an Error to surface it. */
  onResend?: () => Promise<void> | void
  onContinue?: () => void
  onBackToSignIn?: () => void
}

/** Seconds the resend button stays locked after a send. */
const RESEND_COOLDOWN = 45

export default function HybentVerifyEmailPortal({
  status = 'sent',
  email,
  errorMessage,
  onResend,
  onContinue,
  onBackToSignIn,
}: HybentVerifyEmailPortalProps) {
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [failure, setFailure] = useState('')

  /* One interval for the whole countdown, cleared on unmount. */
  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [cooldown])

  const handleResend = async () => {
    setFailure('')
    setNotice('')
    setSending(true)
    try {
      await onResend?.()
      setNotice('Verification link sent. Check your inbox.')
      setCooldown(RESEND_COOLDOWN)
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'We could not resend the link. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (status === 'success') {
    return (
      <HybentAuthShell title="Email verified" subtitle="Your Hybent account is ready">
        <div className="hlp-done">
          <span className="hlp-done__badge"><SuccessIcon /></span>
          <p>
            Thanks for confirming your address. You can sign in now and pick up wherever you left off.
          </p>
          <button type="button" className="hlp-submit" onClick={onContinue}>
            <span className="hlp-submit__sweep" aria-hidden="true" />
            <span>Continue to Hybent</span>
            <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
          </button>
        </div>
      </HybentAuthShell>
    )
  }

  if (status === 'verifying') {
    return (
      <HybentAuthShell title="Verifying your email" subtitle="This only takes a moment">
        <div className="hlp-done">
          <span className="hlp-done__badge hlp-done__badge--busy">
            <span className="hlp-spinner hlp-spinner--dark" aria-hidden="true" />
          </span>
          <p aria-live="polite">Checking your verification link…</p>
        </div>
      </HybentAuthShell>
    )
  }

  if (status === 'error') {
    return (
      <HybentAuthShell title="Link expired" subtitle="This verification link is no longer valid">
        <p className="hlp-alert" role="alert">
          <span className="hlp-alert__icon"><AlertIcon /></span>
          {errorMessage || 'This link has expired or has already been used. Send yourself a fresh one.'}
        </p>

        {notice && <p className="hlp-notice" role="status">{notice}</p>}
        {failure && (
          <p className="hlp-alert" role="alert">
            <span className="hlp-alert__icon"><AlertIcon /></span>
            {failure}
          </p>
        )}

        <button type="button" className="hlp-submit" onClick={handleResend} disabled={sending || cooldown > 0}>
          <span className="hlp-submit__sweep" aria-hidden="true" />
          {sending ? (
            <>
              <span className="hlp-spinner" aria-hidden="true" />
              <span>Sending…</span>
            </>
          ) : cooldown > 0 ? (
            <span>Resend in {cooldown}s</span>
          ) : (
            <>
              <span>Send a new link</span>
              <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
            </>
          )}
        </button>

        <p className="hlp-foot">
          <button type="button" className="hlp-underline" onClick={onBackToSignIn}>
            Back to sign in
          </button>
        </p>
      </HybentAuthShell>
    )
  }

  return (
    <HybentAuthShell title="Check your email" subtitle="We sent you a verification link">
      <div className="hlp-done">
        <span className="hlp-done__badge hlp-done__badge--mail"><MailIcon /></span>
        <p>
          {email ? (
            <>
              A verification link is on its way to <strong>{email}</strong>. Open it to activate your
              Hybent account.
            </>
          ) : (
            <>A verification link is on its way. Open it to activate your Hybent account.</>
          )}
        </p>
      </div>

      {notice && <p className="hlp-notice" role="status">{notice}</p>}
      {failure && (
        <p className="hlp-alert" role="alert">
          <span className="hlp-alert__icon"><AlertIcon /></span>
          {failure}
        </p>
      )}

      <button type="button" className="hlp-submit" onClick={handleResend} disabled={sending || cooldown > 0}>
        <span className="hlp-submit__sweep" aria-hidden="true" />
        {sending ? (
          <>
            <span className="hlp-spinner" aria-hidden="true" />
            <span>Sending…</span>
          </>
        ) : cooldown > 0 ? (
          <span>Resend in {cooldown}s</span>
        ) : (
          <>
            <span>Resend verification link</span>
            <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
          </>
        )}
      </button>

      <p className="hlp-foot">
        Wrong address?{' '}
        <button type="button" className="hlp-underline" onClick={onBackToSignIn}>
          Back to sign in
        </button>
      </p>
    </HybentAuthShell>
  )
}
