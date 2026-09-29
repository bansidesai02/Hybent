import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Building2, CheckCircle, Lightbulb } from 'lucide-react'

import { portalApi } from '@/api/portal'
import { Job, Application } from '@/types'
import {
  Badge,
  Button,
  Card,
  Dialog,
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
 */

export default function PortalOpenings() {
  const queryClient = useQueryClient()
  const [referTarget, setReferTarget] = useState<any>(null)
  const [applyTarget, setApplyTarget] = useState<Job | null>(null)

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['portal', 'jobs'],
    queryFn: () => portalApi.jobs().then((r: any) => r.data),
  })

  const { data: applications } = useQuery<Application[]>({
    queryKey: ['portal', 'applications'],
    queryFn: () => portalApi.myApplications().then((r: any) => r.data),
  })

  const appliedJobIds = new Set(applications?.map((app: Application) => app.job_id))

  const applyMutation = useMutation({
    mutationFn: (jobId: string) => portalApi.applyToJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'applications'] })
      toast.success('Application submitted successfully!')
      setApplyTarget(null)
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.response?.data?.detail || 'Failed to submit application'
      )
      setApplyTarget(null)
    },
  })

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
      ) : jobs?.length === 0 ? (
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
                  <p className="mt-1 text-hb-xs text-hb-muted">
                    {job.department || 'General'} · {job.location || 'Remote'}
                  </p>
                </div>

                {job.skills_required && job.skills_required.length > 0 && (
                  <div className="mb-hb-4 flex flex-wrap gap-1.5">
                    {job.skills_required.slice(0, 4).map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex gap-2 border-t border-hb-border pt-hb-4">
                  {!hasApplied ? (
                    <>
                      <Button className="flex-1" onClick={() => setApplyTarget(job)}>
                        Apply now
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex-1"
                        onClick={() => setReferTarget(job)}
                      >
                        Refer a friend
                      </Button>
                    </>
                  ) : (
                    <Badge tone="success" className="w-full justify-center py-2">
                      <CheckCircle size={13} aria-hidden /> Applied
                    </Badge>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Apply confirmation ────────────────────────────────────────────── */}
      <Dialog
        open={!!applyTarget}
        onClose={() => setApplyTarget(null)}
        title="Confirm application"
        description={
          applyTarget
            ? `You are about to apply for ${applyTarget.title}. Your current resume and profile will be submitted to the recruiter.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setApplyTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!applyMutation.isPending && applyTarget) applyMutation.mutate(applyTarget.id)
              }}
              loading={applyMutation.isPending}
              disabled={applyMutation.isPending}
            >
              Submit application
            </Button>
          </>
        }
      >
        <p className="flex items-start gap-2.5 rounded-hb-md border border-hb-warning/25 bg-hb-warning/8 px-3.5 py-3 text-hb-xs text-hb-text">
          <Lightbulb size={15} aria-hidden className="mt-0.5 shrink-0 text-hb-warning" />
          Make sure your resume is up to date in your profile before applying.
        </p>
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
