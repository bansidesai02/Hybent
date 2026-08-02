/**
 * Pre-Screening Review Page â€” HR / Recruiter
 * Listen to candidate audio responses, read transcripts, generate AI summary.
 *
 * Two navigation bugs fixed while migrating. "Back to candidate" pointed at
 * `/recruiter/candidates?â€¦`, which is not a route â€” the real one lives under
 * `/hiring` â€” so it bounced the user to the marketing homepage. The proceed CTA
 * was hardcoded to `/hiring/recruiter/interviews`, which an admin reaching this
 * same page (AdminRoutes mounts it too) is not authorised for. Both now build
 * from `basePath`.
 */
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Calendar, Mic, Briefcase, CheckCircle2 } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { preScreeningApi, type PreScreeningSession } from '@/api/preScreening'
import { PreScreeningSessionView } from '@/modules/interviewer/components/PreScreening/PreScreeningSessionView'
import { formatDate } from '@/utils/formatters'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusPill,
} from '@/components/hb'

function MetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-hb-sm text-hb-muted">
      <span className="shrink-0 text-hb-dim [&>svg]:block" aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  )
}

export default function PreScreeningReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { basePath } = useAuth()

  const { data: session, isLoading, error } = useQuery<PreScreeningSession>({
    queryKey: ['pre-screening', sessionId],
    queryFn: async () => {
      const res = await preScreeningApi.getSession(sessionId!)
      return res.data
    },
    enabled: !!sessionId,
  })

  const summariseMutation = useMutation({
    mutationFn: () => preScreeningApi.summariseSession(sessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre-screening', sessionId] })
      toast.success('AI summary generated successfully')
    },
    onError: () => {
      toast.error('Failed to generate AI summary')
    },
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-hb-page pb-hb-10">
        <Skeleton className="mb-3 h-4 w-36" />
        <div className="mb-hb-6 flex items-center gap-3">
          <Skeleton className="h-12 w-12" rounded="full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3.5 w-40" />
          </div>
        </div>
        <Skeleton className="mb-hb-5 h-14 w-full" rounded="md" />
        <Skeleton className="h-52 w-full" rounded="md" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-hb-page pb-hb-10">
        <EmptyState
          tone="error"
          size="page"
          title="Session not found"
          description="This pre-screening session does not exist, or you don't have access to it."
          action={{ label: 'Go back', onClick: () => navigate(-1) }}
        />
      </div>
    )
  }

  const candidateName = session.candidate_name || 'Candidate'

  /* The candidate id is passed through router state by the pipeline, which knows
     it before the session loads; the session itself is the fallback. */
  const backToCandidate = () => {
    const candidateId =
      (location.state as { candidateId?: string } | null)?.candidateId ?? session.candidate_id
    navigate(`${basePath}/candidates?openId=${candidateId}&tab=prescreen`)
  }

  return (
    <div className="mx-auto max-w-hb-page pb-hb-10">
      <button
        type="button"
        onClick={backToCandidate}
        className="mb-3 inline-flex items-center gap-1.5 text-hb-sm text-hb-muted transition-colors duration-hb hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring"
      >
        <ArrowLeft size={15} aria-hidden />
        Back to candidate
      </button>

      <PageHeader
        eyebrow="Pre-screening"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={candidateName} size="lg" />
            <span className="min-w-0 truncate">{candidateName}</span>
          </span>
        }
        description={session.candidate_email}
        actions={<StatusPill status={session.status} />}
      />

      <Card padding="compact" className="mb-hb-5">
        <div className="flex flex-wrap items-center gap-x-hb-6 gap-y-hb-2">
          {session.job_title && (
            <span className="flex items-center gap-2 text-hb-sm font-semibold text-hb-text">
              <Briefcase size={14} aria-hidden className="shrink-0 text-hb-dim" />
              {session.job_title}
            </span>
          )}
          <MetaItem icon={<Calendar size={14} />}>Created {formatDate(session.created_at)}</MetaItem>
          {session.completed_at && (
            <MetaItem icon={<CheckCircle2 size={14} />}>
              Completed {formatDate(session.completed_at)}
            </MetaItem>
          )}
          <MetaItem icon={<Mic size={14} />}>
            {session.responses.length} / {session.questions.length} answered
          </MetaItem>
        </div>
      </Card>

      {/* Shared session view: AI summary + responses */}
      <PreScreeningSessionView
        session={session}
        onSummarise={() => summariseMutation.mutate()}
        summarising={summariseMutation.isPending}
      />

      {session.status === 'completed' && (
        <div className="mt-hb-6 flex justify-end border-t border-hb-border pt-hb-4">
          <Button
            icon={<Calendar size={16} />}
            to={`${basePath}/interviews`}
          >
            Proceed to schedule interview
          </Button>
        </div>
      )}
    </div>
  )
}
