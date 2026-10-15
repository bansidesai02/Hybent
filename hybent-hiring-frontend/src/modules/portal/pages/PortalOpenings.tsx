import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Briefcase, Building2, CalendarDays, CheckCircle, FileText, MapPin, X } from 'lucide-react'

import { portalApi } from '@/api/portal'
import { Job, Application, Candidate } from '@/types'
import { formatDate } from '@/utils/formatters'
import {
  Badge,
  Button,
  Card,
  Dialog,
  Dropzone,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/hb'

/**
 * Open roles the candidate can apply to or refer a friend into.
 *
 * Rebuilt on the design system in phase 7 — off portal.css's `.card`/`.btn`
 * and the legacy `Modal`. One oddity kept faithfully but worth naming: the
 * referral form's "LinkedIn profile" input posts as `relationship`, because
 * that is the field name the backend expects.
 *
 * Applying sends the resume on the candidate's profile, or a new one chosen
 * in the apply dialog (required when the profile has none). A failed load
 * used to render nothing at all — an empty page with no openings and no
 * error — so it now says so and offers a retry.
 */

const RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx']
const MAX_RESUME_MB = 10

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  remote: 'Remote',
}

function errorMessage(err: any, fallback: string): string {
  const data = err?.response?.data
  return data?.message || (typeof data?.detail === 'string' ? data.detail : null) || fallback
}

function resumeProblem(file: File): string | null {
  const name = file.name.toLowerCase()
  if (!RESUME_EXTENSIONS.some((ext) => name.endsWith(ext))) return 'Only PDF, DOC or DOCX files are supported.'
  if (file.size === 0) return 'That file is empty. Please choose another.'
  if (file.size > MAX_RESUME_MB * 1024 * 1024) return `File is too large. Maximum size is ${MAX_RESUME_MB} MB.`
  return null
}

