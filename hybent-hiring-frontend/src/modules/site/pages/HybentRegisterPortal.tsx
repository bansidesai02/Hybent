import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  AlertIcon,
  ArrowIcon,
  BuildingIcon,
  EMAIL_RE,
  GoogleIcon,
  HybentAuthShell,
  MailIcon,
  SuccessIcon,
  UserIcon,
} from './HybentAuthKit'
import { useAuthProduct } from './useAuthProduct'

/**
 * Hybent Register Portal — the company brand's create-account surface.
 *
 * Mirrors the Hybent Hiring registration contract: name, work email and
 * organization raise an access request rather than creating a password on the
 * spot, so the success state explains what happens next.
 */

export type HybentRegisterValues = {
  fullName: string
  email: string
  organization: string
}

export type HybentRegisterPortalProps = {
  /** Resolve on success; reject with an Error to surface its message. */
  onSubmit?: (values: HybentRegisterValues) => Promise<void> | void
  onGoogleSignUp?: () => Promise<void> | void
  onSignIn?: () => void
}

export default function HybentRegisterPortal({
  onSubmit,
  onGoogleSignUp,
  onSignIn,
}: HybentRegisterPortalProps) {
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const orgRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [touched, setTouched] = useState({ fullName: false, email: false, organization: false })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState(false)

  const nameError = fullName.trim().length < 2 ? 'Enter your full name.' : ''
  const emailError = !email.trim()
    ? 'Enter your work email.'
    : !EMAIL_RE.test(email.trim())
      ? 'Enter a valid email address.'
      : ''
  const orgError = organization.trim().length < 2 ? 'Enter your organization name.' : ''

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    setTouched({ fullName: true, email: true, organization: true })
    if (nameError) return nameRef.current?.focus()
    if (emailError) return emailRef.current?.focus()
    if (orgError) return orgRef.current?.focus()
    setLoading(true)
    try {
      await onSubmit?.({
        fullName: fullName.trim(),
        email: email.trim(),
        organization: organization.trim(),
      })
      setDone(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'We could not submit your request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setFormError('')
    setGoogleLoading(true)
    try {
      await onGoogleSignUp?.()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Google sign-up failed. Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const busy = loading || googleLoading
  const product = useAuthProduct()

  if (done) {
    return (
      <HybentAuthShell title="You're on the list" subtitle="Your Hybent access request is in">
        <div className="hlp-done">
          <span className="hlp-done__badge"><SuccessIcon /></span>
          <p>
            Thanks, <strong>{fullName.trim().split(' ')[0]}</strong>. We sent a confirmation to{' '}
            <strong>{email.trim()}</strong> and our team will reach out within one business day to set
            up <strong>{organization.trim()}</strong>.
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

  const showName = touched.fullName && Boolean(nameError)
  const showEmail = touched.email && Boolean(emailError)
  const showOrg = touched.organization && Boolean(orgError)

  return (
    <HybentAuthShell
      eyebrow={product.label}
      title="Create your account"
      subtitle={product.label ? `Get started with ${product.label}` : 'Start building on Hybent'}
      wide
    >
      {formError && (
        <p className="hlp-alert" role="alert">
          <span className="hlp-alert__icon"><AlertIcon /></span>
          {formError}
        </p>
      )}

      <form className="hlp-form" onSubmit={handleSubmit} noValidate>
        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hrp-name">Full Name</label>
          <div className={`hlp-input${showName ? ' is-invalid' : ''}`}>
            <span className="hlp-input__icon"><UserIcon /></span>
            <input
              id="hrp-name"
              ref={nameRef}
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              value={fullName}
              disabled={busy}
              aria-invalid={showName}
              aria-describedby={showName ? 'hrp-name-err' : undefined}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
            />
          </div>
          {showName && <p className="hlp-err" id="hrp-name-err" role="alert">{nameError}</p>}
        </div>

        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hrp-email">Work Email</label>
          <div className={`hlp-input${showEmail ? ' is-invalid' : ''}`}>
            <span className="hlp-input__icon"><MailIcon /></span>
            <input
              id="hrp-email"
              ref={emailRef}
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              disabled={busy}
              aria-invalid={showEmail}
              aria-describedby={showEmail ? 'hrp-email-err' : undefined}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            />
          </div>
          {showEmail && <p className="hlp-err" id="hrp-email-err" role="alert">{emailError}</p>}
        </div>

        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hrp-org">Organization</label>
          <div className={`hlp-input${showOrg ? ' is-invalid' : ''}`}>
            <span className="hlp-input__icon"><BuildingIcon /></span>
            <input
              id="hrp-org"
              ref={orgRef}
              type="text"
              name="organization"
              autoComplete="organization"
              placeholder="Acme Inc."
              value={organization}
              disabled={busy}
              aria-invalid={showOrg}
              aria-describedby={showOrg ? 'hrp-org-err' : undefined}
              onChange={(e) => setOrganization(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, organization: true }))}
            />
          </div>
          {showOrg ? (
            <p className="hlp-err" id="hrp-org-err" role="alert">{orgError}</p>
          ) : (
            <p className="hlp-hint">We use this to set up your workspace.</p>
          )}
        </div>

        <button className="hlp-submit" type="submit" disabled={busy}>
          <span className="hlp-submit__sweep" aria-hidden="true" />
          {loading ? (
            <>
              <span className="hlp-spinner" aria-hidden="true" />
              <span>Creating your account…</span>
            </>
          ) : (
            <>
              <span>Create your account</span>
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
        Already on Hybent?{' '}
        <button type="button" className="hlp-underline" onClick={onSignIn} disabled={busy}>
          Sign in instead
        </button>
      </p>
    </HybentAuthShell>
  )
}
