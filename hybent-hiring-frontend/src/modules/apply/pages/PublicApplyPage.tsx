import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Briefcase, Check, CheckCircle2, Loader2, MapPin, UserRound } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

import { publicApi } from '@/api/public'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatDate } from '@/utils/formatters'
import { Badge, Button, Card, Checkbox, Dropzone, Input } from '@/components/hb'
import { ShareJob } from '@/modules/apply/components/ShareJob'
import { CompanyFooter } from '@/modules/apply/components/CompanyFooter'

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
  /** The org uses AI calls, so ask for consent to one. */
  ai_calls?: boolean
  application_deadline: string | null
  openings?: number
  /** Listed on Google for Jobs and the job-board feed. Off for confidential hiring. */
  publish_externally?: boolean
  created_at?: string | null
  organization: { name: string; slug: string; logo_url: string | null; website?: string | null }
}

const EMPLOYMENT_TYPES: Record<string, string> = {
  full_time: 'FULL_TIME', part_time: 'PART_TIME', contract: 'CONTRACTOR',
  internship: 'INTERN', temporary: 'TEMPORARY', remote: 'FULL_TIME',
}

/** schema.org JobPosting, which is what Google for Jobs reads off the page. */
function jobPostingJsonLd(job: PublicJob, url: string) {
  const parts = [job.description, job.responsibilities, job.requirements, job.benefits].filter(Boolean)
  // Google wants HTML in description; keep line breaks as <br>.
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const description = parts.map((p) => esc(p as string).replace(/\n/g, '<br>')).join('<br><br>')
  const place = (job.location || '').split(/[·|/(]| - /)[0]
  const bits = place.split(',').map((b) => b.trim()).filter(Boolean)
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description,
    identifier: { '@type': 'PropertyValue', name: job.organization.name, value: job.id },
    datePosted: (job.created_at || new Date().toISOString()).slice(0, 10),
    employmentType: EMPLOYMENT_TYPES[job.job_type] ?? 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.organization.name,
      ...(job.organization.website ? { sameAs: job.organization.website } : {}),
      ...(job.organization.logo_url ? { logo: job.organization.logo_url } : {}),
    },
    url,
    directApply: true,
  }
  if (job.application_deadline) data.validThrough = job.application_deadline
  if (job.skills_required?.length) data.skills = job.skills_required.join(', ')
  if (job.min_experience_years) {
    data.experienceRequirements = {
      '@type': 'OccupationalExperienceRequirements',
      monthsOfExperience: job.min_experience_years * 12,
    }
  }
  if (job.is_remote) {
    data.jobLocationType = 'TELECOMMUTE'
    data.applicantLocationRequirements = { '@type': 'Country', name: bits.length > 1 ? bits[bits.length - 1] : 'India' }
  }
  if (bits.length || !job.is_remote) {
    data.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: bits[0] || undefined,
        addressCountry: bits.length > 1 ? bits[bits.length - 1] : 'IN',
      },
    }
  }
  return data
}

/* JD text saved as bullets often loses the first "•" (the parser keeps it
   only between items), so a list rendered with one bare line. Lines are
   shown as a real list when most of them are bullets. */
const BULLET = /^\s*(?:[•\-*–]|\d+[.)])\s+/

function bodyLines(body: string): { list: boolean; lines: string[] } {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
  const bulleted = lines.filter((l) => BULLET.test(l)).length
  if (lines.length > 1 && bulleted >= (lines.length - 1)) {
    return { list: true, lines: lines.map((l) => l.replace(BULLET, '')) }
  }
  return { list: false, lines }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3.5 py-2.5">
      <p className="font-mono text-hb-label uppercase text-hb-dim">{label}</p>
      <p className="mt-1 text-hb-sm font-semibold text-hb-text">{value}</p>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hb-app flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl py-hb-10">{children}</div>
    </div>
  )
}

function Prose({ title, body }: { title: string; body: string }) {
  const { list, lines } = bodyLines(body)
  return (
    <section>
      <h2 className="font-display text-hb-h3 text-hb-text">{title}</h2>
      {list ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-hb-body text-hb-muted marker:text-hb-dim">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 whitespace-pre-line text-hb-body text-hb-muted">{body}</p>
      )}
    </section>
  )
}