function jobMeta(job: Job): string {
  return [
    job.location || (job.is_remote ? 'Remote' : null),
    JOB_TYPE_LABELS[job.job_type] ?? job.job_type,
    job.min_experience_years ? `${job.min_experience_years}+ yrs` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function JobSection({ title, text }: { title: string; text?: string | null }) {
  if (!text?.trim()) return null
  return (
    <section>
      <h4 className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">{title}</h4>
      <p className="whitespace-pre-line text-hb-sm leading-relaxed text-hb-muted">{text}</p>
    </section>
  )
}

export default function PortalOpenings() {
  const queryClient = useQueryClient()
  const [referTarget, setReferTarget] = useState<any>(null)
  const [detailTarget, setDetailTarget] = useState<Job | null>(null)
  const [applyTarget, setApplyTarget] = useState<Job | null>(null)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeError, setResumeError] = useState<string | null>(null)

  const {
    data: jobs,
    isLoading: jobsLoading,
    isError: jobsFailed,
    refetch: refetchJobs,
    isFetching: jobsFetching,
  } = useQuery<Job[]>({
    queryKey: ['portal', 'jobs'],
    queryFn: () => portalApi.jobs().then((r: any) => r.data),
  })

  const { data: applications } = useQuery<Application[]>({
    queryKey: ['portal', 'applications'],
    queryFn: () => portalApi.myApplications().then((r: any) => r.data),
  })

  const { data: profile } = useQuery<Candidate>({
    queryKey: ['portal', 'profile'],
    queryFn: () => portalApi.profile().then((r: any) => r.data),
  })

  const appliedJobIds = new Set(applications?.map((app: Application) => app.job_id))
  const resumeOnFile = !!(profile?.resume_storage_path || profile?.resume_url)

  const openApply = (job: Job) => {
    setDetailTarget(null)
    setResumeFile(null)
    setResumeError(null)
    setApplyTarget(job)
  }

  const closeApply = () => {
    if (applyMutation.isPending) return
    setApplyTarget(null)
  }

  const pickResume = (file: File | undefined) => {
    if (!file) return
    const problem = resumeProblem(file)
    setResumeError(problem)
    setResumeFile(problem ? null : file)
  }

  const refreshAfterApply = () => {
    queryClient.invalidateQueries({ queryKey: ['portal', 'applications'] })
    queryClient.invalidateQueries({ queryKey: ['portal', 'applications-summary'] })
    queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })
  }

  const applyMutation = useMutation({
    mutationFn: ({ jobId, resume }: { jobId: string; resume?: File }) =>
      portalApi.applyToJob(jobId, resume),
    onSuccess: () => {
      refreshAfterApply()
      toast.success(`Application for ${applyTarget?.title ?? 'the role'} submitted`)
      setApplyTarget(null)
    },
    onError: (err: any) => {
      const status = err?.response?.status
      if (status === 409) {
        // Already applied (another tab, or a double submit) — show it as such.
        refreshAfterApply()
        toast.error(errorMessage(err, 'You have already applied to this position.'))
        setApplyTarget(null)
      } else if (status === 404) {
        queryClient.invalidateQueries({ queryKey: ['portal', 'jobs'] })
        toast.error(errorMessage(err, 'This position is no longer accepting applications.'))
        setApplyTarget(null)
      } else {
        // Keep the dialog open so the candidate can fix the file and retry.
        setResumeError(errorMessage(err, 'Failed to submit your application. Please try again.'))
      }
    },
  })

  const submitApplication = () => {
    if (!applyTarget || applyMutation.isPending) return
    if (!resumeFile && !resumeOnFile) {
      setResumeError('Please attach your resume to apply.')
      return
    }
    applyMutation.mutate({ jobId: applyTarget.id, resume: resumeFile ?? undefined })
  }

  const referMutation = useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: FormData }) =>
      portalApi.referJob(jobId, data),
    onSuccess: () => {
      toast.success('Referral submitted successfully!')
      setReferTarget(null)
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.response?.data?.detail || 'Failed to submit referral'
      )
    },
  })

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Candidate portal"
        title="Current openings"
        description="Explore other roles or refer a friend to earn rewards."
      />

      {jobsLoading ? (
        <div className="grid gap-hb-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-56 w-full" rounded="md" />
          ))}
        </div>
      ) : jobsFailed ? (
        <Card padding="none">
          <EmptyState
            tone="error"
            title="Couldn't load open positions"
            description="Check your connection and try again."
            action={{ label: jobsFetching ? 'Retrying…' : 'Try again', onClick: () => refetchJobs() }}
            size="page"
          />
        </Card>
      ) : !jobs?.length ? (
        <Card padding="none">
          <EmptyState
            icon={<Building2 />}
            title="No open positions"
            description="New roles will appear here as soon as they open."
            size="page"
          />
        </Card>
      ) : (
        <div className="grid gap-hb-4 sm:grid-cols-2 xl:grid-cols-3">
          {jobs?.map((job) => {
            const hasApplied = appliedJobIds.has(job.id)

            return (
              <Card key={job.id} padding="default" className="flex h-full flex-col">
                <div className="mb-3">
                  <h3 className="font-display text-hb-h3 text-hb-text">{job.title}</h3>
                  <p className="mt-1 text-hb-xs text-hb-muted">{jobMeta(job)}</p>
                  {job.application_deadline && (
                    <p className="mt-1 text-hb-xs text-hb-muted">
                      Apply by {formatDate(job.application_deadline)}
                    </p>
                  )}
                </div>

                {job.description && (
                  <p className="mb-hb-4 line-clamp-3 text-hb-sm text-hb-muted">{job.description}</p>
                )}

                {job.skills_required && job.skills_required.length > 0 && (
                  <div className="mb-hb-4 flex flex-wrap gap-1.5">
                    {job.skills_required.slice(0, 4).map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                    {job.skills_required.length > 4 && (
                      <Badge>+{job.skills_required.length - 4}</Badge>
                    )}
                  </div>
                )}

                <div className="mt-auto space-y-2 border-t border-hb-border pt-hb-4">
                  {!hasApplied ? (
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => openApply(job)}>
                        Apply now
                      </Button>
                      <Button variant="ghost" className="flex-1" onClick={() => setDetailTarget(job)}>
                        View details
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Badge tone="success" className="flex-1 justify-center py-2">
                        <CheckCircle size={13} aria-hidden /> Applied
                      </Badge>
                      <Button variant="ghost" className="flex-1" onClick={() => setDetailTarget(job)}>
                        View details
                      </Button>
                    </div>
                  )}
                  <Button variant="quiet" size="sm" className="w-full" onClick={() => setReferTarget(job)}>
                    Refer a friend
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Job details ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget?.title ?? 'Position'}
        description={detailTarget ? jobMeta(detailTarget) : undefined}
        size="lg"
        footer={
          detailTarget && (
            <>
              <Button variant="quiet" size="sm" onClick={() => setDetailTarget(null)}>
                Close
              </Button>
              {appliedJobIds.has(detailTarget.id) ? (
                <Badge tone="success" className="py-2">
                  <CheckCircle size={13} aria-hidden /> Applied
                </Badge>
              ) : (
                <Button size="sm" onClick={() => openApply(detailTarget)}>
                  Apply for this role
                </Button>
              )}
            </>
          )
        }
      >
        {detailTarget && (
          <div className="space-y-hb-5">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-hb-xs text-hb-muted">
              {(detailTarget.location || detailTarget.is_remote) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} aria-hidden />
                  {detailTarget.location || 'Remote'}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Briefcase size={13} aria-hidden />
                {JOB_TYPE_LABELS[detailTarget.job_type] ?? detailTarget.job_type}
                {detailTarget.openings > 1 ? ` · ${detailTarget.openings} openings` : ''}
              </span>
              {detailTarget.application_deadline && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={13} aria-hidden />
                  Apply by {formatDate(detailTarget.application_deadline)}
                </span>
              )}
            </div>
            <JobSection title="About the role" text={detailTarget.description} />
            <JobSection title="Responsibilities" text={detailTarget.responsibilities} />
            <JobSection title="Requirements" text={detailTarget.requirements} />
            {detailTarget.skills_required?.length > 0 && (
              <section>
                <h4 className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {detailTarget.skills_required.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              </section>
            )}
            <JobSection title="Benefits" text={detailTarget.benefits} />
          </div>
        )}
      </Dialog>

      {/* ── Apply ─────────────────────────────────────────────────────────── */}
      <Dialog
        open={!!applyTarget}
        onClose={closeApply}
        title={applyTarget ? `Apply for ${applyTarget.title}` : 'Apply'}
        description="Your profile and resume go to the hiring team."
        size="md"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={closeApply} disabled={applyMutation.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitApplication}
              loading={applyMutation.isPending}
              disabled={applyMutation.isPending || (!resumeFile && !resumeOnFile)}
            >
              Submit application
            </Button>
          </>
        }
      >
        <div className="space-y-hb-4">
          {resumeFile ? (
            <div className="flex items-center gap-2.5 rounded-hb-md border border-hb-border bg-hb-surface-2 px-3.5 py-3 text-hb-sm">
              <FileText size={15} aria-hidden className="shrink-0 text-hb-cyan" />
              <span className="min-w-0 flex-1 truncate font-semibold text-hb-text">{resumeFile.name}</span>
              <button
                type="button"
                onClick={() => setResumeFile(null)}
                disabled={applyMutation.isPending}
                aria-label="Remove the attached resume"
                className="rounded-hb-sm p-1 text-hb-muted hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          ) : resumeOnFile ? (
            <p className="flex items-center gap-2.5 rounded-hb-md border border-hb-success/25 bg-hb-success/8 px-3.5 py-3 text-hb-sm text-hb-text">
              <FileText size={15} aria-hidden className="shrink-0 text-hb-success" />
              <span className="min-w-0 truncate">
                Using your resume on file: <strong>{profile?.resume_filename || 'resume'}</strong>
              </span>
            </p>
          ) : (
            <p className="text-hb-sm text-hb-muted">
              Your profile has no resume yet — attach one to apply.
            </p>
          )}

          {resumeError && (
            <p
              role="alert"
              className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 px-3.5 py-2.5 text-hb-xs text-hb-error"
            >
              {resumeError}
            </p>
          )}

          <Dropzone
            onFiles={(files) => pickResume(files[0])}
            accept={RESUME_EXTENSIONS.join(',')}
            title={resumeOnFile || resumeFile ? 'Use a different resume' : 'Attach your resume'}
            description="It also replaces the resume on your profile."
            formats={['PDF', 'DOC', 'DOCX']}
            busy={applyMutation.isPending}
            busyLabel="Submitting & analysing your resume…"
          />
        </div>
      </Dialog>

      {/* ── Referral ──────────────────────────────────────────────────────── */}
      <Dialog
        open={!!referTarget}
        onClose={() => setReferTarget(null)}
        title={referTarget ? `Refer a friend for ${referTarget.title}` : 'Refer a friend'}
        size="md"
        footer={
          <>
            <Button variant="quiet" size="sm" type="button" onClick={() => setReferTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              form="refer-friend"
              loading={referMutation.isPending}
              disabled={referMutation.isPending}
            >
              Submit referral
            </Button>
          </>
        }
      >
        <form
          id="refer-friend"
          className="space-y-hb-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (referMutation.isPending) return
            const formData = new FormData(e.currentTarget)

            // Split the single name input into the first/last the API expects.
            const fullName = (formData.get('referee_full_name') as string) || ''
            const nameParts = fullName.trim().split(' ')
            formData.set('referee_first_name', nameParts[0] || 'Unknown')
            formData.set(
              'referee_last_name',
              nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown'
            )
            formData.delete('referee_full_name')

            referMutation.mutate({ jobId: referTarget.id, data: formData })
          }}
        >
          <div className="grid gap-hb-4 sm:grid-cols-2">
            <Input
              label="Friend's name"
              name="referee_full_name"
              placeholder="e.g. John Doe"
              required
            />
            <Input
              label="Friend's email"
              name="referee_email"
              type="email"
              placeholder="john@example.com"
              required
            />
          </div>

          <div className="grid gap-hb-4 sm:grid-cols-2">
            <Input
              label="Friend's number"
              name="referee_phone"
              type="tel"
              placeholder="e.g. +1 555-0000"
            />
            <Input
              label="LinkedIn profile (optional)"
              name="relationship"
              placeholder="https://linkedin.com/in/…"
            />
          </div>

          <Textarea
            name="reason"
            label="Why are they a good fit?"
            placeholder="Tell us why we should hire your friend…"
            rows={3}
          />

          <Input
            label="Upload resume (optional)"
            name="resume"
            type="file"
            accept=".pdf,.doc,.docx"
          />
        </form>
      </Dialog>
    </div>
  )
}
