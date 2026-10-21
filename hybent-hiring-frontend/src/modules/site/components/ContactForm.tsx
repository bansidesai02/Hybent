import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PhoneInput, { getCountries, isValidPhoneNumber, type Country } from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import 'react-phone-number-input/style.css'

import { contactApi, type ContactMessage, type ContactTopic } from '@/api/contact'
import { readAttribution } from '../attribution'
import { CountryPicker } from './CountryPicker'
import { SiteSelect, type SiteSelectOption } from './SiteSelect'

/**
 * The contact form. Sends the message to the Hybent team (info@hybent.com)
 * and only says "thanks" once the server has accepted it.
 *
 * The first question is what the visitor came for — Hybent Hiring or IT
 * Services — and it becomes the [tag] on the email, so the one inbox can tell
 * the leads apart. Hybent Hiring also asks how big the company is and how
 * many people it hires — the sizing a sales call needs; IT Services doesn't. Buttons elsewhere on
 * the site answer it in advance (`/contact?topic=hiring`, `?service=…`,
 * `?industry=…`, `?role=…`); the visitor can still change it. The service,
 * industry or role named by the link isn't asked again — it rides along to
 * the email as context.
 *
 * Every field shown is required. The server rejects throwaway inboxes, domains that can't
 * receive mail and impossible phone numbers, and names the field it objects to.
 */

type Values = {
  topic: ContactTopic | ''
  name: string
  email: string
  message: string
  phone: string
  company: string
  location: string
  referrer: string
  team_size: string
  hires_per_year: string
  website: string
}
type FieldName = Exclude<keyof Values, 'website'>
type Errors = Partial<Record<FieldName, string>>

const TOPICS: Array<SiteSelectOption<ContactTopic>> = [
  { value: 'hiring', label: 'Hybent Hiring', hint: 'Our AI recruitment platform: a demo, pricing or access' },
  { value: 'services', label: 'IT Services', hint: 'Custom software, AI, cloud, data, consulting or hiring engineers' },
]
const isTopic = (v: string | null): v is ContactTopic => TOPICS.some((t) => t.value === v)

// Same bands as the /register access request.
const TEAM_SIZES = ['1–10', '11–50', '51–200', '201–1,000', '1,000+'].map((v) => ({ value: v, label: `${v} employees` }))
const HIRES_PER_YEAR = ['Under 10', '10–50', '50–200', '200–1,000', '1,000+'].map((v) => ({ value: v, label: `${v} people` }))

// What the link that opened the form was about, e.g. the service page's
// "Get started" button. Sent with the message, never asked.
type LinkContext = Pick<ContactMessage, 'service' | 'industry' | 'role'>
function linkContext(params: URLSearchParams): LinkContext {
  const role = params.get('role') || undefined
  return {
    // Hire Talent's roles are this service.
    service: params.get('service') || (role ? 'IT Staff Augmentation Services' : undefined),
    industry: params.get('industry') || undefined,
    role,
  }
}

const MESSAGE_PLACEHOLDER: Record<ContactTopic | '', string> = {
  '': 'Tell us what you are trying to fix…',
  hiring: 'We hire around 200 people a year and lose two weeks of every search in screening…',
  services: 'We need to rebuild our customer portal and move it to the cloud by Q3…',
}

const MIN_MESSAGE = 10

/* Best guess at the visitor's country for the phone field, so most people
   never touch the dial code. The time zone says where the device is; the
   language tag (en-US is the default almost everywhere) only breaks ties. */
const ZONE_COUNTRY: Record<string, Country> = {
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dubai': 'AE', 'Asia/Singapore': 'SG',
  'Europe/Berlin': 'DE', 'Europe/London': 'GB', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA',
}
function guessCountry(): Country {
  const supported = new Set<string>(getCountries())
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (ZONE_COUNTRY[zone]) return ZONE_COUNTRY[zone]
    if (zone.startsWith('Australia/')) return 'AU'
  } catch {
    /* No Intl time zone: fall through to the language. */
  }
  const region = navigator.language.split('-')[1]?.toUpperCase()
  return region && supported.has(region) ? (region as Country) : 'US'
}