export default function PublicApplyPage() {
  const { orgSlug, jobId } = useParams<{ orgSlug: string; jobId: string }>()
  // `?source=careers_page` from the Hybent careers page; the backend ignores unknown values.
  // Google for Jobs links straight to this page with no ?source, so a Google referrer counts as "google".
  const source =
    useSearchParams()[0].get('source') ||
    (/(^|\.)google\./.test(document.referrer ? new URL(document.referrer).hostname : '') ? 'google' : undefined)
  const [job, setJob] = useState<PublicJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  // Job details first; "Apply for this job" swaps in the form (like Keka's careers pages).
  const formRef = useRef<HTMLDivElement>(null)
  const [showForm, setShowForm] = useState(false)
  // No blanket useNoIndex() here: a published job must be indexable for Google
  // for Jobs. The effect below adds noindex only to jobs that aren't published.

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [currentCtc, setCurrentCtc] = useState('')
  const [expectedCtc, setExpectedCtc] = useState('')
  const [noticePeriod, setNoticePeriod] = useState('')
  const [resume, setResume] = useState<File | null>(null)
  const [aiCallConsent, setAiCallConsent] = useState(false)

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

  useEffect(() => {
    if (job) document.title = `${job.title} at ${job.organization.name}`
  }, [job])

  // Google for Jobs: published jobs carry JobPosting JSON-LD. Confidential
  // ones get noindex instead, so a shared link never lands in search results.
  useEffect(() => {
    if (!job) return
    const added: HTMLElement[] = []
    if (job.publish_externally) {
      const s = document.createElement('script')
      s.type = 'application/ld+json'
      s.text = JSON.stringify(jobPostingJsonLd(job, `${window.location.origin}/apply/${job.organization.slug}/${job.id}`))
      document.head.appendChild(s)
      added.push(s)
    } else {
      const m = document.createElement('meta')
      m.name = 'robots'
      m.content = 'noindex'
      document.head.appendChild(m)
      added.push(m)
    }
    return () => added.forEach((el) => el.remove())
  }, [job])

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
        ai_call_consent: job?.ai_calls ? aiCallConsent : undefined,
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

  const applyUrl = `${window.location.origin}/apply/${job.organization.slug}/${job.id}`
  const meta = [
    job.min_experience_years ? `${job.min_experience_years}+ Years` : job.experience_level,
    job.is_remote ? 'Remote' : job.location || null,
    JOB_TYPE_LABEL[job.job_type] || job.job_type,
  ].filter(Boolean) as string[]
  const openForm = () => {
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="hb-app min-h-screen">
      {/* The hiring company's brand, not Hybent's. */}
      <header className="sticky top-0 z-30 border-b border-hb-border bg-hb-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {job.organization.logo_url && (
              <img src={job.organization.logo_url} alt="" className="h-9 w-auto max-w-[180px] object-contain" />
            )}
            <span className="truncate font-display text-hb-h3 font-bold text-hb-text">{job.organization.name}</span>
          </div>
          {job.organization.website && (
            <a
              href={/^https?:\/\//i.test(job.organization.website) ? job.organization.website : `https://${job.organization.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-hb-sm font-semibold text-hb-blue hover:underline"
            >
              Home
            </a>
          )}
        </div>
      </header>

      <div className="border-b border-hb-border bg-gradient-to-r from-hb-blue/10 via-hb-cyan/5 to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-hb-8">
          <h1 className="font-display text-hb-h1 text-hb-text">{job.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-hb-sm text-hb-muted">
            {meta.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i === 0 ? <UserRound size={14} aria-hidden /> : i === 1 ? <MapPin size={14} aria-hidden /> : <Briefcase size={14} aria-hidden />}
                <span className="capitalize">{m}</span>
              </span>
            ))}
          </p>
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-hb-8 px-4 py-hb-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {showForm ? (
            <Card padding="loose">
              <div ref={formRef} className="scroll-mt-4 space-y-hb-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="inline-flex items-center gap-1.5 text-hb-sm font-semibold text-hb-blue hover:underline"
                >
                  <ArrowLeft size={14} aria-hidden /> Back to job details
                </button>
                <h2 className="font-display text-hb-h3 text-hb-text">Apply for this role</h2>

                {jobId && (
                  <a
                    href={`https://wa.me/918799029798?text=${encodeURIComponent(`Apply HB-${jobId.slice(0, 8)}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-hb-sm bg-[#25D366] px-4 py-2.5 text-hb-sm font-semibold text-white transition hover:brightness-105"
                  >
                    Apply on WhatsApp in 2 minutes
                  </a>
                )}
                {jobId && <p className="-mt-hb-2 text-center text-hb-xs text-hb-muted">or fill in the form below</p>}

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

                {job?.ai_calls && (
                  <Checkbox
                    checked={aiCallConsent}
                    onChange={(e) => setAiCallConsent(e.target.checked)}
                    label={
                      <span className="text-hb-sm text-hb-muted">
                        I agree to a short screening call from the Hybent AI Agent, an AI assistant calling on behalf of
                        the hiring team. The call may be recorded for hiring purposes, and I can ask it to stop calling me at any time.
                      </span>
                    }
                  />
                )}

                <Button onClick={() => handleSubmit()} loading={isSubmitting} size="lg" className="w-full">
                  {isSubmitting ? 'Checking your resume…' : 'Submit application'}
                </Button>
              </div>
            </Card>
          ) : (
            <Card padding="loose">
            <div className="space-y-hb-5">
              {job.description && <Prose title="About the role" body={job.description} />}
              {job.responsibilities && <Prose title="Key responsibilities" body={job.responsibilities} />}
              {job.requirements && <Prose title="Requirements" body={job.requirements} />}
              {job.skills_required?.length > 0 && (
                <section>
                  <h2 className="font-display text-hb-h3 text-hb-text">Skills required</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {job.skills_required.map((skill) => (
                      <Badge key={skill}>{skill}</Badge>
                    ))}
                  </div>
                </section>
              )}
              <div className="grid gap-hb-3 sm:grid-cols-2">
                <Fact
                  label="Experience"
                  value={
                    job.min_experience_years
                      ? `${job.min_experience_years}+ years`
                      : job.experience_level
                        ? job.experience_level.charAt(0).toUpperCase() + job.experience_level.slice(1)
                        : 'Open to all levels'
                  }
                />
                <Fact label="Employment type" value={JOB_TYPE_LABEL[job.job_type] || job.job_type} />
                <Fact label="Location" value={job.is_remote ? 'Remote' : job.location || 'Not specified'} />
                {job.application_deadline ? (
                  <Fact label="Apply by" value={formatDate(job.application_deadline)} />
                ) : (
                  <Fact
                    label="Openings"
                    value={`${job.openings ?? 1} ${(job.openings ?? 1) === 1 ? 'position' : 'positions'}`}
                  />
                )}
              </div>

              {job.benefits && <Prose title="Benefits" body={job.benefits} />}
            </div>
            </Card>
          )}
        </div>

        <aside className="space-y-hb-6 lg:sticky lg:top-24 lg:h-fit">
          {!showForm && (
            <Button size="lg" className="w-full" onClick={openForm}>
              Apply for this job
            </Button>
          )}
          <ShareJob url={applyUrl} title={job.title} company={job.organization.name} />
          <Link to={`/apply/${job.organization.slug}`} className="inline-block text-hb-sm font-semibold text-hb-blue hover:underline">
            View all job openings
          </Link>
        </aside>
      </main>

      <div className="mx-auto max-w-6xl px-4 pb-hb-8">
        <CompanyFooter company={job.organization.name} />
      </div>

      {/* Phones: the button sits under a long description, so keep it in thumb reach. */}
      {!showForm && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hb-border bg-hb-surface/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
          <Button size="lg" className="w-full" onClick={openForm}>
            Apply for this job
          </Button>
        </div>
      )}
    </div>
  )
}
