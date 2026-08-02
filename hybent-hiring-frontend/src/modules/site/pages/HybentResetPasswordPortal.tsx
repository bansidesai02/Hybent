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
import { useAuthProduct } from './useAuthProduct'

/**
 * Hybent Reset Password Portal — the company brand's set-a-new-password surface.
 *
 * The reset token arrives in the URL, so a missing one is surfaced up front
 * rather than after the user has typed a password they cannot submit.
 */

export type HybentResetPasswordPortalProps = {
  /** Absent or empty means the link was malformed or the token was stripped. */
  token?: string
  /** Resolve on success; reject with an Error to surface its message. */
  onSubmit?: (password: string) => Promise<void> | void
  onSignIn?: () => void
  onRequestNewLink?: () => void
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

export default function HybentResetPasswordPortal({
  token,
  onSubmit,
  onSignIn,
  onRequestNewLink,
}: HybentResetPasswordPortalProps) {
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
    ? 'Enter a new password.'
    : password.length < 8
      ? 'Password must be at least 8 characters.'
      : ''
  const confirmError = !confirm
    ? 'Re-enter your new password.'
    : confirm !== password
      ? 'Passwords do not match.'
      : ''

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    setTouched({ password: true, confirm: true })
    if (!hasToken) {
      setFormError('This reset link is invalid or has expired. Request a new one.')
      return
    }
    if (passwordError) return passwordRef.current?.focus()
    if (confirmError) return confirmRef.current?.focus()
    setLoading(true)
    try {
      await onSubmit?.(password)
      setDone(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'We could not reset your password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const product = useAuthProduct()

  if (done) {
    return (
      <HybentAuthShell title="Password updated" subtitle="You can sign in with your new password">
        <div className="hlp-done">
          <span className="hlp-done__badge"><SuccessIcon /></span>
          <p>Your Hybent password has been changed. For safety, any other sessions have been signed out.</p>
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

  return (
    <HybentAuthShell
      eyebrow={product.label}
      title="Set new password"
      subtitle="Choose a password you have not used before"
    >
      {!hasToken && (
        <p className="hlp-alert" role="alert">
          <span className="hlp-alert__icon"><AlertIcon /></span>
          This reset link is invalid or has expired. Request a new one to continue.
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
          <label className="hlp-label" htmlFor="hrs-password">New Password</label>
          <div className={`hlp-input${showPassword ? ' is-invalid' : ''}`}>
            <span className="hlp-input__icon"><LockIcon /></span>
            <input
              id="hrs-password"
              ref={passwordRef}
              type={reveal ? 'text' : 'password'}
              name="new-password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              disabled={loading || !hasToken}
              aria-invalid={showPassword}
              aria-describedby={showPassword ? 'hrs-password-err' : 'hrs-password-hint'}
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
            <p className="hlp-err" id="hrs-password-err" role="alert">{passwordError}</p>
          ) : (
            <p className="hlp-hint" id="hrs-password-hint">
              Mix upper and lower case, a number and a symbol for a stronger password.
            </p>
          )}
        </div>

        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hrs-confirm">Confirm Password</label>
          <div className={`hlp-input${showConfirm ? ' is-invalid' : ''}`}>
            <span className="hlp-input__icon"><LockIcon /></span>
            <input
              id="hrs-confirm"
              ref={confirmRef}
              type={reveal ? 'text' : 'password'}
              name="confirm-password"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirm}
              disabled={loading || !hasToken}
              aria-invalid={showConfirm}
              aria-describedby={showConfirm ? 'hrs-confirm-err' : undefined}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
            />
          </div>
          {showConfirm && <p className="hlp-err" id="hrs-confirm-err" role="alert">{confirmError}</p>}
        </div>

        <button className="hlp-submit" type="submit" disabled={loading || !hasToken}>
          <span className="hlp-submit__sweep" aria-hidden="true" />
          {loading ? (
            <>
              <span className="hlp-spinner" aria-hidden="true" />
              <span>Updating password…</span>
            </>
          ) : (
            <>
              <span>Reset password</span>
              <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
            </>
          )}
        </button>
      </form>

      <p className="hlp-foot">
        {hasToken ? (
          <>
            Remembered it?{' '}
            <button type="button" className="hlp-underline" onClick={onSignIn} disabled={loading}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            Link expired?{' '}
            <button type="button" className="hlp-underline" onClick={onRequestNewLink}>
              Request a new one
            </button>
          </>
        )}
      </p>
    </HybentAuthShell>
  )
}
