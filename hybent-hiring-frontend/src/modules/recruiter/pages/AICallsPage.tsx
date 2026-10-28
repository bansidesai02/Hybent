import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronUp, ExternalLink, PhoneCall, RefreshCw } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useAICallsStatus } from '@/hooks/useAICallsNav'
import { applicationsApi } from '@/api/applications'
import { jobsApi } from '@/api/jobs'
import {
  DECISION_LABEL,
  USE_CASE_LABEL,
  VOICE_CALLS_KEY,
  callStatusLabel,
  callTypeLabel,
  formatWhen,
  voiceCallsApi,
  type VoiceCall,
  type VoiceTab,
} from '@/api/voiceCalls'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
} from '@/components/hb'
import { CallResultView } from '@/modules/recruiter/components/aiCalls/CallResultView'
import { StartAICallDialog } from '@/modules/recruiter/components/aiCalls/StartAICallDialog'
import { errorMessage } from '@/modules/recruiter/components/aiCalls/format'

/**
 * AI Calls — HR's control room for the Hybent AI Agent (Plan §7A).
 *   Queue         scheduled, calling now, being analysed
 *   Needs action  finished calls a recruiter must follow up (no answer after
 *                 every attempt, asked for a human, couldn't start…)
 *   History       every finished call, with its result
 */

type PageTab = Exclude<VoiceTab, 'all'>

const EMPTY: Record<PageTab, { title: string; description: string }> = {
  queue: { title: 'No calls queued', description: 'Pre-screens, availability checks and interview reminders waiting to be called show up here.' },
  needs_action: { title: 'Nothing needs you', description: 'Calls that need a follow-up — no answer, a request for a recruiter, a reschedule — land here.' },
  history: { title: 'No finished calls yet', description: 'Every finished AI call and its result is listed here.' },
}

/* ── Pick candidates for a bulk start ──────────────────────────────────────── */

