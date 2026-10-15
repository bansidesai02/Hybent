import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  Copy,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Share2,
} from 'lucide-react'

import { portalApi } from '@/api/portal'
import { Job, Application } from '@/types'
import { formatDate } from '@/utils/formatters'
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, Skeleton } from '@/components/hb'

/**
 * The org's open roles, for the candidate to pass on to friends.
 *
 * A candidate only reaches the portal once a recruiter has taken them into a
 * position, so this page is not for applying again: each role has its details
 * and a shareable link to the public apply page. Whoever opens the link
 * applies themselves there (resume parsed and scored like any link
 * application), recorded with source "referral". This replaced a form where
 * the candidate typed in their friend's details and resume for them.
 */

type PortalJob = Job & { org_slug?: string | null }

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  remote: 'Remote',
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

function applyLink(job: PortalJob): string | null {
  if (!job.org_slug) return null
  return `${window.location.origin}/apply/${job.org_slug}/${job.id}?source=referral`
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

function ShareOption({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex flex-1 items-center justify-center gap-2 rounded-hb-md border border-hb-border bg-hb-surface px-3 py-2.5 text-hb-sm font-semibold text-hb-text transition-colors duration-hb hover:border-hb-border-strong hover:bg-hb-surface-2 focus-visible:outline-none focus-visible:shadow-hb-ring"
    >
      {icon}
      {label}
    </a>
  )
}

export default function PortalOpenings() {
  const [detailTarget, setDetailTarget] = useState<PortalJob | null>(null)
  const [shareTarget, setShareTarget] = useState<PortalJob | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    data: jobs,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<PortalJob[]>({
    queryKey: ['portal', 'jobs'],
    queryFn: () => portalApi.jobs().then((r: any) => r.data),
  })

  const { data: applications } = useQuery<Application[]>({
    queryKey: ['portal', 'applications'],
    queryFn: () => portalApi.myApplications().then((r: any) => r.data),
  })
  const myJobIds = new Set(applications?.map((app) => app.job_id))

  const openShare = (job: PortalJob) => {
    setDetailTarget(null)
    setCopied(false)
    setShareTarget(job)
  }

  const shareUrl = shareTarget ? applyLink(shareTarget) : null
  const shareText = shareTarget ? `We're hiring a ${shareTarget.title}. Have a look and apply here:` : ''

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy — select the link and copy it manually.')
    }
  }

  const nativeShare = async () => {
    if (!shareUrl || !shareTarget) return
    try {
      await navigator.share({ title: shareTarget.title, text: shareText, url: shareUrl })
    } catch {
      /* Dismissed by the user — nothing to do. */
    }
  }

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Candidate portal"
        title="Current openings"
        description="Know someone who'd be a great fit? Share a role and they can apply directly."
      />

      {isLoading ? (
        <div className="grid gap-hb-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-56 w-full" rounded="md" />
          ))}
        </div>
      ) : isError ? (
        <Card padding="none">
          <EmptyState
            tone="error"
            title="Couldn't load open positions"
            description="Check your connection and try again."
            action={{ label: isFetching ? 'Retrying…' : 'Try again', onClick: () => refetch() }}
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
          {jobs.map((job) => (
            <Card key={job.id} padding="default" className="flex h-full flex-col">
              <div className="mb-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-hb-h3 text-hb-text">{job.title}</h3>
                  {myJobIds.has(job.id) && (
                    <Badge tone="brand" className="shrink-0">Your role</Badge>
                  )}
                </div>
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

              {job.skills_required?.length > 0 && (
                <div className="mb-hb-4 flex flex-wrap gap-1.5">
                  {job.skills_required.slice(0, 4).map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                  {job.skills_required.length > 4 && <Badge>+{job.skills_required.length - 4}</Badge>}
                </div>
              )}

              <div className="mt-auto flex gap-2 border-t border-hb-border pt-hb-4">
                <Button className="flex-1" icon={<Share2 size={15} />} onClick={() => openShare(job)}>
                  Share job link
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setDetailTarget(job)}>
                  View details
                </Button>
              </div>
            </Card>
          ))}
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
              <Button size="sm" icon={<Share2 size={14} />} onClick={() => openShare(detailTarget)}>
                Share job link
              </Button>
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

      {/* ── Share ─────────────────────────────────────────────────────────── */}
      <Dialog
        open={!!shareTarget}
        onClose={() => setShareTarget(null)}
        title={shareTarget ? `Share ${shareTarget.title}` : 'Share job'}
        description="Send this link to a friend — they can read the role and apply directly."
        size="md"
        footer={
          <Button variant="quiet" size="sm" onClick={() => setShareTarget(null)}>
            Done
          </Button>
        }
      >
        {shareUrl ? (
          <div className="space-y-hb-4">
            <div className="flex items-center gap-2 rounded-hb-md border border-hb-border bg-hb-surface-2 p-1.5 pl-3.5">
              <input
                readOnly
                value={shareUrl}
                aria-label="Job link"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent text-hb-sm text-hb-text outline-none"
              />
              <Button size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copyLink}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <ShareOption
                href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                icon={<MessageCircle size={15} aria-hidden />}
                label="WhatsApp"
              />
              <ShareOption
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                icon={<Link2 size={15} aria-hidden />}
                label="LinkedIn"
              />
              <ShareOption
                href={`mailto:?subject=${encodeURIComponent(`Job opening: ${shareTarget?.title ?? ''}`)}&body=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`}
                icon={<Mail size={15} aria-hidden />}
                label="Email"
              />
            </div>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <Button variant="ghost" className="w-full" icon={<Share2 size={15} />} onClick={nativeShare}>
                More sharing options
              </Button>
            )}
          </div>
        ) : (
          <p className="text-hb-sm text-hb-muted">This role's link isn't available right now. Please try again later.</p>
        )}
      </Dialog>
    </div>
  )
}
