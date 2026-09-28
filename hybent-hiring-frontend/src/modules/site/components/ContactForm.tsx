import { useState } from 'react'

import { contactApi, type ContactMessage } from '@/api/contact'

/**
 * The contact form. Sends the message to the Hybent team (info@hybent.com)
 * and only says "thanks" once the server has accepted it. Name, email and
 * message are required (marked *); every other field is labelled optional.
 */

type FieldName = keyof Omit<ContactMessage, 'website'>
type Errors = Partial<Record<FieldName, string>>

const EMPTY: Required<ContactMessage> = {
  name: '',
  email: '',
  message: '',
  phone: '',
  company: '',
  country: '',
  location: '',
  referrer: '',
  website: '',
}

const MIN_MESSAGE = 10

function validate(v: ContactMessage): Errors {
  const errors: Errors = {}
  if (!v.name.trim()) errors.name = 'Enter your name.'
  if (!v.email.trim()) errors.email = 'Enter your work email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) errors.email = 'Enter a valid email address.'
  if (!v.message.trim()) errors.message = 'Tell us what you are trying to fix.'
  else if (v.message.trim().length < MIN_MESSAGE) errors.message = `Add a little more detail (at least ${MIN_MESSAGE} characters).`
  return errors
}

// Required fields first in the order they appear, so focus lands on the first problem.
const ORDER: FieldName[] = ['name', 'email', 'message']

export function ContactForm() {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [serverMessage, setServerMessage] = useState('')

  const set = (name: keyof ContactMessage) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value
    setValues((v) => ({ ...v, [name]: value }))
    if (name in errors) setErrors((prev) => ({ ...prev, [name]: undefined }))
    if (status === 'sent' || status === 'error') setStatus('idle')
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    const first = ORDER.find((f) => found[f])
    if (first) {
      document.getElementById(`cf-${first}`)?.focus()
      return
    }
    try {
      setStatus('sending')
      const payload = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== '')
      ) as unknown as ContactMessage
      await contactApi.send(payload)
      setValues(EMPTY)
      setStatus('sent')
    } catch (err: any) {
      setServerMessage(
        err?.response?.data?.message || 'We couldn’t send your message. Please try again, or email info@hybent.com.'
      )
      setStatus('error')
    }
  }

  const label = (id: string, text: string, required: boolean) => (
    <label htmlFor={id}>
      {text}
      {required ? (
        <span className="field__req" aria-hidden="true"> *</span>
      ) : (
        <span className="field__opt"> · Optional</span>
      )}
    </label>
  )

  const input = (
    name: FieldName,
    text: string,
    opts: { type?: string; placeholder: string; required?: boolean; autoComplete?: string }
  ) => {
    const id = `cf-${name}`
    const error = errors[name]
    return (
      <div className="field">
        {label(id, text, !!opts.required)}
        <input
          id={id}
          name={name}
          type={opts.type ?? 'text'}
          placeholder={opts.placeholder}
          autoComplete={opts.autoComplete}
          required={opts.required}
          aria-required={opts.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          value={values[name]}
          onChange={set(name)}
        />
        {error && (
          <p className="field__err" id={`${id}-err`}>
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={status === 'sending'}>
      <p className="form-note" style={{ marginBottom: '16px' }}>
        Fields marked <span className="field__req">*</span> are required. Everything else is optional.
      </p>
      <div className="grid g2" style={{ gap: '16px' }}>
        {input('name', 'Full name', { placeholder: 'Ananya Shah', required: true, autoComplete: 'name' })}
        {input('email', 'Work email', { type: 'email', placeholder: 'ananya@company.com', required: true, autoComplete: 'email' })}
      </div>
      <div className="grid g2" style={{ gap: '16px', marginTop: '16px' }}>
        {input('phone', 'Phone number', { type: 'tel', placeholder: '+1 (555) 000-0000', autoComplete: 'tel' })}
        {input('company', 'Company', { placeholder: 'Company name', autoComplete: 'organization' })}
      </div>
      <div className="grid g2" style={{ gap: '16px', marginTop: '16px' }}>
        {input('country', 'Country', { placeholder: 'e.g. United States', autoComplete: 'country-name' })}
        {input('location', 'Location', { placeholder: 'e.g. San Francisco, CA', autoComplete: 'address-level2' })}
      </div>
      <div style={{ marginTop: '16px' }}>
        {input('referrer', 'How did you hear about us?', { placeholder: 'Google, LinkedIn, Word of mouth...' })}
      </div>
      <div className="field" style={{ marginTop: '16px' }}>
        {label('cf-message', 'Message', true)}
        <textarea
          id="cf-message"
          name="message"
          required
          aria-required
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? 'cf-message-err' : undefined}
          placeholder="We hire around 200 people a year and lose two weeks of every search in screening…"
          maxLength={5000}
          value={values.message}
          onChange={set('message')}
        />
        {errors.message && (
          <p className="field__err" id="cf-message-err">
            {errors.message}
          </p>
        )}
      </div>

      {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}>
        <label htmlFor="cf-website">Website</label>
        <input id="cf-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
      </div>

      <button
        className="btn btn-primary btn-lg"
        type="submit"
        disabled={status === 'sending'}
        style={{ width: '100%', marginTop: '22px' }}
      >
        {status === 'sending' ? 'Sending…' : 'Send message'}{' '}
        <svg className="arw" width="17" height="17" aria-hidden="true">
          <use href="#i-arrow" />
        </svg>
      </button>
      <p className={`toast${status === 'sent' || status === 'error' ? ' on' : ''}${status === 'error' ? ' toast--error' : ''}`} role="status" aria-live="polite">
        {status === 'sent'
          ? 'Thanks — we have your message and will reply within one business day.'
          : status === 'error'
            ? serverMessage
            : ''}
      </p>
      <p className="form-note" style={{ marginTop: '14px' }}>
        By sending this you agree to our privacy policy. We will never sell your details, and one email is all it takes
        to be removed from our systems.
      </p>
    </form>
  )
}
