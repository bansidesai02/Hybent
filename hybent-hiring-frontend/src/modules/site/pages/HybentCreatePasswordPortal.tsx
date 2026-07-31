import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  AlertIcon,
  ArrowIcon,
  EyeIcon,
  EyeOffIcon,
  HybentAuthShell,
  LockIcon,
  SuccessIcon,
} from './HybentAuthKit'

/**
 * Hybent Create Password Portal — the first password an invited user sets.
 *
 * Same shell and same rules as the reset flow, but worded for someone who has
 * never had a password here, and it greets them by name when the invite
 * carries one.
 */

export type HybentCreatePasswordPortalProps = {
  /** Absent or empty means the invite link was malformed or has expired. */
  token?: string
  /** Shown in the subtitle when the invite carries it. */
  name?: string
  email?: string
  onSubmit?: (password: string) => Promise<void> | void
  onSignIn?: () => void
}

/** 0–4: length, mixed case, a digit, a symbol. */
function scorePassword(pw: string): number {
  let score = 0
  if (pw.length >= 8) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

export default function HybentCreatePasswordPortal({
  token,
  name,
  email,
  onSubmit,
  onSignIn,
}: HybentCreatePasswordPortalProps) {
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reveal, setReveal] = useState(false)
  const [touched, setTouched] = useState({ password: false, confirm: false })
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState(false)

  const hasToken = Boolean(token)
  const strength = scorePassword(password)

  const passwordError = !password
    ? 'Choose a password.'
    : password.length < 8
      ? 'Password must be at least 8 characters.'
      : ''
  const confirmError = !confirm
    ? 'Re-enter your password.'
    : confirm !== password
      ? 'Passwords do not match.'
      : ''

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    setTouched({ password: true, confirm: true })
    if (!hasToken) {
      setFormError('This invite link is invalid or has expired. Ask your admin to send a new one.')
      return
    }
    if (passwordError) return passwordRef.current?.focus()
    if (confirmError) return confirmRef.current?.focus()
    setLoading(true)
    try {
      await onSubmit?.(password)
      setDone(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'We could not set your password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <HybentAuthShell title="You're all set" subtitle="Your Hybent password is ready">
        <div className="hlp-done">
          <span className="hlp-done__badge"><SuccessIcon /></span>
          <p>Your password has been created. Sign in to open your workspace.</p>
          <button type="button" className="hlp-submit" onClick={onSignIn}>
            <span className="hlp-submit__sweep" aria-hidden="true" />
            <span>Go to sign in</span>
            <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
          </button>
        </div>
      </HybentAuthShell>
    )
  }

  const showPassword = touched.password && Boolean(passwordError)
  const showConfirm = touched.confirm && Boolean(confirmError)
  const subtitle = name
    ? `Welcome, ${name} — set a password to finish`
    : email
      ? `Set a password for ${email}`
      : 'Set a password to finish setting up your account'

  return (
    <HybentAuthShell title="Create your password" subtitle={subtitle}>
      {!hasToken && (
        <p className="hlp-alert" role="alert">
          <span className="hlp-alert__icon"><AlertIcon /></span>
          This invite link is invalid or has expired. Ask your admin to send a new one.
        </p>
      )}

      {formError && hasToken && (
        <p className="hlp-alert" role="alert">
          <span className="hlp-alert__icon"><AlertIcon /></span>
          {formError}
        </p>
      )}

      <form className="hlp-form" onSubmit={handleSubmit} noValidate>
        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hcp-password">Password</label>
          <div className={`hlp-input${showPassword ? ' is-invalid' : ''}`}>
            <span className="hlp-input__icon"><LockIcon /></span>
            <input
              id="hcp-password"
              ref={passwordRef}
              type={reveal ? 'text' : 'password'}
              name="new-password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              disabled={loading || !hasToken}
              aria-invalid={showPassword}
              aria-describedby={showPassword ? 'hcp-password-err' : 'hcp-password-hint'}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            />
            <button
              type="button"
              className="hlp-reveal"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? 'Hide password' : 'Show password'}
              aria-pressed={reveal}
              disabled={loading || !hasToken}
            >
              {reveal ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          <div className="hlp-meter" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={i < strength ? 'on' : undefined} />
            ))}
          </div>

          {showPassword ? (
            <p className="hlp-err" id="hcp-password-err" role="alert">{passwordError}</p>
          ) : (
            <p className="hlp-hint" id="hcp-password-hint">
              Mix upper and lower case, a number and a symbol for a stronger password.
            </p>
          )}
        </div>

        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hcp-confirm">Confirm Password</label>
          <div className={`hlp-input${showConfirm ? ' is-invalid' : ''}`}>
            <span className="hlp-input__icon"><LockIcon /></span>
            <input
              id="hcp-confirm"
              ref={confirmRef}
              type={reveal ? 'text' : 'password'}
              name="confirm-password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirm}
              disabled={loading || !hasToken}
              aria-invalid={showConfirm}
              aria-describedby={showConfirm ? 'hcp-confirm-err' : undefined}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
            />
          </div>
          {showConfirm && <p className="hlp-err" id="hcp-confirm-err" role="alert">{confirmError}</p>}
        </div>

        <button className="hlp-submit" type="submit" disabled={loading || !hasToken}>
          <span className="hlp-submit__sweep" aria-hidden="true" />
          {loading ? (
            <>
              <span className="hlp-spinner" aria-hidden="true" />
              <span>Creating password…</span>
            </>
          ) : (
            <>
              <span>Create password</span>
              <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
            </>
          )}
        </button>
      </form>

      <p className="hlp-foot">
        Already have a password?{' '}
        <button type="button" className="hlp-underline" onClick={onSignIn} disabled={loading}>
          Sign in
        </button>
      </p>
    </HybentAuthShell>
  )
}