/** The form's starting answers, with the topic the link that opened it implies. */
function initialValues(params: URLSearchParams): Values {
  const asked = params.get('topic')
  const context = linkContext(params)
  const topic: Values['topic'] = isTopic(asked) ? asked : context.service || context.industry ? 'services' : ''
  return {
    topic, name: '', email: '', message: '', phone: '', company: '', location: '', referrer: '',
    team_size: '', hires_per_year: '', website: '',
  }
}

// Asked only of Hybent Hiring leads: sizing for the recruitment product,
// meaningless for an IT Services project.
const HIRING_ONLY: FieldName[] = ['team_size', 'hires_per_year']
const asks = (topic: Values['topic'], field: FieldName) => topic === 'hiring' || !HIRING_ONLY.includes(field)

function validate(v: Values): Errors {
  const errors: Errors = {}
  const hiring = v.topic === 'hiring'
  if (!v.topic) errors.topic = 'Choose what you need help with.'
  if (!v.name.trim()) errors.name = 'Enter your name.'
  if (!v.email.trim()) errors.email = 'Enter your work email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) errors.email = 'Enter a valid email address.'
  if (!v.phone) errors.phone = 'Enter your phone number.'
  else if (!isValidPhoneNumber(v.phone)) errors.phone = 'That phone number isn’t valid for the selected country.'
  if (!v.company.trim()) errors.company = 'Enter your company name.'
  if (!v.location.trim()) errors.location = 'Enter your city or region.'
  if (hiring && !v.team_size) errors.team_size = 'Choose your company size.'
  if (hiring && !v.hires_per_year) errors.hires_per_year = 'Choose how many people you hire per year.'
  if (!v.referrer.trim()) errors.referrer = 'Tell us how you found us.'
  if (!v.message.trim()) errors.message = 'Tell us what you are trying to fix.'
  else if (v.message.trim().length < MIN_MESSAGE) errors.message = `Add a little more detail (at least ${MIN_MESSAGE} characters).`
  return errors
}

// Fields in the order they appear, so focus lands on the first problem.
const ORDER: FieldName[] = ['topic', 'name', 'email', 'phone', 'company', 'location', 'team_size', 'hires_per_year', 'referrer', 'message']

