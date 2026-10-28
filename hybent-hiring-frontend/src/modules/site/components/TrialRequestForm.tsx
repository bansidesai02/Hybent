import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import PhoneInput, { getCountries, isValidPhoneNumber, type Country } from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import 'react-phone-number-input/style.css'

import { trialApi, type TrialPlan, type TrialRequestPayload } from '@/api/trial'
import { CountryPicker } from './CountryPicker'

/**
 * The 7-day free trial request (hybent.com/free-trial). Nothing is granted
 * here: the work email is verified with a code, the Hybent team checks the
 * company, and approving it emails the organization setup link.
 *
 * Mirrors the server's checks so most mistakes are caught before sending —
 * a business email (no Gmail, Yahoo, Outlook…), the company's LinkedIn page
 * and the person's LinkedIn profile. The server repeats every check, rejects
 * a domain that already had a trial, and names the field it objects to.
 */

type Values = {
  company_name: string
  company_website: string
  company_linkedin_url: string
  contact_name: string
  contact_title: string
  contact_email: string
  contact_phone: string
  contact_linkedin_url: string
  homepage: string
}
type FieldName = Exclude<keyof Values, 'homepage'> | 'accept_terms' | 'otp'
type Errors = Partial<Record<FieldName, string>>

// Same values as app/schemas/trial.py.

// Personal inboxes can't start a trial (the server's list is longer).
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk', 'ymail.com', 'hotmail.com',
  'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  'gmx.com', 'mail.com', 'zoho.com', 'yandex.com', 'rediffmail.com', 'qq.com',
])

