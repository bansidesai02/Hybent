import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { trialApi, type TrialSetupInfo } from '@/api/trial'
import { useAuthStore } from '@/store/authStore'
import { SiteView } from '../components/SiteView'
import { SiteSelect, type SiteSelectOption } from '../components/SiteSelect'

/**
 * Organization setup for an approved free trial (/setup?token=…), linked
 * from the approval email. Three steps: the admin's account, the company
 * profile and logo, and email branding. Finishing signs the admin in.
 *
 * Emails the organization sends afterwards go out from Hybent's address
 * with its sender name, logo and colour, and "Powered by Hybent" below.
 */

const STEPS = ['Your account', 'Company', 'Branding']

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney', 'UTC',
]

const COLORS = ['#4C6FFF', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#A855F7', '#0B1220']

type Errors = Partial<Record<string, string>>

// Old names some browsers still report, and the current ones.
const ZONE_ALIASES: Record<string, string> = { 'Asia/Calcutta': 'Asia/Kolkata', 'Asia/Saigon': 'Asia/Ho_Chi_Minh', 'Asia/Katmandu': 'Asia/Kathmandu' }

function browserZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    return ZONE_ALIASES[zone] ?? zone
  } catch {
    return 'UTC'
  }
}

export default function TrialSetupPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)

  const [info, setInfo] = useState<TrialSetupInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    full_name: '', password: '', confirm: '', company_name: '', website: '', industry: '', size: '',
    timezone: browserZone(), logo_url: '', brand_color: '#4C6FFF', email_sender_name: '',
  })
  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  useEffect(() => {
    if (!token) {
      setLoadError('This setup link is missing its code. Open the link from your approval email.')
      return
    }
    trialApi
      .setupInfo(token)
      .then((data) => {
        setInfo(data)
        setForm((f) => ({
          ...f,
          full_name: data.full_name || '',
          company_name: data.company_name || '',
          website: data.website || '',
          industry: data.industry || '',
          size: data.size || '',
          logo_url: data.logo_url || '',
          email_sender_name: data.company_name ? `${data.company_name} Hiring Team` : '',
        }))
      })
      .catch((err) => setLoadError(err?.response?.data?.message || 'This setup link isn’t valid.'))
  }, [token])

  const zoneOptions: Array<SiteSelectOption<string>> = useMemo(() => {
    const zones = TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES]
    return zones.map((z) => ({ value: z, label: z.replace(/_/g, ' ').replace('/', ' / ') }))
  }, [form.timezone])

  const checkStep = (index: number): boolean => {
    const e: Errors = {}
    if (index === 0) {
      if (form.full_name.trim().length < 2) e.full_name = 'Enter your full name.'
      const weak = passwordProblem(form.password)
      if (weak) e.password = weak
      else if (form.password !== form.confirm) e.confirm = 'The passwords don’t match.'
    }
    if (index === 1) {
      if (form.company_name.trim().length < 2) e.company_name = 'Enter your company name.'
    }
    if (index === 2) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(form.brand_color)) e.brand_color = 'Use a colour like #4C6FFF.'
    }
    setErrors(e)
    const first = Object.keys(e)[0]
    if (first) requestAnimationFrame(() => document.getElementById(`ts-${first}`)?.focus())
    return !first
  }

  const next = () => {
    if (!checkStep(step)) return
    setStep((s) => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const uploadLogo = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    // Same checks as the server (logo_rules.py), so most mistakes show at once.
    const problem = await checkLogo(file)
    if (problem) {
      setErrors((e) => ({ ...e, logo_url: problem }))
      return
    }
    try {
      setUploading(true)
      const { logo_url } = await trialApi.uploadSetupLogo(token, file)
      set('logo_url', logo_url)
    } catch (err: any) {
      setErrors((e) => ({ ...e, logo_url: err?.response?.data?.message || 'We couldn’t upload the logo.' }))
    } finally {
      setUploading(false)
    }
  }

  const finish = async () => {
    if (!checkStep(2)) return
    try {
      setSaving(true)
      const session = await trialApi.completeSetup(token, {
        password: form.password,
        full_name: form.full_name.trim(),
        company_name: form.company_name.trim(),
        website: form.website.trim() || undefined,
        industry: form.industry || undefined,
        size: form.size || undefined,
        timezone: form.timezone,
        logo_url: form.logo_url || undefined,
        brand_color: form.brand_color,
        email_sender_name: form.email_sender_name.trim() || undefined,
      })
      setTokens(session.access_token, session.refresh_token, session.user, true)
      navigate('/hiring/admin', { replace: true })
    } catch (err: any) {
      const data = err?.response?.data
      const field = data?.details?.errors?.[0]?.loc?.[1]
      if (field === 'password') {
        setStep(0)
        setErrors({ password: String(data.details.errors[0].msg).replace(/^Value error, /, '') })
      } else {
        setErrors({ form: data?.message || 'We couldn’t finish the setup. Please try again.' })
      }
      setSaving(false)
    }
  }

  const field = (key: keyof typeof form, label: string, opts: { type?: string; placeholder?: string; required?: boolean; autoComplete?: string } = {}) => (
    <div className="field">
      <label htmlFor={`ts-${key}`}>
        {label}
        {opts.required !== false && <span className="field__req" aria-hidden="true"> *</span>}
      </label>
      <input
        id={`ts-${key}`}
        type={opts.type ?? 'text'}
        placeholder={opts.placeholder}
        autoComplete={opts.autoComplete}
        aria-invalid={errors[key] ? true : undefined}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
      />
      {errors[key] && <p className="field__err">{errors[key]}</p>}
    </div>
  )

  const senderName = form.email_sender_name.trim() || form.company_name.trim() || 'Your company'

  return (
    <SiteView route="setup">
      <section className="section" style={{ paddingTop: 'calc(var(--nav-h) + clamp(32px,4vw,56px))' }}>
        <div className="wrap" style={{ maxWidth: '760px' }}>
          {loadError ? (
            <div className="card trial-step" style={{ padding: 'clamp(24px,4vw,40px)', textAlign: 'center' }}>
              <h1 className="h-md">We can’t open this setup link</h1>
              <p className="lead" style={{ marginTop: '12px' }}>{loadError}</p>
              <p className="form-note" style={{ marginTop: '14px' }}>
                Already set up? <a href="/login">Sign in</a>. Need help? <a href="mailto:info@hybent.com">info@hybent.com</a>
              </p>
            </div>
          ) : !info ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}><p className="lead">Loading your setup…</p></div>
          ) : (
            <>
              <div className="center" style={{ marginBottom: '26px' }}>
                <p className="eyebrow" style={{ justifyContent: 'center' }}><span className="bars"><i></i><i></i><i></i></span><span>{info.plan} free trial</span></p>
                <h1 className="h-lg" style={{ marginTop: '10px' }}>Set up your organization</h1>
                <p className="lead" style={{ marginTop: '12px' }}>
                  A few details and your workspace is ready. Your trial ends{' '}
                  {new Date(info.trial_end).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.
                </p>
              </div>

              <div className="card trial-form-card" style={{ padding: 'clamp(22px,3.5vw,38px)' }}>
                <ol className="trial-steps" aria-label="Setup progress">
                  {STEPS.map((title, i) => (
                    <li key={title} className={`trial-steps__item${i === step ? ' is-current' : ''}${i < step ? ' is-done' : ''}`} aria-current={i === step ? 'step' : undefined}>
                      <span className="trial-steps__num">{i < step ? <svg aria-hidden="true"><use href="#i-check" /></svg> : i + 1}</span>
                      <span className="trial-steps__title">{title}</span>
                    </li>
                  ))}
                </ol>
                <div className="trial-steps__bar" aria-hidden="true"><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>

                {step === 0 && (
                  <div className="trial-step" key="s0">
                    <div className="field">
                      <label htmlFor="ts-email">Sign-in email</label>
                      <input id="ts-email" type="email" value={info.email} readOnly />
                    </div>
                    <div style={{ marginTop: '16px' }}>{field('full_name', 'Full name', { autoComplete: 'name' })}</div>
                    <div className="grid g2" style={{ gap: '16px', marginTop: '16px' }}>
                      {field('password', 'Password', { type: 'password', placeholder: '12+ chars: A-z, 0-9 and a symbol', autoComplete: 'new-password' })}
                      {field('confirm', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="trial-step" key="s1">
                    <div className="setup-logo">
                      <div className="setup-logo__preview setup-logo__preview--wide">
                        {form.logo_url ? <img src={form.logo_url} alt="Company logo" /> : <span>{form.company_name || 'Your logo'}</span>}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600 }}>Company logo</p>
                        <p className="form-note">
                          A horizontal logo, like the HYBENT wordmark below: a transparent PNG or WebP, at least
                          300×40px and about 3 to 10 times wider than tall, under 2 MB. It sits at the top of every
                          email your team sends.
                        </p>
                        <p className="setup-logo__example">
                          <span>Example</span>
                          <img src="/hybent/hybent-wordmark-light.png" alt="HYBENT wordmark" />
                        </p>
                        <input ref={fileRef} type="file" accept="image/png,image/webp" hidden onChange={(e) => uploadLogo(e.target.files?.[0])} />
                        <button type="button" className="btn btn-ghost" style={{ marginTop: '8px', height: '38px' }} disabled={uploading} onClick={() => fileRef.current?.click()}>
                          {uploading ? 'Uploading…' : form.logo_url ? 'Change logo' : 'Upload logo'}
                        </button>
                        {errors.logo_url && <p className="field__err">{errors.logo_url}</p>}
                      </div>
                    </div>
                    <div className="grid g2" style={{ gap: '16px', marginTop: '20px' }}>
                      {field('company_name', 'Company name', { autoComplete: 'organization' })}
                      {field('website', 'Website', { type: 'url', placeholder: 'https://acme.com', required: false })}
                    </div>
                    <div className="grid g2" style={{ gap: '16px', marginTop: '16px' }}>
                      <div className="field">
                        <label htmlFor="ts-industry">Industry</label>
                        <SiteSelect id="ts-industry" value={form.industry} options={info.industries.map((v) => ({ value: v, label: v }))} onChange={(v) => set('industry', v)} />
                      </div>
                      <div className="field">
                        <label htmlFor="ts-size">Company size</label>
                        <SiteSelect id="ts-size" value={form.size} options={info.company_sizes.map((v) => ({ value: v, label: `${v} employees` }))} onChange={(v) => set('size', v)} />
                      </div>
                    </div>
                    <div className="field" style={{ marginTop: '16px' }}>
                      <label htmlFor="ts-timezone">Time zone</label>
                      <SiteSelect id="ts-timezone" value={form.timezone} options={zoneOptions} onChange={(v) => set('timezone', v)} />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="trial-step" key="s2">
                    {field('email_sender_name', 'Email sender name', { placeholder: 'Acme Hiring Team', required: false })}
                    <div className="field" style={{ marginTop: '16px' }}>
                      <label htmlFor="ts-brand_color">Brand colour</label>
                      <div className="setup-colors">
                        {COLORS.map((c) => (
                          <button key={c} type="button" className="setup-colors__swatch" style={{ background: c }}
                            aria-label={`Use ${c}`} aria-pressed={form.brand_color.toUpperCase() === c} onClick={() => set('brand_color', c)} />
                        ))}
                        <input id="ts-brand_color" type="color" value={form.brand_color} onChange={(e) => set('brand_color', e.target.value.toUpperCase())} aria-label="Custom colour" />
                      </div>
                      {errors.brand_color && <p className="field__err">{errors.brand_color}</p>}
                    </div>

                    <p className="mono" style={{ margin: '24px 0 10px', color: 'var(--dim)' }}>Email preview</p>
                    <div className="setup-preview" aria-label="How your emails look">
                      <p className="setup-preview__from"><b>{senderName}</b> &lt;info@hybent.com&gt;</p>
                      <div className="setup-preview__mail">
                        <div className="setup-preview__brand">
                          {form.logo_url ? <img src={form.logo_url} alt="" /> : <b>{form.company_name || 'Your company'}</b>}
                        </div>
                        <p style={{ fontWeight: 600, marginTop: '14px' }}>Interview invitation</p>
                        <p className="form-note" style={{ marginTop: '6px' }}>Hi Priya, you’re invited to an interview for the Backend Engineer role…</p>
                        <span className="setup-preview__btn" style={{ background: form.brand_color }}>Confirm interview</span>
                        <p className="setup-preview__foot">Powered by <b>HYBENT</b></p>
                      </div>
                    </div>
                    {errors.form && <p className="field__err" style={{ marginTop: '12px' }}>{errors.form}</p>}
                  </div>
                )}

                <div className="trial-actions">
                  <button type="button" className="btn btn-ghost btn-lg" disabled={step === 0 || saving} onClick={() => setStep((s) => s - 1)}>Back</button>
                  {step < STEPS.length - 1 ? (
                    <button type="button" className="btn btn-primary btn-lg" onClick={next}>
                      Continue <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg>
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary btn-lg" disabled={saving || uploading} onClick={finish}>
                      {saving ? 'Setting up…' : 'Finish & open my workspace'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </SiteView>
  )
}

/** The upload rules from the server (app/services/logo_rules.py): null when the file fits. */
async function checkLogo(file: File): Promise<string | null> {
  if (!['image/png', 'image/webp'].includes(file.type)) return 'Use a PNG or WebP file with a transparent background.'
  if (file.size > 2 * 1024 * 1024) return 'The logo must be under 2 MB.'
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const { naturalWidth: w, naturalHeight: h } = img
    if (w < 300 || h < 40) return `The logo is too small (${w}×${h}px). Use at least 300×40px.`
    if (w / h < 2) return 'This looks like a square or stacked logo. Use a horizontal logo like the HYBENT wordmark.'
    if (w / h > 12) return 'The logo is too thin. Use a horizontal logo about 3 to 10 times wider than tall.'
    return null
  } catch {
    return 'That file isn’t a readable image.'
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** The app's password rule (app/schemas/auth.validate_password_strength). */
function passwordProblem(pw: string): string | null {
  if (pw.length < 12) return 'Use at least 12 characters.'
  if (!/[A-Z]/.test(pw)) return 'Add an uppercase letter.'
  if (!/[a-z]/.test(pw)) return 'Add a lowercase letter.'
  if (!/[0-9]/.test(pw)) return 'Add a number.'
  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(pw)) return 'Add a symbol, like ! or #.'
  return null
}
