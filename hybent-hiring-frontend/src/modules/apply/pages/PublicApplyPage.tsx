import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { AlertTriangle, Check, CheckCircle2, Loader2, MapPin } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

import { publicApi } from '@/api/public'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { Badge, Button, Card, Dropzone, Input } from '@/components/hb'

/**
 * The public, no-login "apply to this job" page — the destination of a
 * shareable apply link (e.g. attached to a LinkedIn post). Anyone can view
 * the job and submit an application here; the resulting candidate shows up
 * in the recruiter's All Candidates list, who can later invite them to the
 * portal separately.
 */

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
}

/* A fixed list rather than free text: Copilot's "immediate joiners" and
   "notice under N days" searches read "immediate" or the number of days out
   of this value. */
const NOTICE_PERIOD_OPTIONS = [
  'Immediate',
  '15 days',
  '30 days',
  '45 days',
  '60 days',
  '90 days',
  'More than 90 days',
]

interface PublicJob {
  id: string
  title: string
  location: string | null
  job_type: string
  experience_level: string | null
  min_experience_years: number | null
  description: string
  requirements: string | null
  responsibilities: string | null
  benefits: string | null
  skills_required: string[]
  is_remote: boolean
  organization: { name: string; slug: string; logo_url: string | null }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hb-app flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl py-hb-10">{children}</div>
    </div>
  )
}

function Prose({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="font-display text-hb-h3 text-hb-text">{title}</h2>
      <p className="mt-2 whitespace-pre-line text-hb-body text-hb-muted">{body}</p>
    </section>
  )
}

