import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { BriefcaseBusiness, ExternalLink, Mic, Plus } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { jobsApi } from '@/api/jobs'
import {
  preScreeningApi,
  type PreScreeningListItem,
  type PreScreeningSession,
} from '@/api/preScreening'
import { PreScreeningSessionView } from '@/modules/interviewer/components/PreScreening/PreScreeningSessionView'
import { formatDate } from '@/utils/formatters'
import type { Candidate } from '@/types'
import { Button, Dialog, EmptyState, Select, Skeleton, StatusPill } from '@/components/hb'

/**
 * AI pre-screening sessions for one candidate.
 *
 * Two navigation bugs fixed while migrating: "Open full review" pointed at
 * `/admin/pre-screening/â€¦` and the post-create redirect at
 * `/recruiter/pre-screening/â€¦`. Neither is a route â€” both live under `/hiring`,
 * so both silently bounced the user to the marketing homepage. They now use
 * `basePath`, which is also correct for the admin who reaches this same view.
 */

function SessionCard({
  session,
  active,
  onSelect,
}: {
  session: PreScreeningListItem
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        'flex min-w-[172px] flex-col gap-1.5 rounded-hb-sm border p-3 text-left transition-all duration-hb ease-hb focus-visible:outline-none focus-visible:shadow-hb-ring ' +
        (active
          ? 'border-hb-blue/40 bg-hb-blue/8'
          : 'border-hb-border bg-hb-surface hover:border-hb-border-strong hover:bg-hb-surface-2')
      }
    >
      <span className="flex items-center justify-between gap-2">
        <StatusPill status={session.status} />
        <span className="font-mono text-hb-micro text-hb-dim">
          {formatDate(session.created_at)}
        </span>
      </span>

      {session.job_title && (
        <span className="flex items-center gap-1.5 truncate text-hb-xs font-semibold text-hb-text">
          <BriefcaseBusiness size={12} aria-hidden />
          {session.job_title}
        </span>
      )}

      <span className="flex items-center gap-1.5 text-hb-xs text-hb-muted">
        <Mic size={11} aria-hidden />
        {session.response_count} response{session.response_count === 1 ? '' : 's'}
      </span>
    </button>
  )
}

export function PreScreenTab({ candidate }: { candidate: Candidate }) {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const { data: sessions = [], isLoading } = useQuery<PreScreeningListItem[]>({
    queryKey: ['pre-screening-list', candidate.id],
    queryFn: () =>
      preScreeningApi.listSessions({ candidate_id: candidate.id }).then((r) => r.data),
  })

  /* Most recent session is opened by default; the list is already newest-first. */
  useEffect(() => {
    if (sessions.length > 0 && !selectedId) setSelectedId(sessions[0].id)
  }, [sessions, selectedId])

  const { data: session, isLoading: detailLoading } = useQuery<PreScreeningSession>({
    queryKey: ['pre-screening', selectedId],
    queryFn: () => preScreeningApi.getSession(selectedId!).then((r) => r.data),
    enabled: !!selectedId,
  })

  const summarise = useMutation({
    mutationFn: () => preScreeningApi.summariseSession(selectedId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre-screening', selectedId] })
      toast.success('AI summary generated')
    },
    onError: () => toast.error('Failed to generate summary'),
  })

  if (isLoading) {
    return (
      <div className="space-y-hb-3">
        <Skeleton className="h-20 w-full" rounded="md" />
        <Skeleton className="h-40 w-full" rounded="md" />
      </div>
    )
  }

  return (
    <div className="space-y-hb-4">
      {sessions.length === 0 ? (
        <EmptyState
          icon={<Mic />}
          title="No pre-screening yet"
          description="Send an invite and Hybent AI generates ten personalised questions for the candidate to answer before the interview."
          action={{ label: 'Send pre-screen invite', onClick: () => setInviteOpen(true) }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-stretch gap-2.5">
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                active={s.id === selectedId}
                onSelect={() => setSelectedId(s.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex min-w-[112px] items-center justify-center gap-1.5 rounded-hb-sm border border-dashed border-hb-border-strong px-4 text-hb-sm font-semibold text-hb-dim transition-colors duration-hb hover:border-hb-blue/40 hover:text-hb-blue focus-visible:outline-none focus-visible:shadow-hb-ring"
            >
              <Plus size={14} aria-hidden />
              New
            </button>
          </div>

          {selectedId &&
            (detailLoading || !session ? (
              <Skeleton className="h-52 w-full" rounded="md" />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {session.job_title && <StatusPill status="active" label={session.job_title} />}
                    {session.completed_at && (
                      <span className="text-hb-xs text-hb-muted">
                        Completed {formatDate(session.completed_at)}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ExternalLink size={13} />}
                    to={`${basePath}/pre-screening/${session.id}`}
                  >
                    Open full review
                  </Button>
                </div>

                <PreScreeningSessionView
                  session={session}
                  onSummarise={() => summarise.mutate()}
                  summarising={summarise.isPending}
                />
              </>
            ))}
        </>
      )}

      <InviteDialog
        open={inviteOpen}
        candidate={candidate}
        onClose={() => setInviteOpen(false)}
        onCreated={(id) => {
          setInviteOpen(false)
          navigate(`${basePath}/pre-screening/${id}`)
        }}
      />
    </div>
  )
}

function InviteDialog({
  open,
  candidate,
  onClose,
  onCreated,
}: {
  open: boolean
  candidate: Candidate
  onClose: () => void
  onCreated: (sessionId: string) => void
}) {
  const [jobId, setJobId] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: jobsData } = useQuery({
    queryKey: ['jobs-list-for-prescreening'],
    queryFn: () => jobsApi.list({ limit: 50, status: 'active' }).then((r) => r.data),
    enabled: open,
  })

  const jobs: any[] = (jobsData as any)?.items ?? (Array.isArray(jobsData) ? jobsData : [])

  const create = async () => {
    setBusy(true)
    try {
      const res = await preScreeningApi.createSession({
        candidate_id: candidate.id,
        job_id: jobId || undefined,
      })
      toast.success(`Pre-screening invite sent to ${candidate.email}`)
      onCreated(res.data.id)
    } catch (err: any) {
      const detail: string = err?.response?.data?.detail || ''
      /* 409 means a finished session already exists â€” opening it is more useful
         than telling the recruiter they cannot create another. */
      if (err?.response?.status === 409 && detail.startsWith('completed_session:')) {
        toast.success('A completed pre-screening already exists â€” opening it.')
        onCreated(detail.split(':')[1])
      } else {
        toast.error(detail || 'Failed to create pre-screening session')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Request pre-screening"
      description={`Hybent AI generates ten personalised questions and emails an invite to ${candidate.email}.`}
      footer={
        <>
          <Button variant="quiet" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" loading={busy} onClick={create}>
            Send invite
          </Button>
        </>
      }
    >
      <div className="pb-2">
        <Select
          label="Job"
          description="Optional. Tailors the questions to a specific opening."
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          options={[
            { value: '', label: 'No specific job' },
            ...jobs.map((j) => ({ value: j.id, label: j.title })),
          ]}
        />
      </div>
    </Dialog>
  )
}
