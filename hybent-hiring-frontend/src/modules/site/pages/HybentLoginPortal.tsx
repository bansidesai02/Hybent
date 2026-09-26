import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  AlertIcon,
  ArrowIcon,
  CheckIcon,
  EMAIL_RE,
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  HybentAuthShell,
  LockIcon,
  MailIcon,
} from './HybentAuthKit'
import { useAuthProduct } from './useAuthProduct'

/**
 * Hybent Login Portal — the company brand's sign-in.
 *
 * Presentation only: every side effect arrives as a prop, so the same component
 * serves the app route, Storybook, or a standalone paste. The background, glass
 * card and animated border light come from HybentAuthKit, which the sign-up and
 * reset-password pages share.
 */

export type HybentLoginValues = {
  email: string
  password: string
  remember: boolean
}

export type HybentLoginPortalProps = {
  /** Resolve to sign the user in; reject with an Error to surface its message. */
  onSubmit?: (values: HybentLoginValues) => Promise<void> | void
  onGoogleSignIn?: () => Promise<void> | void
  onForgotPassword?: () => void
  onCreateAccount?: () => void
  externalError?: string | null
  externalGoogleLoading?: boolean
}

export default function HybentLoginPortal({
  onSubmit,
  onGoogleSignIn,
  onForgotPassword,
  onCreateAccount,
  externalError,
  externalGoogleLoading = false,
}: HybentLoginPortalProps) {
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [reveal, setReveal] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const activeGoogleLoading = googleLoading || externalGoogleLoading
  const activeError = externalError || formError

  const emailError = !email.trim()
    ? 'Enter your email address.'
    : !EMAIL_RE.test(email.trim())
      ? 'Enter a valid email address.'
      : ''
  const passwordError = !password
    ? 'Enter your password.'
    : password.length < 8
      ? 'Password must be at least 8 characters.'
      : ''

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    setTouched({ email: true, password: true })
    if (emailError) return emailRef.current?.focus()
    if (passwordError) return passwordRef.current?.focus()
    setLoading(true)
    try {
      await onSubmit?.({ email: email.trim(), password, remember })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'We could not sign you in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setFormError('')
    setGoogleLoading(true)
    try {
      await onGoogleSignIn?.()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const busy = loading || activeGoogleLoading
  const showEmailError = touched.email && Boolean(emailError)
  const showPasswordError = touched.password && Boolean(passwordError)
  /* `?product=hiring` puts "Hybent Hiring" above the title, so someone arriving
     from a product is not silently handed to the parent brand. */
  const product = useAuthProduct()

  return (
    <HybentAuthShell
      eyebrow={product.label}
      title="Welcome Back"
      subtitle={
        product.label
          ? `Sign in to continue to ${product.label}`
          : 'Sign in to continue to Hybent'
      }
    >
      {activeError && (
        <p className="hlp-alert" role="alert">
          <span className="hlp-alert__icon"><AlertIcon /></span>
          {activeError}
        </p>
      )}

      <form className="hlp-form" onSubmit={handleSubmit} noValidate>
        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hlp-email">Email Address</label>
          <div className={`hlp-input${showEmailError ? ' is-invalid' : ''}`}>
            <span className="hlp-input__icon"><MailIcon /></span>
            <input
              id="hlp-email"
              ref={emailRef}
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              disabled={busy}
              aria-invalid={showEmailError}
              aria-describedby={showEmailError ? 'hlp-email-err' : undefined}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            />
          </div>
          {showEmailError && <p className="hlp-err" id="hlp-email-err" role="alert">{emailError}</p>}
        </div>

        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hlp-password">Password</label>
          <div className={`hlp-input${showPasswordError ? ' is-invalid' : ''}`}>
            <span className="hlp-input__icon"><LockIcon /></span>
            <input
              id="hlp-password"
              ref={passwordRef}
              type={reveal ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              disabled={busy}
              aria-invalid={showPasswordError}
              aria-describedby={showPasswordError ? 'hlp-password-err' : undefined}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            />
            <button
              type="button"
              className="hlp-reveal"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? 'Hide password' : 'Show password'}
              aria-pressed={reveal}
              disabled={busy}
            >
              {reveal ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {showPasswordError && <p className="hlp-err" id="hlp-password-err" role="alert">{passwordError}</p>}
        </div>

        <div className="hlp-row">
          <label className="hlp-check">
            <input type="checkbox" checked={remember} disabled={busy} onChange={(e) => setRemember(e.target.checked)} />
            <span className="hlp-check__box" aria-hidden="true"><CheckIcon /></span>
            <span className="hlp-check__text">Remember me</span>
          </label>
          <button type="button" className="hlp-link" onClick={onForgotPassword} disabled={busy}>
            Forgot password?
          </button>
        </div>

        {/* Disabled only while a request is in flight. Gating it on validity
            instead would grey the button out with no stated reason and hide
            the very errors the user needs to read. */}
        <button className="hlp-submit" type="submit" disabled={busy}>
          <span className="hlp-submit__sweep" aria-hidden="true" />
          {loading ? (
            <>
              <span className="hlp-spinner" aria-hidden="true" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Login to Hybent</span>
              <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
            </>
          )}
        </button>
      </form>

      <div className="hlp-divider"><span>OR</span></div>

      <button type="button" className="hlp-google" onClick={handleGoogle} disabled={busy}>
        {googleLoading ? (
          <span className="hlp-spinner hlp-spinner--dark" aria-hidden="true" />
        ) : (
          <span className="hlp-google__icon"><GoogleIcon /></span>
        )}
        <span>Continue with Google</span>
      </button>

      <p className="hlp-foot">
        New to Hybent?{' '}
        <button type="button" className="hlp-underline" onClick={onCreateAccount} disabled={busy}>
          Book a demo or request access
        </button>
      </p>
    </HybentAuthShell>
  )
}
