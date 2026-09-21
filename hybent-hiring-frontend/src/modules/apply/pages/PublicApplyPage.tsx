import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2, MapPin } from 'lucide-react'
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
  const [job, setJob] = useState<PublicJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
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
    if (!fullName.trim() || !email.trim()) return toast.error('Please fill in your name and email.')
    if (!resume) return toast.error('Please attach your résumé.')

    try {
      await publicApi.apply(orgSlug, jobId, {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        linkedin_url: linkedinUrl.trim() || undefined,
        resume,
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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
            />
            <Input
              label="LinkedIn profile"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <Dropzone
            title={resume ? resume.name : 'Upload your résumé'}
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