const COMPANY_LINKEDIN = /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/(company|school|showcase)\/[^/?#\s]+/i
const PERSONAL_LINKEDIN = /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#\s]+/i
const WEBSITE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i

const EMPTY: Values = {
  company_name: '', company_website: '', company_linkedin_url: '', contact_name: '', contact_title: '', contact_email: '', contact_phone: '',
  contact_linkedin_url: '', homepage: '',
}

function guessCountry(): Country {
  const region = navigator.language.split('-')[1]?.toUpperCase()
  return region && new Set<string>(getCountries()).has(region) ? (region as Country) : 'US'
}

function validate(v: Values, accepted: boolean): Errors {
  const e: Errors = {}
  const email = v.contact_email.trim().toLowerCase()
  if (v.company_name.trim().length < 2) e.company_name = 'Enter your company name.'
  if (!WEBSITE.test(v.company_website.trim())) e.company_website = 'Enter your company website, e.g. acme.com'
  if (!COMPANY_LINKEDIN.test(v.company_linkedin_url.trim()))
    e.company_linkedin_url = 'Enter your company’s LinkedIn page, e.g. linkedin.com/company/acme'
  if (v.contact_name.trim().length < 2) e.contact_name = 'Enter your full name.'
  if (v.contact_title.trim().length < 2) e.contact_title = 'Enter your job title.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.contact_email = 'Enter a valid work email.'
  else if (PERSONAL_DOMAINS.has(email.split('@')[1])) e.contact_email = 'Please use your work email, not a personal one.'
  if (!v.contact_phone) e.contact_phone = 'Enter your phone number.'
  else if (!isValidPhoneNumber(v.contact_phone)) e.contact_phone = 'That phone number isn’t valid for the selected country.'
  if (!PERSONAL_LINKEDIN.test(v.contact_linkedin_url.trim()))
    e.contact_linkedin_url = 'Enter your LinkedIn profile, e.g. linkedin.com/in/your-name'
  if (!accepted) e.accept_terms = 'Please accept the trial terms.'
  return e
}

// Fields in the order they appear, so focus lands on the first problem.
const ORDER: FieldName[] = [
  'contact_name', 'contact_title', 'contact_phone', 'contact_linkedin_url',
  'company_name', 'company_website', 'company_linkedin_url',
  'contact_email', 'otp', 'accept_terms',
]

const PLAN_NAMES: Record<TrialPlan, string> = { standard: 'Standard', pro: 'Pro' }

export function TrialRequestForm() {
  const [params] = useSearchParams()
  // The plan comes from the pricing card the visitor clicked.
  const plan: TrialPlan = params.get('plan') === 'standard' ? 'standard' : 'pro'
  const planName = PLAN_NAMES[plan]
  const [values, setValues] = useState<Values>(EMPTY)
  const [accepted, setAccepted] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [serverMessage, setServerMessage] = useState('')
  const defaultCountry = useMemo(guessCountry, [])
  const shownAt = useRef(Date.now())
  // Work email verification: a code is emailed, entered here, and the
  // server's token is sent with the request.
  const [otpStage, setOtpStage] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'verified'>('idle')
  const [code, setCode] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [showThanks, setShowThanks] = useState(true)

  useEffect(() => {
    if (status !== 'sent' || !showThanks) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowThanks(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, showThanks])

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  const update = (name: keyof Values, value: string) => {
    if (name === 'contact_email' && otpStage !== 'idle') {
      // A different address needs its own code.
      setOtpStage('idle')
      setCode('')
      setVerificationToken('')
    }
    setValues((v) => ({ ...v, [name]: value }))
    if (name in errors) setErrors((prev) => ({ ...prev, [name]: undefined }))
    if (status === 'error') setStatus('idle')
  }
  const focusField = (field: FieldName) =>
    requestAnimationFrame(() => document.getElementById(`tf-${field}`)?.focus())

  const serverError = (err: any): { field?: FieldName; message: string } => {
    const data = err?.response?.data
    const field = (data?.details?.field ?? data?.details?.errors?.[0]?.loc?.[1]) as FieldName | undefined
    const message = data?.details?.errors?.[0]?.msg
      ? String(data.details.errors[0].msg).replace(/^Value error, /, '')
      : data?.message || 'Something went wrong. Please try again.'
    return { field, message }
  }

  const sendCode = async () => {
    const email = values.contact_email.trim().toLowerCase()
    const emailError = validate({ ...values, contact_email: email }, true).contact_email
    if (emailError) {
      setErrors((prev) => ({ ...prev, contact_email: emailError }))
      focusField('contact_email')
      return
    }
    try {
      setOtpStage('sending')
      await trialApi.sendCode(email)
      setOtpStage('sent')
      setCode('')
      setResendIn(60)
      setErrors((prev) => ({ ...prev, contact_email: undefined, otp: undefined }))
      focusField('otp')
    } catch (err) {
      const { message } = serverError(err)
      setErrors((prev) => ({ ...prev, contact_email: message }))
      setOtpStage((stage) => (stage === 'sending' ? 'idle' : stage))
    }
  }

  const verifyCode = async (entered = code) => {
    if (entered.length !== 6) return
    try {
      setOtpStage('verifying')
      const { verification_token } = await trialApi.verifyCode(values.contact_email.trim().toLowerCase(), entered)
      setVerificationToken(verification_token)
      setOtpStage('verified')
      setErrors((prev) => ({ ...prev, otp: undefined, contact_email: undefined }))
    } catch (err) {
      setOtpStage('sent')
      setErrors((prev) => ({ ...prev, otp: serverError(err).message }))
      focusField('otp')
    }
  }

  /** Shows every problem and focuses the first; true when the form can be sent. */
  const checkAll = (): boolean => {
    const found = validate(values, accepted)
    if (!found.contact_email && otpStage !== 'verified') {
      found.otp = otpStage === 'idle' ? 'Verify your work email: send the code and enter it.' : 'Enter the 6-digit code we emailed you.'
    }
    setErrors(found)
    const first = ORDER.find((f) => found[f])
    if (first) focusField(first)
    return !first
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkAll()) return
    const payload: TrialRequestPayload = {
      ...(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])) as Values),
      contact_email: values.contact_email.trim().toLowerCase(),
      homepage: values.homepage || undefined,
      accept_terms: true,
      plan,
      email_verification_token: verificationToken,
      elapsed_ms: Date.now() - shownAt.current,
    }
    try {
      setStatus('sending')
      await trialApi.request(payload)
      setStatus('sent')
    } catch (err: any) {
      // A check the server makes (a domain that already had a trial, say),
      // or a validation error on one field: show it there.
      const { field, message } = serverError(err)
      if (field && ORDER.includes(field)) {
        if (field === 'contact_email') {
          setOtpStage('idle')
          setVerificationToken('')
        }
        setErrors({ [field]: message })
        focusField(field)
        setStatus('idle')
        return
      }
      setServerMessage(message || 'We couldn’t send your request. Please try again, or email info@hybent.com.')
      setStatus('error')
    }
  }

  const planBadge = (
    <div className="trial-plan-badge">
      <div className="trial-plan-badge__head">
        <span className="trial-plan-badge__name">{planName} plan</span>
        <span className="trial-plan-badge__tag">7-day free trial</span>
      </div>
    </div>
  )

  if (status === 'sent') {
    const email = values.contact_email.trim().toLowerCase()
    return (
      <>
        <div className="trial-step trial-done">
          <div className="trial-done__icon" aria-hidden="true"><svg><use href="#i-check" /></svg></div>
          <h2 className="h-md" style={{ marginTop: '18px' }}>Request submitted</h2>
          <p className="lead" style={{ marginTop: '12px' }}>
            We’ll email your organization setup link to <b>{email}</b> within one business day.
          </p>
        </div>
        {showThanks && createPortal(
          // Portalled to <body>: the form sits inside an animated (transformed)
          // card, which would trap a position: fixed overlay inside it.
          <div className="hb-site">
            <div className="trial-modal" role="dialog" aria-modal="true" aria-labelledby="trial-thanks-title" onClick={() => setShowThanks(false)}>
              <div className="trial-modal__card" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="trial-modal__close" aria-label="Close" onClick={() => setShowThanks(false)}>×</button>
                <div className="trial-done__icon trial-done__icon--pulse" aria-hidden="true"><svg><use href="#i-check" /></svg></div>
                <span className="trial-modal__chip">{planName} plan · 7-day free trial</span>
                <h2 id="trial-thanks-title" className="trial-modal__title">Thank you, your request is in!</h2>
                <p className="trial-modal__lead">
                  We’ve received your request and our team is on it. Here’s what happens next:
                </p>
                <ol className="trial-next">
                  <li><span>1</span><div><b>We review your company</b><p>Usually within one business day.</p></div></li>
                  <li><span>2</span><div><b>You get your setup link</b><p>Sent to <b>{email}</b> from info@hybent.com.</p></div></li>
                  <li><span>3</span><div><b>Set up and start hiring</b><p>Add your logo and team. Your 7 days start on approval.</p></div></li>
                </ol>
                <button type="button" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '24px' }} onClick={() => setShowThanks(false)} autoFocus>
                  Got it
                </button>
                <p className="trial-modal__foot">
                  Can’t find our email? Check your spam folder or write to <a href="mailto:info@hybent.com">info@hybent.com</a>.
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )}
      </>
    )
  }

  const label = (id: string, text: string, required = true) => (
    <label htmlFor={id}>
      {text}
      {required && <span className="field__req" aria-hidden="true"> *</span>}
    </label>
  )
  const errorFor = (name: FieldName) =>
    errors[name] && <p className="field__err" id={`tf-${name}-err`}>{errors[name]}</p>

  const input = (
    name: Exclude<FieldName, 'accept_terms' | 'otp'>,
    text: string,
    opts: { type?: string; placeholder: string; autoComplete?: string; required?: boolean }
  ) => {
    const id = `tf-${name}`
    const error = errors[name]
    const required = opts.required ?? true
    return (
      <div className="field">
        {label(id, text, required)}
        <input
          id={id}
          name={name}
          type={opts.type ?? 'text'}
          placeholder={opts.placeholder}
          autoComplete={opts.autoComplete}
          required={required}
          aria-required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          value={values[name]}
          onChange={(e) => update(name, e.target.value)}
        />
        {errorFor(name)}
      </div>
    )
  }

  return (
    <form id="free-trial-form" onSubmit={onSubmit} noValidate aria-busy={status === 'sending'}>
      {planBadge}

      <p className="trial-section">About you</p>
      <div>
          <div className="grid g2" style={{ gap: '16px' }}>
            {input('contact_name', 'Full name', { placeholder: 'Ananya Shah', autoComplete: 'name' })}
            {input('contact_title', 'Job title', { placeholder: 'Head of Talent', autoComplete: 'organization-title' })}
          </div>
          <div className="field" style={{ marginTop: '16px' }}>
            {label('tf-contact_phone', 'Phone number')}
            <PhoneInput
              id="tf-contact_phone"
              name="contact_phone"
              flags={flags}
              defaultCountry={defaultCountry}
              countrySelectComponent={CountryPicker}
              placeholder="Phone number"
              autoComplete="tel"
              required
              aria-required
              aria-invalid={errors.contact_phone ? true : undefined}
              aria-describedby={errors.contact_phone ? 'tf-contact_phone-err' : undefined}
              value={values.contact_phone || undefined}
              onChange={(v) => update('contact_phone', v ?? '')}
            />
            {errorFor('contact_phone')}
          </div>
          <div style={{ marginTop: '16px' }}>
            {input('contact_linkedin_url', 'Your LinkedIn profile', { type: 'url', placeholder: 'https://www.linkedin.com/in/your-name' })}
          </div>

      </div>

      <p className="trial-section">About your company</p>
      <div>
          <div className="grid g2" style={{ gap: '16px' }}>
            {input('company_name', 'Company name', { placeholder: 'Acme Inc.', autoComplete: 'organization' })}
            {input('company_website', 'Company website', { type: 'url', placeholder: 'https://acme.com', autoComplete: 'url' })}
          </div>
          <div style={{ marginTop: '16px' }}>
            {input('company_linkedin_url', 'Company LinkedIn page', { type: 'url', placeholder: 'https://www.linkedin.com/company/acme' })}
          </div>

          <div className="trial-verify">
            <div className="field">
              {label('tf-contact_email', 'Work email')}
              <div className="trial-verify__row">
                <input
                  id="tf-contact_email"
                  name="contact_email"
                  type="email"
                  placeholder="ananya@company.com"
                  autoComplete="email"
                  required
                  aria-required
                  aria-invalid={errors.contact_email ? true : undefined}
                  aria-describedby={errors.contact_email ? 'tf-contact_email-err' : undefined}
                  value={values.contact_email}
                  readOnly={otpStage === 'verified'}
                  onChange={(e) => update('contact_email', e.target.value)}
                />
                {otpStage === 'verified' ? (
                  <span className="trial-verify__ok"><svg aria-hidden="true"><use href="#i-check" /></svg>Verified</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost trial-verify__btn"
                    onClick={sendCode}
                    disabled={otpStage === 'sending' || resendIn > 0}
                  >
                    {otpStage === 'sending' ? 'Sending…' : otpStage === 'idle' ? 'Send code' : resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </button>
                )}
              </div>
              {errorFor('contact_email')}
            </div>

            {(otpStage === 'sent' || otpStage === 'verifying') && (
              <div className="field trial-verify__code">
                {label('tf-otp', 'Verification code')}
                <input
                  id="tf-otp"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  aria-invalid={errors.otp ? true : undefined}
                  aria-describedby={errors.otp ? 'tf-otp-err' : 'tf-otp-hint'}
                  value={code}
                  disabled={otpStage === 'verifying'}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(next)
                    setErrors((prev) => ({ ...prev, otp: undefined }))
                    if (next.length === 6) void verifyCode(next)
                  }}
                />
                {errors.otp ? errorFor('otp') : (
                  <p className="form-note" id="tf-otp-hint">
                    {otpStage === 'verifying' ? 'Checking…' : `We sent a 6-digit code to ${values.contact_email.trim().toLowerCase()}. It expires in 10 minutes.`}
                  </p>
                )}
              </div>
            )}
            {otpStage === 'idle' && errors.otp && errorFor('otp')}
          </div>

          {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}>
            <label htmlFor="tf-homepage">Homepage</label>
            <input id="tf-homepage" name="homepage" type="text" tabIndex={-1} autoComplete="off" value={values.homepage} onChange={(e) => update('homepage', e.target.value)} />
          </div>

          <div className="field" style={{ marginTop: '20px' }}>
            <label htmlFor="tf-accept_terms" className="trial-terms">
              <input
                id="tf-accept_terms"
                type="checkbox"
                checked={accepted}
                aria-invalid={errors.accept_terms ? true : undefined}
                aria-describedby={errors.accept_terms ? 'tf-accept_terms-err' : undefined}
                onChange={(e) => {
                  setAccepted(e.target.checked)
                  setErrors((prev) => ({ ...prev, accept_terms: undefined }))
                }}
              />
              <span>
                I agree to the trial terms: one trial per company, 7 days from approval. Afterwards my team’s access pauses
                until we choose a plan, and the trial workspace and its data are deleted 30 days after the trial ends
                unless we upgrade. I agree to the <a href="/privacy">privacy policy</a>.
              </span>
            </label>
            {errorFor('accept_terms')}
          </div>

          <div className="trial-actions trial-actions--single">
            <button className="btn btn-primary btn-lg" type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : `Get ${planName} trial`}{' '}
              <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg>
            </button>
          </div>
          <p className={`toast${status === 'error' ? ' on toast--error' : ''}`} role="status" aria-live="polite">
            {status === 'error' ? serverMessage : ''}
          </p>
      </div>

      <p className="form-note" style={{ marginTop: '16px' }}>
        No card required. Use your work email: personal addresses (Gmail, Yahoo, Outlook and similar) can’t start a trial.
      </p>
    </form>
  )
}
