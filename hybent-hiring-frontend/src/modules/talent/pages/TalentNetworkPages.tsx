import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Building2, CheckCircle2, EyeOff, Loader2, Lock, MailCheck, Sparkles, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

import { talentNetworkApi, type TalentProfileView, type TalentRequestView } from '@/api/talentNetwork'
import { Badge, Button, Card, Checkbox, Dropzone, Input, Switch } from '@/components/hb'

/**
 * Hybent Talent Network, candidate side. Four no-login pages:
 *   /talent                   sign up (resume + consent)
 *   /talent/verify/:token     confirm email -> profile goes live
 *   /talent/manage/:token     see, hide or delete the profile
 *   /talent/respond/:token    yes / no to a company's contact request
 */

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="hb-app flex min-h-screen items-start justify-center p-4 sm:items-center">
      <div className="w-full max-w-xl py-hb-10">
        <Link to="/" className="mb-hb-6 flex w-fit items-center gap-2 font-display text-hb-h3 text-hb-text">
          <span className="hb-grad-text">Hybent</span>
          <span className="font-mono text-hb-label uppercase text-hb-dim">Talent Network</span>
        </Link>
        {children}
      </div>
    </div>
  )
}

function Status({ icon, title, body, children }: { icon: ReactNode; title: string; body: ReactNode; children?: ReactNode }) {
  return (
    <Card padding="loose" className="text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-hb-full bg-hb-surface-2 text-hb-violet">{icon}</div>
      <h1 className="mt-hb-4 font-display text-hb-h2 text-hb-text">{title}</h1>
      <div className="mt-hb-2 text-hb-body text-hb-muted">{body}</div>
      {children && <div className="mt-hb-6">{children}</div>}
    </Card>
  )
}

const err = (e: any, fallback: string) => e?.response?.data?.detail ?? e?.response?.data?.message ?? fallback

/* ── /talent ─────────────────────────────────────────────────────────────── */

