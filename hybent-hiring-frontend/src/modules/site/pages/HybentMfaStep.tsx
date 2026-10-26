import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { AlertIcon, ArrowIcon, HybentAuthShell, LockIcon } from './HybentAuthKit'

/**
 * Second sign-in step when the platform requires 2FA for organization admins
 * (super admin → Configuration → "Require 2FA for tenant admins").
 *
 * Presentation only, like HybentLoginPortal: the route owns the API calls.
 */
export default function HybentMfaStep({
  email,
  onVerify,
  onResend,
  onCancel,
}: {
  email: string
  /** Resolve once signed in; reject with an Error to show its message. */
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<void>
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the email.')
      inputRef.current?.focus()
      return
    }
    setLoading(true)
    try {
      await onVerify(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work. Please try again.')
      setCode('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setNotice('')
    try {
      await onResend()
      setNotice('A new code is on its way. Earlier codes no longer work.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a new code.')
    }
  }

  return (
    <HybentAuthShell title="Check your email" subtitle={`We sent a 6-digit sign-in code to ${email}. It expires in 10 minutes.`}>
      {error && (
        <p className="hlp-alert" role="alert">
          <span className="hlp-alert__icon"><AlertIcon /></span>
          {error}
        </p>
      )}
      {notice && <p className="hlp-foot" role="status">{notice}</p>}

      <form className="hlp-form" onSubmit={handleSubmit} noValidate>
        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hlp-otp">Sign-in code</label>
          <div className="hlp-input">
            <span className="hlp-input__icon"><LockIcon /></span>
            <input
              id="hlp-otp"
              ref={inputRef}
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              disabled={loading}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
        </div>

        <button className="hlp-submit" type="submit" disabled={loading}>
          <span className="hlp-submit__sweep" aria-hidden="true" />
          {loading ? (
            <>
              <span className="hlp-spinner" aria-hidden="true" />
              <span>Verifying…</span>
            </>
          ) : (
            <>
              <span>Verify and sign in</span>
              <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
            </>
          )}
        </button>
      </form>

      <p className="hlp-foot">
        Didn&apos;t get it?{' '}
        <button type="button" className="hlp-underline" onClick={handleResend} disabled={loading}>
          Send a new code
        </button>
        {' · '}
        <button type="button" className="hlp-underline" onClick={onCancel} disabled={loading}>
          Use a different account
        </button>
      </p>
    </HybentAuthShell>
  )
}
