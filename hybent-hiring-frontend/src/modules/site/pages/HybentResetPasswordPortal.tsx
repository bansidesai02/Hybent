import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  AlertIcon,
  ArrowIcon,
  EMAIL_RE,
  EyeIcon,
  EyeOffIcon,
  HybentAuthShell,
  LockIcon,
  MailIcon,
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
  /** Without a token the page asks for an email and sends a fresh reset link. */
  onRequestLink?: (email: string) => Promise<void> | void
}

/** 0–4: length, mixed case, a digit, a symbol. */
function scorePassword(pw: string): number {
  let score = 0
  if (pw.length >= 12) score++
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
  onRequestLink,
}: HybentResetPasswordPortalProps) {
  if (!token && onRequestLink) return <RequestLinkForm onRequestLink={onRequestLink} onSignIn={onSignIn} />
  return <SetPasswordForm token={token} onSubmit={onSubmit} onSignIn={onSignIn} onRequestNewLink={onRequestNewLink} />
}

function RequestLinkForm({
  onRequestLink,
  onSignIn,
}: {
  onRequestLink: (email: string) => Promise<void> | void
  onSignIn?: () => void
}) {
  const product = useAuthProduct()
  const emailRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [sent, setSent] = useState(false)

  const emailError = !email.trim()
    ? 'Enter your email address.'
    : !EMAIL_RE.test(email.trim())
      ? 'Enter a valid email address.'
      : ''
  const showEmail = touched && Boolean(emailError)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    setTouched(true)
    if (emailError) return emailRef.current?.focus()
    setLoading(true)
    try {
      await onRequestLink(email.trim())
      setSent(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'We could not send the reset link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <HybentAuthShell title="Check your email" subtitle="A reset link is on its way">
        <div className="hlp-done">
          <span className="hlp-done__badge"><SuccessIcon /></span>
          <p>
            If an account exists for <strong>{email.trim()}</strong>, we have sent a link to set a new password.
            It expires in 30 minutes.
          </p>
          <button type="button" className="hlp-submit" onClick={onSignIn}>
            <span className="hlp-submit__sweep" aria-hidden="true" />
            <span>Back to sign in</span>
            <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
          </button>
        </div>
      </HybentAuthShell>
    )
  }

  return (
    <HybentAuthShell
      eyebrow={product.label}
      title="Reset your password"
      subtitle="Enter your email and we will send you a reset link"
    >
      {formError && (
        <p className="hlp-alert" role="alert">
          <span className="hlp-alert__icon"><AlertIcon /></span>
          {formError}
        </p>
      )}

      <form className="hlp-form" onSubmit={handleSubmit} noValidate>
        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hrs-email">Email Address</label>
          <div className={`hlp-input${showEmail ? ' is-invalid' : ''}`}>
            <span className="hlp-input__icon"><MailIcon /></span>
            <input
              id="hrs-email"
              ref={emailRef}
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              disabled={loading}
              aria-invalid={showEmail}
              aria-describedby={showEmail ? 'hrs-email-err' : undefined}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
            />
          </div>
          {showEmail && <p className="hlp-err" id="hrs-email-err" role="alert">{emailError}</p>}
        </div>

        <button className="hlp-submit" type="submit" disabled={loading}>
          <span className="hlp-submit__sweep" aria-hidden="true" />
          {loading ? (
            <>
              <span className="hlp-spinner" aria-hidden="true" />
              <span>Sending link…</span>
            </>
          ) : (
            <>
              <span>Send reset link</span>
              <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
            </>
          )}
        </button>
      </form>

      <p className="hlp-foot">
        Remembered it?{' '}
        <button type="button" className="hlp-underline" onClick={onSignIn} disabled={loading}>
          Back to sign in
        </button>
      </p>
    </HybentAuthShell>
  )
}

function SetPasswordForm({
  token,
  onSubmit,
  onSignIn,
  onRequestNewLink,
}: Omit<HybentResetPasswordPortalProps, 'onRequestLink'>) {
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

  // Mirrors the backend's validate_password_strength, so a weak password is
  // caught here instead of coming back as a generic 422.
  const passwordError = !password
    ? 'Enter a new password.'
    : password.length < 12
      ? 'Password must be at least 12 characters.'
      : !/[A-Z]/.test(password)
        ? 'Add at least one uppercase letter.'
        : !/[a-z]/.test(password)
          ? 'Add at least one lowercase letter.'
          : !/\d/.test(password)
            ? 'Add at least one number.'
            : !/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)
              ? 'Add at least one symbol, e.g. ! @ # $ %.'
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
              placeholder="At least 12 characters"
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
              At least 12 characters, with upper and lower case letters, a number and a symbol.
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