function PickCandidatesDialog({ onClose, onPicked }: {
  onClose: () => void
  onPicked: (jobId: string, candidates: Array<{ id: string; full_name: string }>) => void
}) {
  const [jobId, setJobId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { data: jobs } = useQuery({
    queryKey: ['jobs', 'active-for-ai-calls'],
    queryFn: () => jobsApi.list({ status: 'active', limit: 100 }).then((r: any) => (r.data?.items ?? r.data ?? []) as Array<{ id: string; title: string }>),
  })
  const picked = jobId || jobs?.[0]?.id || ''
  const { data: apps, isLoading } = useQuery({
    queryKey: ['applications', 'for-ai-calls', picked],
    queryFn: () => applicationsApi.list({ job_id: picked, limit: 100 }).then((r: any) => r.data.items as any[]),
    enabled: !!picked,
  })
  const people = (apps ?? [])
    .filter((a) => a.candidate && !['rejected', 'hired', 'withdrawn'].includes(a.stage))
    .map((a) => ({ id: a.candidate.id as string, full_name: a.candidate.full_name as string, stage: a.stage as string }))

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title="Start AI pre-screens"
      description="Pick a job, then the applicants to call. Candidates without AI call consent or a phone number are skipped and listed."
      footer={
        <>
          <Button variant="quiet" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!selected.size}
                  onClick={() => onPicked(picked, people.filter((p) => selected.has(p.id)))}>
            Continue with {selected.size || ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-hb-3 pb-2">
        <Select label="Job" options={(jobs ?? []).map((j) => ({ value: j.id, label: j.title }))} value={picked}
                onChange={(e) => { setJobId(e.target.value); setSelected(new Set()) }} />
        {isLoading ? (
          <Skeleton className="h-40 w-full" rounded="md" />
        ) : people.length === 0 ? (
          <p className="text-hb-sm text-hb-muted">No active applicants for this job.</p>
        ) : (
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-hb-sm border border-hb-border p-2">
            <Checkbox label={selected.size === people.length ? 'Clear selection' : 'Select all'}
                      checked={selected.size === people.length}
                      onChange={(e) => setSelected(e.target.checked ? new Set(people.map((p) => p.id)) : new Set())} />
            {people.map((p) => (
              <Checkbox key={p.id}
                        label={<span>{p.full_name} <span className="text-hb-dim">· {p.stage.replace(/_/g, ' ')}</span></span>}
                        checked={selected.has(p.id)}
                        onChange={(e) => setSelected((s) => {
                          const next = new Set(s)
                          if (e.target.checked) next.add(p.id)
                          else next.delete(p.id)
                          return next
                        })} />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  )
}

/* ── One row ───────────────────────────────────────────────────────────────── */

function CallRow({ call, tab, onOpenProfile }: { call: VoiceCall; tab: PageTab; onOpenProfile: (id: string) => void }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data: detail, isLoading } = useQuery({
    queryKey: [...VOICE_CALLS_KEY, 'detail', call.id],
    queryFn: () => voiceCallsApi.get(call.id).then((r) => r.data),
    enabled: open,
  })
  const act = useMutation({
    mutationFn: (kind: 'cancel' | 'resolve') =>
      kind === 'cancel' ? voiceCallsApi.cancel(call.id) : voiceCallsApi.resolve(call.id),
    onSuccess: (_d, kind) => {
      toast.success(kind === 'cancel' ? 'Further attempts cancelled' : 'Marked as handled')
      queryClient.invalidateQueries({ queryKey: VOICE_CALLS_KEY })
    },
    onError: (err) => toast.error(errorMessage(err, "That didn't go through")),
  })
  const decision = call.hr_override?.decision ?? call.decision
  const when = call.task_status === 'SCHEDULED' ? null : formatWhen(call.updated_at)

  return (
    <Card padding="compact">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={call.candidate_name ?? '?'} size="sm" />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onOpenProfile(call.candidate_id)}
                  className="group inline-flex items-center gap-1.5 text-hb-sm font-semibold text-hb-text hover:text-hb-blue">
            {call.candidate_name ?? 'Candidate'}
            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100" aria-hidden />
          </button>
          <p className="truncate text-hb-xs text-hb-muted">
            {callTypeLabel(call)}{call.job_title ? ` · ${call.job_title}` : ''}{when ? ` · ${when}` : ''}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-hb-xs text-hb-muted">
          {call.task_status === 'IN_CALL' && <PhoneCall size={12} className="animate-pulse text-hb-blue" aria-hidden />}
          {callStatusLabel(call)}
        </span>
        {decision && <Badge tone={DECISION_LABEL[decision].tone}>{DECISION_LABEL[decision].label}</Badge>}
        {call.use_case_outcome && (
          <Badge tone={USE_CASE_LABEL[call.use_case_outcome].tone}>{USE_CASE_LABEL[call.use_case_outcome].label}</Badge>
        )}
        <div className="flex gap-1">
          {tab === 'queue' && call.task_status === 'SCHEDULED' && (
            <Button variant="quiet" size="sm" loading={act.isPending} onClick={() => act.mutate('cancel')}>Cancel</Button>
          )}
          {tab === 'needs_action' && (
            <Button variant="ghost" size="sm" loading={act.isPending} onClick={() => act.mutate('resolve')}>Mark handled</Button>
          )}
          {call.final && call.task_status !== 'FAILED_TO_START' && (
            <Button variant="quiet" size="sm" aria-expanded={open}
                    icon={open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide' : 'Result'}
            </Button>
          )}
        </div>
      </div>
      {call.task_status === 'FAILED_TO_START' && call.error && (
        <p className="mt-2 text-hb-xs text-hb-error">{call.error}</p>
      )}
      {open && <div className="mt-3">{isLoading || !detail ? <Skeleton className="h-40 w-full" rounded="md" /> : <CallResultView call={detail} />}</div>}
    </Card>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function AICallsPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const { enabled, known } = useAICallsStatus()
  const [tab, setTab] = useState<PageTab>('queue')
  const [picking, setPicking] = useState(false)
  const [starting, setStarting] = useState<{ jobId: string; candidates: Array<{ id: string; full_name: string }> } | null>(null)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [...VOICE_CALLS_KEY, 'list', tab],
    queryFn: () => voiceCallsApi.list(tab).then((r) => r.data),
    refetchInterval: tab === 'queue' ? 15_000 : 60_000,
    enabled,
  })
  const counts = data?.counts

  const openProfile = (candidateId: string) =>
    navigate(`${basePath}/candidates?openId=${encodeURIComponent(candidateId)}`)

  // Switched off for this organization (by Hybent): the page isn't available.
  if (known && !enabled) return <Navigate to={basePath} replace />

  return (
    <div className="flex flex-col gap-hb-5">
      <PageHeader
        eyebrow="Hybent AI Agent"
        title="AI Calls"
        description="The AI Agent phones candidates, asks the screening questions and summarises the answers. It only recommends — you decide."
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={<RefreshCw size={14} className={isFetching ? 'animate-spin' : undefined} />}
                    onClick={() => refetch()}>
              Refresh
            </Button>
            {enabled && (
              <Button size="sm" icon={<PhoneCall size={14} />} onClick={() => setPicking(true)}>Start AI pre-screens</Button>
            )}
          </div>
        }
      />

      {!enabled ? (
        <Card padding="default">
          <EmptyState title="AI Calls are off for your workspace"
                      description="Ask Hybent to switch on AI calling for your organization." />
        </Card>
      ) : (
        <>
          <Tabs
            aria-label="AI call lists"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'queue', label: 'Queue', count: counts?.queue },
              { value: 'needs_action', label: 'Needs action', count: counts?.needs_action },
              { value: 'history', label: 'History', count: counts?.history },
            ]}
          />
          {isLoading ? (
            <div className="flex flex-col gap-hb-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" rounded="md" />)}
            </div>
          ) : !data?.items.length ? (
            <Card padding="default"><EmptyState {...EMPTY[tab]} /></Card>
          ) : (
            <div className="flex flex-col gap-hb-3">
              {data.items.map((c) => <CallRow key={c.id} call={c} tab={tab} onOpenProfile={openProfile} />)}
            </div>
          )}
        </>
      )}

      {picking && (
        <PickCandidatesDialog
          onClose={() => setPicking(false)}
          onPicked={(jobId, candidates) => { setPicking(false); setStarting({ jobId, candidates }) }}
        />
      )}
      {starting && (
        <StartAICallDialog candidates={starting.candidates} defaultJobId={starting.jobId} onClose={() => setStarting(null)} />
      )}
    </div>
  )
}
