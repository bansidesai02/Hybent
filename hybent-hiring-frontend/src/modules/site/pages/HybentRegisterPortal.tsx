import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  AlertIcon,
  ArrowIcon,
  BuildingIcon,
  CheckIcon,
  EMAIL_RE,
  HybentAuthShell,
  MailIcon,
  SuccessIcon,
  UserIcon,
} from './HybentAuthKit'
import { useAuthProduct } from './useAuthProduct'

/**
 * Hybent Access Request — what /register renders.
 *
 * Hybent is invite-only: organizations are provisioned by our team, and the
 * backend rejects public registration outright (auth_service.register_user)
 * and refuses Google sign-in for unknown accounts. So this page does not
 * pretend to create an account. It collects a demo or access request, sends it
 * to the sales pipeline, and says plainly what happens next.
 */

export type AccessIntent = 'demo' | 'access'

export type HybentRegisterValues = {
  intent: AccessIntent
  fullName: string
  email: string
  organization: string
  teamSize: string
}

export type SelectedPlan = { label: string; price: string }

export type HybentRegisterPortalProps = {
  /** Resolve on success; reject with an Error to surface its message. */
  onSubmit?: (values: HybentRegisterValues) => Promise<void> | void
  onSignIn?: () => void
  onContact?: () => void
  onBackToSite?: () => void
  initialIntent?: AccessIntent
  /** Set when the visitor arrived from a pricing card. */
  plan?: SelectedPlan | null
}

const TEAM_SIZES = ['1–10', '11–50', '51–200', '201–1,000', '1,000+']