export function ContactForm() {
  const [params] = useSearchParams()
  const [values, setValues] = useState(() => initialValues(params))
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [serverMessage, setServerMessage] = useState('')
  const defaultCountry = useMemo(guessCountry, [])
  const shownAt = useRef(Date.now())

  // A second CTA clicked while already on /contact changes only the query.
  useEffect(() => {
    const topic = initialValues(params).topic
    if (topic) setValues((v) => ({ ...v, topic }))
  }, [params])

  const update = (name: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [name]: value }))
    if (name in errors) setErrors((prev) => ({ ...prev, [name]: undefined }))
    if (status === 'sent' || status === 'error') setStatus('idle')
  }
  const set = (name: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    update(name, e.target.value)

  const focusField = (field: FieldName) => document.getElementById(`cf-${field}`)?.focus()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    const first = ORDER.find((f) => found[f])
    if (first) {
      focusField(first)
      return
    }
    const topic = values.topic as ContactTopic
    const answers = Object.fromEntries(
      Object.entries(values)
        .map(([k, v]) => [k, v.trim()])
        // Nothing from a field the chosen topic doesn't show.
        .filter(([k, v]) => k !== 'topic' && v !== '' && (k === 'website' || asks(topic, k as FieldName)))
    )
    try {
      setStatus('sending')
      await contactApi.send({
        ...readAttribution(),
        ...linkContext(params),
        ...answers,
        topic,
        elapsed_ms: Date.now() - shownAt.current,
      } as ContactMessage)
      setValues({ ...initialValues(params), topic })
      shownAt.current = Date.now()
      setStatus('sent')
    } catch (err: any) {
      const data = err?.response?.data
      const field = data?.details?.field as FieldName | undefined
      if (field && ORDER.includes(field)) {
        // The server objected to one answer (a throwaway inbox, say): show it there.
        setErrors({ [field]: data.message })
        focusField(field)
        setStatus('idle')
        return
      }
      setServerMessage(data?.message || 'We couldn’t send your message. Please try again, or email info@hybent.com.')
      setStatus('error')
    }
  }

  const label = (id: string, text: string) => (
    <label htmlFor={id}>
      {text}
      <span className="field__req" aria-hidden="true"> *</span>
    </label>
  )

  const errorFor = (name: FieldName) =>
    errors[name] && (
      <p className="field__err" id={`cf-${name}-err`}>
        {errors[name]}
      </p>
    )

  const input = (
    name: FieldName,
    text: string,
    opts: { type?: string; placeholder: string; autoComplete?: string }
  ) => {
    const id = `cf-${name}`
    const error = errors[name]
    return (
      <div className="field">
        {label(id, text)}
        <input
          id={id}
          name={name}
          type={opts.type ?? 'text'}
          placeholder={opts.placeholder}
          autoComplete={opts.autoComplete}
          required
          aria-required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          value={values[name]}
          onChange={set(name)}
        />
        {errorFor(name)}
      </div>
    )
  }

  const select = (name: 'topic' | 'team_size' | 'hires_per_year', text: string, options: Array<SiteSelectOption<string>>) => {
    const id = `cf-${name}`
    return (
      <div className="field">
        {label(id, text)}
        <SiteSelect
          id={id}
          value={values[name]}
          options={options}
          onChange={(v) => update(name, v)}
          required
          invalid={!!errors[name]}
          describedBy={errors[name] ? `${id}-err` : undefined}
        />
        {errorFor(name)}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={status === 'sending'}>
      <p className="form-note" style={{ marginBottom: '16px' }}>
        All fields are required.
      </p>

      {select('topic', 'What can we help with?', TOPICS)}

      <div className="grid g2" style={{ gap: '16px', marginTop: '16px' }}>
        {input('name', 'Full name', { placeholder: 'Ananya Shah', autoComplete: 'name' })}
        {input('email', 'Work email', { type: 'email', placeholder: 'ananya@company.com', autoComplete: 'email' })}
      </div>
      <div className="field" style={{ marginTop: '16px' }}>
        {label('cf-phone', 'Phone number')}
        <PhoneInput
          id="cf-phone"
          name="phone"
          flags={flags}
          defaultCountry={defaultCountry}
          countrySelectComponent={CountryPicker}
          placeholder="Phone number"
          autoComplete="tel"
          required
          aria-required
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? 'cf-phone-err' : undefined}
          value={values.phone || undefined}
          onChange={(v) => update('phone', v ?? '')}
        />
        {errorFor('phone')}
      </div>

      <div className="grid g2" style={{ gap: '16px', marginTop: '16px' }}>
        {input('company', 'Company', { placeholder: 'Company name', autoComplete: 'organization' })}
        {input('location', 'Location', { placeholder: 'e.g. San Francisco, CA', autoComplete: 'address-level2' })}
      </div>
      {values.topic === 'hiring' && (
        <div className="grid g2" style={{ gap: '16px', marginTop: '16px' }}>
          {select('team_size', 'Company size', TEAM_SIZES)}
          {select('hires_per_year', 'People you hire per year', HIRES_PER_YEAR)}
        </div>
      )}
      <div style={{ marginTop: '16px' }}>
        {input('referrer', 'How did you hear about us?', { placeholder: 'Google, LinkedIn, a colleague…' })}
      </div>
      <div className="field" style={{ marginTop: '16px' }}>
        {label('cf-message', 'Message')}
        <textarea
          id="cf-message"
          name="message"
          required
          aria-required
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? 'cf-message-err' : undefined}
          placeholder={MESSAGE_PLACEHOLDER[values.topic]}
          maxLength={5000}
          value={values.message}
          onChange={set('message')}
        />
        {errorFor('message')}
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