export function TalentSignupPage() {
  const source = useSearchParams()[0].get('source') || undefined
  const [consentText, setConsentText] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', location: '', looking_for: '', linkedin_url: '' })
  const [resume, setResume] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [doneEmail, setDoneEmail] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Join the Hybent Talent Network'
    talentNetworkApi.consent().then((r) => setConsentText(r.data.text)).catch(() => {})
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim() || !form.email.trim()) return toast.error('Please add your name and email.')
    if (!resume) return toast.error('Please upload your resume.')
    if (!consent) return toast.error('Please tick the box to agree to be found by companies.')
    setBusy(true)
    try {
      const r = await talentNetworkApi.signup({ ...form, source, consent, resume })
      setDoneEmail(r.data.email)
    } catch (e2) {
      toast.error(err(e2, 'Something went wrong. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (doneEmail) {
    return (
      <Shell>
        <Status
          icon={<MailCheck />}
          title="Check your email"
          body={
            <>
              We sent a confirm link to <strong className="text-hb-text">{doneEmail}</strong>. Your profile goes live
              when you click it.
            </>
          }
        />
      </Shell>
    )
  }

  return (
    <Shell>
      <Badge tone="brand">
        <Sparkles size={10} aria-hidden /> Free for candidates
      </Badge>
      <h1 className="mt-hb-3 font-display text-[clamp(28px,4vw,40px)] leading-[1.1] text-hb-text">
        Let companies find <span className="hb-grad-text">you</span>
      </h1>
      <p className="mt-hb-3 text-hb-body text-hb-muted">
        Upload your resume once. Companies hiring on Hybent can find your profile, and they get your email and phone
        only if you say yes.
      </p>

      <ul className="mt-hb-4 grid gap-2 text-hb-sm text-hb-muted sm:grid-cols-3">
        {[
          [<Lock key="l" size={14} />, 'Contact details stay private'],
          [<CheckCircle2 key="c" size={14} />, 'You approve every company'],
          [<EyeOff key="e" size={14} />, 'Hide or delete anytime'],
        ].map(([icon, text]) => (
          <li key={String(text)} className="flex items-center gap-2">
            <span className="text-hb-violet">{icon}</span>
            {text}
          </li>
        ))}
      </ul>

      <Card padding="loose" className="mt-hb-6">
        <form className="space-y-hb-4" onSubmit={submit}>
          <Dropzone
            title={resume ? resume.name : 'Upload your resume'}
            description={resume ? 'Click to replace' : 'Drag & drop or click to browse'}
            formats={['PDF', 'DOC', 'DOCX']}
            accept=".pdf,.doc,.docx"
            onFiles={(files) => setResume(files[0] ?? null)}
          />
          <div className="grid gap-hb-4 sm:grid-cols-2">
            <Input label="Full name" required value={form.full_name} onChange={set('full_name')} autoComplete="name" />
            <Input label="Email" required type="email" value={form.email} onChange={set('email')} autoComplete="email" />
            <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
            <Input label="City" placeholder="e.g. Ahmedabad" value={form.location} onChange={set('location')} />
          </div>
          <Input
            label="What role do you want next?"
            placeholder="e.g. Frontend developer (React)"
            value={form.looking_for}
            onChange={set('looking_for')}
          />
          <Input label="LinkedIn (optional)" value={form.linkedin_url} onChange={set('linkedin_url')} />
          <Checkbox
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            label={consentText || 'I agree to be found by companies hiring on Hybent.'}
          />
          <Button type="submit" size="lg" fullWidth loading={busy}>
            {busy ? 'Checking your resume…' : 'Join the network'}
          </Button>
        </form>
      </Card>
    </Shell>
  )
}

/* ── /talent/verify/:token ───────────────────────────────────────────────── */

export function TalentVerifyPage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<{ manage?: string; error?: string } | null>(null)
  const sent = useRef(false)

  useEffect(() => {
    // Once per page: React's dev mode runs effects twice. (The API is also
    // idempotent, so a second call would still say "confirmed".)
    if (sent.current) return
    sent.current = true
    // The email link's GET only loads this page; confirming is a POST from the
    // page's script, which most email link scanners don't run.
    talentNetworkApi
      .verify(token)
      .then((r) => setState({ manage: r.data.manage_token }))
      .catch((e) => setState({ error: err(e, 'This link has expired.') }))
  }, [token])

  return (
    <Shell>
      {!state ? (
        <Status icon={<Loader2 className="animate-spin" />} title="Confirming…" body="One moment." />
      ) : state.error ? (
        <Status icon={<AlertTriangle />} title="Link not valid" body={state.error} />
      ) : (
        <Status
          icon={<CheckCircle2 />}
          title="You're in"
          body="Your profile is live. When a company wants to talk to you, we'll email you to ask first."
        >
          <Button to={`/talent/manage/${state.manage}`} variant="ghost">
            See my profile
          </Button>
        </Status>
      )}
    </Shell>
  )
}

/* ── /talent/manage/:token ───────────────────────────────────────────────── */