function ChevronDown() {
  return (
    <svg className="hlp-input__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function WhatHappensNext({ onContact }: { onContact?: () => void }) {
  const steps = [
    { title: 'Tell us about your team', text: 'A few details so we can prepare a walkthrough around your roles.' },
    { title: 'We reach out within one business day', text: 'A short call to see Hybent Hiring on your own hiring pipeline.' },
    { title: 'We set up your workspace', text: 'Your admin and recruiter accounts are created for you, ready to invite your team.' },
  ]
  return (
    <>
      <p className="hlp-aside__kicker"><i aria-hidden="true" />Hybent Hiring</p>
      <h2>
        See Hybent Hiring <span>on your own pipeline</span>
      </h2>
      <p className="hlp-aside__lead">
        Every Hybent workspace is set up by our team, so you start with the right plan,
        seats and configuration from day one.
      </p>
      <ul className="hlp-aside__list">
        {steps.map((step) => (
          <li key={step.title}>
            <span className="hlp-aside__tick"><CheckIcon /></span>
            <div>
              <b>{step.title}</b>
              <span>{step.text}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="hlp-aside__foot">
        Plans from $62/month with 1 admin and 2 recruiters included.{' '}
        {onContact && (
          <a href="/contact" onClick={(e) => { e.preventDefault(); onContact() }}>Contact us</a>
        )}
      </p>
    </>
  )
}

export default function HybentRegisterPortal({
  onSubmit,
  onSignIn,
  onContact,
  onBackToSite,
  initialIntent = 'demo',
  plan = null,
}: HybentRegisterPortalProps) {
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const orgRef = useRef<HTMLInputElement>(null)
  const sizeRef = useRef<HTMLSelectElement>(null)

  const [intent, setIntent] = useState<AccessIntent>(initialIntent)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [touched, setTouched] = useState({ fullName: false, email: false, organization: false, teamSize: false })
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState(false)

  const product = useAuthProduct()

  const nameError = fullName.trim().length < 2 ? 'Enter your full name.' : ''
  const emailError = !email.trim()
    ? 'Enter your work email.'
    : !EMAIL_RE.test(email.trim())
      ? 'Enter a valid email address.'
      : ''
  const orgError = organization.trim().length < 2 ? 'Enter your company name.' : ''
  const sizeError = !teamSize ? 'Select your team size.' : ''

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    setTouched({ fullName: true, email: true, organization: true, teamSize: true })
    if (nameError) return nameRef.current?.focus()
    if (emailError) return emailRef.current?.focus()
    if (orgError) return orgRef.current?.focus()
    if (sizeError) return sizeRef.current?.focus()
    setLoading(true)
    try {
      await onSubmit?.({
        intent,
        fullName: fullName.trim(),
        email: email.trim(),
        organization: organization.trim(),
        teamSize,
      })
      setDone(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'We could not submit your request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const aside = <WhatHappensNext onContact={onContact} />

  if (done) {
    return (
      <HybentAuthShell title="Request received" subtitle="Thanks for your interest in Hybent" wide aside={aside}>
        <div className="hlp-done">
          <span className="hlp-done__badge"><SuccessIcon /></span>
          <p>
            Thanks, <strong>{fullName.trim().split(' ')[0]}</strong>. Our team will reach out to{' '}
            <strong>{email.trim()}</strong> within one business day to{' '}
            {intent === 'demo' ? 'schedule your demo' : 'set up access'} for{' '}
            <strong>{organization.trim()}</strong>.
          </p>
          <button type="button" className="hlp-submit" onClick={onBackToSite}>
            <span className="hlp-submit__sweep" aria-hidden="true" />
            <span>Back to Hybent</span>
            <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
          </button>
          <p className="hlp-foot">
            Already have an account?{' '}
            <button type="button" className="hlp-underline" onClick={onSignIn}>Sign in</button>
          </p>
        </div>
      </HybentAuthShell>
    )
  }

  const showName = touched.fullName && Boolean(nameError)
  const showEmail = touched.email && Boolean(emailError)
  const showOrg = touched.organization && Boolean(orgError)
  const showSize = touched.teamSize && Boolean(sizeError)

  return (
    <HybentAuthShell
      eyebrow={product.label}
      title={intent === 'demo' ? 'Book a demo' : 'Request access'}
      subtitle="Hybent accounts are set up by our team"
      wide
      aside={aside}
    >
      <div className="hlp-seg" role="group" aria-label="What are you looking for?">
        <button type="button" aria-pressed={intent === 'demo'} onClick={() => setIntent('demo')} disabled={loading}>
          Book a demo
        </button>
        <button type="button" aria-pressed={intent === 'access'} onClick={() => setIntent('access')} disabled={loading}>
          Request access
        </button>
      </div>

      {plan && (
        <p className="hlp-plan">
          <span>Selected plan: <b>{plan.label}</b></span>
          <span>{plan.price}</span>
        </p>
      )}

      {formError && (
        <p className="hlp-alert" role="alert">
          <span className="hlp-alert__icon"><AlertIcon /></span>
          {formError}
        </p>
      )}

      <form className="hlp-form" onSubmit={handleSubmit} noValidate>
        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hrp-name">Full name</label>
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
              disabled={loading}
              aria-invalid={showName}
              aria-describedby={showName ? 'hrp-name-err' : undefined}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
            />
          </div>
          {showName && <p className="hlp-err" id="hrp-name-err" role="alert">{nameError}</p>}
        </div>

        <div className="hlp-field">
          <label className="hlp-label" htmlFor="hrp-email">Work email</label>
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
              disabled={loading}
              aria-invalid={showEmail}
              aria-describedby={showEmail ? 'hrp-email-err' : undefined}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            />
          </div>
          {showEmail && <p className="hlp-err" id="hrp-email-err" role="alert">{emailError}</p>}
        </div>

        <div className="hlp-row2">
          <div className="hlp-field">
            <label className="hlp-label" htmlFor="hrp-org">Company</label>
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
                disabled={loading}
                aria-invalid={showOrg}
                aria-describedby={showOrg ? 'hrp-org-err' : undefined}
                onChange={(e) => setOrganization(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, organization: true }))}
              />
            </div>
            {showOrg && <p className="hlp-err" id="hrp-org-err" role="alert">{orgError}</p>}
          </div>

          <div className="hlp-field">
            <label className="hlp-label" htmlFor="hrp-size">Team size</label>
            <div className={`hlp-input${showSize ? ' is-invalid' : ''}`}>
              <span className="hlp-input__icon"><UsersIcon /></span>
              <select
                id="hrp-size"
                ref={sizeRef}
                name="team_size"
                required
                value={teamSize}
                disabled={loading}
                aria-invalid={showSize}
                aria-describedby={showSize ? 'hrp-size-err' : undefined}
                onChange={(e) => setTeamSize(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, teamSize: true }))}
              >
                <option value="" disabled>Select</option>
                {TEAM_SIZES.map((size) => (
                  <option key={size} value={size}>{size} employees</option>
                ))}
              </select>
              <ChevronDown />
            </div>
            {showSize && <p className="hlp-err" id="hrp-size-err" role="alert">{sizeError}</p>}
          </div>
        </div>

        <button className="hlp-submit" type="submit" disabled={loading}>
          <span className="hlp-submit__sweep" aria-hidden="true" />
          {loading ? (
            <>
              <span className="hlp-spinner" aria-hidden="true" />
              <span>Sending your request…</span>
            </>
          ) : (
            <>
              <span>{intent === 'demo' ? 'Book my demo' : 'Request access'}</span>
              <span className="hlp-submit__arrow" aria-hidden="true"><ArrowIcon /></span>
            </>
          )}
        </button>
      </form>

      <p className="hlp-legal">We&rsquo;ll only use these details to respond to your request.</p>

      <p className="hlp-foot">
        Already have an account?{' '}
        <button type="button" className="hlp-underline" onClick={onSignIn} disabled={loading}>
          Sign in
        </button>
      </p>
    </HybentAuthShell>
  )
}