export default function PublicApplyPage() {
  const { orgSlug, jobId } = useParams<{ orgSlug: string; jobId: string }>()
  // `?source=careers_page` from the Hybent careers page; the backend ignores unknown values.
  const source = useSearchParams()[0].get('source') || undefined
  const [job, setJob] = useState<PublicJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [currentCtc, setCurrentCtc] = useState('')
  const [expectedCtc, setExpectedCtc] = useState('')
  const [noticePeriod, setNoticePeriod] = useState('')
  const [resume, setResume] = useState<File | null>(null)

  useEffect(() => {
    if (!orgSlug || !jobId) return
    publicApi
      .getJob(orgSlug, jobId)
      .then((res: any) => setJob(res.data))
      .catch((err: any) => {
        setError(
          err?.response?.status === 404
            ? 'This job is no longer accepting applications, or the link is incorrect.'
            : 'Could not load this job right now. Please try again shortly.'
        )
      })
      .finally(() => setLoading(false))
  }, [orgSlug, jobId])

  const [handleSubmit, isSubmitting] = useAsyncAction(async () => {
    if (!orgSlug || !jobId) return
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      return toast.error('Please fill in your name, email and phone.')
    }
    const phoneDigits = phone.replace(/\D/g, '').length
    if (phoneDigits < 7 || phoneDigits > 15) return toast.error('Please enter a valid phone number.')
    if (linkedinUrl.trim() && !/linkedin\.com\//i.test(linkedinUrl)) {
      return toast.error('Please enter your LinkedIn profile link, e.g. linkedin.com/in/yourname.')
    }
    if (!currentCtc.trim() || !expectedCtc.trim() || !noticePeriod) {
      return toast.error('Please fill in your current CTC, expected CTC and notice period.')
    }
    if (!resume) return toast.error('Please attach your resume.')

    try {
      await publicApi.apply(orgSlug, jobId, {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        linkedin_url: linkedinUrl.trim() || undefined,
        current_ctc: currentCtc.trim(),
        expected_ctc: expectedCtc.trim(),
        notice_period: noticePeriod,
        resume,
        source,
      })
      setSubmitted(true)
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.message || err?.response?.data?.detail
      if (status === 409) {
        toast.error(detail || 'You have already applied to this job.')
      } else {
        toast.error(detail || 'Could not submit your application. Please try again.')
      }
    }
  })

  if (loading) {
    return (
      <Shell>
        <p role="status" className="flex items-center justify-center gap-2.5 text-hb-body text-hb-muted">
          <Loader2 size={22} aria-hidden className="animate-spin text-hb-cyan" />
          Loading job details…
        </p>
      </Shell>
    )
  }

  if (error || !job) {
    return (
      <Shell>
        <Card padding="loose" className="text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-hb-warning/25 bg-hb-warning/10 text-hb-warning">
            <AlertTriangle size={28} aria-hidden />
          </span>
          <h1 className="mb-2 font-display text-hb-h2 text-hb-text">Job not available</h1>
          <p className="mb-hb-5 text-hb-sm text-hb-muted">{error}</p>
          <Button variant="ghost" to="/" className="w-full">
            Back to home
          </Button>
        </Card>
      </Shell>
    )
  }

  if (submitted) {
    return (
      <Shell>
        <Card padding="loose" className="text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-hb-success/25 bg-hb-success/10 text-hb-success">
            <CheckCircle2 size={28} aria-hidden />
          </span>
          <h1 className="mb-2 font-display text-hb-h2 text-hb-text">Application received</h1>
          <p className="text-hb-sm text-hb-muted">
            Thanks for applying to <strong>{job.title}</strong> at {job.organization.name}. The
            hiring team will be in touch if there's a match.
          </p>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mb-hb-6 text-center">
        <Link to="/" className="mb-hb-5 inline-flex items-center gap-3">
          <img src="/hybent_logo.webp" alt="" className="h-9 w-9 object-contain" />
          <img src="/hybent_wordmark_dark.webp" alt="Hybent" className="h-6" />
        </Link>
        {job.organization.logo_url && (
          <img
            src={job.organization.logo_url}
            alt=""
            className="mx-auto mb-hb-3 h-10 w-10 rounded-hb-sm object-contain"
          />
        )}
        <p className="font-mono text-hb-label uppercase text-hb-dim">{job.organization.name}</p>
        <h1 className="mt-1 font-display text-hb-h1 text-hb-text">{job.title}</h1>
        <p className="mt-2 inline-flex flex-wrap items-center justify-center gap-2 text-hb-sm text-hb-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} aria-hidden />
            {job.is_remote ? 'Remote' : job.location || 'Not specified'}
          </span>
          <span aria-hidden>·</span>
          <span>{JOB_TYPE_LABEL[job.job_type] || job.job_type}</span>
          {job.experience_level && (
            <>
              <span aria-hidden>·</span>
              <span className="capitalize">{job.experience_level}</span>
            </>
          )}
        </p>
        {job.skills_required?.length > 0 && (
          <div className="mt-hb-3 flex flex-wrap justify-center gap-1.5">
            {job.skills_required.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
          </div>
        )}
      </div>

      <Card padding="loose" className="space-y-hb-6">
        <div className="space-y-hb-5">
          {job.description && <Prose title="About the role" body={job.description} />}
          {job.responsibilities && <Prose title="Key responsibilities" body={job.responsibilities} />}
          {job.requirements && <Prose title="Requirements" body={job.requirements} />}
          {job.benefits && <Prose title="Benefits" body={job.benefits} />}
        </div>

        <div className="space-y-hb-4 border-t border-hb-border pt-hb-5">
          <h2 className="font-display text-hb-h3 text-hb-text">Apply for this role</h2>

          <div className="grid gap-hb-4 sm:grid-cols-2">
            <Input
              label="Full name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
            />
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
            <Input
              label="Phone"
              type="tel"
              required
              maxLength={50}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 90000 00000"
            />
            <Input
              label="LinkedIn profile"
              maxLength={500}
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="Optional — linkedin.com/in/yourname"
            />
          </div>

          <div className="grid gap-hb-4 sm:grid-cols-2">
            <Input
              label="Current CTC"
              required
              maxLength={100}
              value={currentCtc}
              onChange={(e) => setCurrentCtc(e.target.value)}
              placeholder="e.g. ₹6,00,000"
            />
            <Input
              label="Expected CTC"
              required
              maxLength={100}
              value={expectedCtc}
              onChange={(e) => setExpectedCtc(e.target.value)}
              placeholder="e.g. ₹8,00,000"
            />
          </div>

          {/* Chips rather than a <select>: seven short options read at a
              glance and take one tap, where the native dropdown opened the
              platform's unstyled list. Real radios underneath, so arrow keys
              and screen readers work as for any radio group. */}
          <fieldset>
            <legend className="mb-2 font-mono text-hb-label uppercase text-hb-dim">
              Notice period
              <span className="ml-1 text-hb-error" aria-hidden>*</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {NOTICE_PERIOD_OPTIONS.map((option) => (
                <label key={option} className="cursor-pointer">
                  <input
                    type="radio"
                    name="notice_period"
                    value={option}
                    required
                    checked={noticePeriod === option}
                    onChange={() => setNoticePeriod(option)}
                    className="peer sr-only"
                  />
                  <span
                    className={clsx(
                      'inline-flex h-10 items-center gap-1.5 rounded-hb-full border px-4',
                      'font-body text-hb-sm font-semibold whitespace-nowrap',
                      'transition-all duration-hb ease-hb',
                      'border-hb-border bg-hb-surface text-hb-muted',
                      'hover:border-hb-border-strong hover:text-hb-text',
                      'peer-checked:border-hb-blue/50 peer-checked:bg-hb-blue/10 peer-checked:text-hb-blue',
                      'peer-focus-visible:border-hb-blue/60 peer-focus-visible:shadow-hb-ring'
                    )}
                  >
                    {noticePeriod === option && <Check size={14} aria-hidden />}
                    {option}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Dropzone
            title={resume ? resume.name : 'Upload your resume'}
            description={resume ? 'Click to replace' : 'Drag & drop or click to browse'}
            formats={['PDF', 'DOC', 'DOCX']}
            accept=".pdf,.doc,.docx"
            onFiles={(files) => setResume(files[0] ?? null)}
          />

          <Button onClick={() => handleSubmit()} loading={isSubmitting} size="lg" className="w-full">
            Submit application
          </Button>
        </div>
      </Card>
    </Shell>
  )
}