export function TalentManagePage() {
  const { token = '' } = useParams()
  const [p, setP] = useState<TalentProfileView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    talentNetworkApi.getProfile(token).then((r) => setP(r.data)).catch((e) => setError(err(e, 'Profile not found.')))
  }, [token])

  const toggle = async (v: boolean) => {
    setBusy(true)
    try {
      const next = (await talentNetworkApi.setVisible(token, v)).data
      setP((prev) => ({ ...next, requests: prev?.requests }))
      toast.success(v ? 'Companies can find you again' : 'Hidden from companies')
    } catch (e) {
      toast.error(err(e, 'Could not save.'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('Delete your profile for good? Companies you already said yes to keep what you shared.')) return
    setBusy(true)
    try {
      await talentNetworkApi.deleteProfile(token)
      setDeleted(true)
    } catch (e) {
      toast.error(err(e, 'Could not delete.'))
    } finally {
      setBusy(false)
    }
  }

  if (deleted) return <Shell><Status icon={<Trash2 />} title="Profile deleted" body="It's gone from the Hybent Talent Network." /></Shell>
  if (error) return <Shell><Status icon={<AlertTriangle />} title="Not found" body={error} /></Shell>
  if (!p) return <Shell><Status icon={<Loader2 className="animate-spin" />} title="Loading…" body="" /></Shell>

  return (
    <Shell>
      <Card padding="loose">
        <h1 className="font-display text-hb-h2 text-hb-text">{p.full_name}</h1>
        <p className="mt-1 text-hb-sm text-hb-muted">
          {[p.current_title, p.current_company, p.location].filter(Boolean).join(' · ') || 'Profile'}
        </p>
        {p.looking_for && (
          <p className="mt-hb-2 text-hb-sm text-hb-muted">
            Looking for: <strong className="text-hb-text">{p.looking_for}</strong>
          </p>
        )}
        <p className="mt-hb-3 text-hb-sm text-hb-muted">
          Companies see you as <strong className="text-hb-text">{p.shown_to_companies_as}</strong>, with no email or phone.
        </p>
        {p.skills.length > 0 && (
          <div className="mt-hb-4 flex flex-wrap gap-1.5">
            {p.skills.slice(0, 14).map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        )}
        {!!p.requests?.length && (
          <div className="mt-hb-6 border-t border-hb-border pt-hb-4">
            <h2 className="text-hb-base font-semibold text-hb-text">Companies that want to talk to you</h2>
            <ul className="mt-hb-3 space-y-hb-2">
              {p.requests.map((r) => (
                <li
                  key={r.token}
                  className="flex flex-wrap items-center justify-between gap-hb-2 rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-hb-sm font-semibold text-hb-text">{r.company}</p>
                    {r.job_title && <p className="text-hb-sm text-hb-muted">{r.job_title}</p>}
                  </div>
                  {r.status === 'pending' ? (
                    <Button size="sm" to={`/talent/respond/${r.token}`}>
                      Answer
                    </Button>
                  ) : (
                    <Badge tone={r.status === 'accepted' ? 'success' : 'neutral'}>
                      {r.status === 'accepted' ? 'You shared your details' : 'You said no'}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-hb-6 space-y-hb-4 border-t border-hb-border pt-hb-4">
          {!p.verified && <Badge tone="warning">Email not confirmed yet: check your inbox</Badge>}
          <Switch
            checked={p.is_visible}
            disabled={busy}
            onChange={toggle}
            label="Companies can find me"
            description="Turn off to hide your profile without deleting it."
          />
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={remove} loading={busy}>
            Delete my profile
          </Button>
          <p className="text-hb-sm text-hb-dim">
            To update your resume, sign up again with the same email at <Link className="underline" to="/talent">hybent.com/talent</Link>.
          </p>
        </div>
      </Card>
    </Shell>
  )
}

/* ── /talent/respond/:token ──────────────────────────────────────────────── */

export function TalentRespondPage() {
  const { token = '' } = useParams()
  const preset = useSearchParams()[0].get('answer')
  const [req, setReq] = useState<TalentRequestView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    talentNetworkApi.getRequest(token).then((r) => setReq(r.data)).catch((e) => setError(err(e, 'Request not found.')))
  }, [token])

  const answer = async (accept: boolean) => {
    setBusy(true)
    try {
      setReq((await talentNetworkApi.answer(token, accept)).data)
    } catch (e) {
      toast.error(err(e, 'Could not save your answer.'))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <Shell><Status icon={<AlertTriangle />} title="Not found" body={error} /></Shell>
  if (!req) return <Shell><Status icon={<Loader2 className="animate-spin" />} title="Loading…" body="" /></Shell>

  if (req.status !== 'pending') {
    return (
      <Shell>
        <Status
          icon={<CheckCircle2 />}
          title={req.status === 'accepted' ? `Shared with ${req.company}` : 'Answer saved'}
          body={
            req.status === 'accepted'
              ? `${req.company} now has your details and will get in touch.`
              : `${req.company} won't get your details.`
          }
        />
      </Shell>
    )
  }

  // The email's buttons pass ?answer=yes|no, but the choice is still confirmed
  // here with a click, so an email scanner opening the link can't answer for them.
  return (
    <Shell>
      <Status
        icon={<Building2 />}
        title={`${req.company} wants to talk to you`}
        body={
          <>
            {req.job_title ? (
              <>
                About the <strong className="text-hb-text">{req.job_title}</strong> role.
              </>
            ) : (
              'They found your profile on the Hybent Talent Network.'
            )}
            {req.message && <p className="mt-hb-3 italic">“{req.message}”</p>}
            <p className="mt-hb-3">If you say yes, they get your name, email, phone and profile.</p>
          </>
        }
      >
        <div className="flex flex-col gap-hb-2 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            variant={preset === 'no' ? 'ghost' : 'primary'}
            loading={busy}
            onClick={() => answer(true)}
          >
            Yes, share my details
          </Button>
          <Button size="lg" variant={preset === 'no' ? 'primary' : 'ghost'} disabled={busy} onClick={() => answer(false)}>
            No thanks
          </Button>
        </div>
      </Status>
    </Shell>
  )
}
