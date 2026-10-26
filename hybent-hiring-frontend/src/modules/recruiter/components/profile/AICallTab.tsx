import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarClock, PhoneCall, ShieldCheck, ShieldOff } from 'lucide-react'

import {
  VOICE_CALLS_KEY,
  callStatusLabel,
  callTypeLabel,
  formatWhen,
  voiceCallsApi,
  type VoiceCallDetail,
} from '@/api/voiceCalls'
import type { Candidate } from '@/types'
import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/hb'

import { AvailabilityDialog } from '../aiCalls/AvailabilityDialog'
import { CallResultView } from '../aiCalls/CallResultView'
import { StartAICallDialog } from '../aiCalls/StartAICallDialog'
import { errorMessage } from '../aiCalls/format'

/**
 * The candidate's AI calls (Plan §7A "Candidate → AI Call tab"): consent
 * state, a button to start a pre-screen, and every call's result, newest first.
 */

const ACTIVE = new Set(['SCHEDULED', 'IN_CALL', 'ANALYZING'])

function CallInProgress({ call }: { call: VoiceCallDetail }) {
  const queryClient = useQueryClient()
  const cancel = useMutation({
    mutationFn: () => voiceCallsApi.cancel(call.id),
    onSuccess: () => {
      toast.success('Further attempts cancelled')
      queryClient.invalidateQueries({ queryKey: VOICE_CALLS_KEY })
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't cancel")),
  })
  return (
    <Card padding="default">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-hb-full bg-hb-blue/10 text-hb-blue">
            <PhoneCall size={16} aria-hidden className={call.task_status === 'IN_CALL' ? 'animate-pulse' : undefined} />
          </span>
          <div>
            <p className="text-hb-sm font-semibold text-hb-text">{callStatusLabel(call)}</p>
            <p className="text-hb-xs text-hb-muted">
              {callTypeLabel(call)}{call.job_title ? ` · ${call.job_title}` : ''} · attempt {Math.max(call.attempt_no, 1)}
            </p>
          </div>
        </div>
        {call.task_status === 'SCHEDULED' && (
          <Button variant="quiet" size="sm" loading={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  )
}

export function AICallTab({ candidate }: { candidate: Candidate }) {
  const queryClient = useQueryClient()
  const [starting, setStarting] = useState(false)
  const [checking, setChecking] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: [...VOICE_CALLS_KEY, 'candidate', candidate.id],
    queryFn: () => voiceCallsApi.forCandidate(candidate.id).then((r) => r.data),
    // Poll while a call is underway so the result appears without a reload.
    refetchInterval: (q) => (q.state.data?.calls.some((c) => ACTIVE.has(c.task_status)) ? 15_000 : false),
  })

  const consent = useMutation({
    mutationFn: () => voiceCallsApi.recordConsent(candidate.id),
    onSuccess: () => {
      toast.success('Consent recorded')
      queryClient.invalidateQueries({ queryKey: [...VOICE_CALLS_KEY, 'candidate', candidate.id] })
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't record consent")),
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-hb-3 pt-hb-4">
        <Skeleton className="h-16 w-full" rounded="md" />
        <Skeleton className="h-48 w-full" rounded="md" />
      </div>
    )
  }

  const active = data.calls.filter((c) => ACTIVE.has(c.task_status))
  const finished = data.calls.filter((c) => !ACTIVE.has(c.task_status))
  const consented = !!data.consent_at && !data.opted_out_at
  const canCall = consented && !active.some((c) => c.type === 'PRESCREEN')
  const canCheck = consented && !active.some((c) => c.type === 'AVAILABILITY')

  return (
    <div className="flex flex-col gap-hb-4 pt-hb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-hb-xs text-hb-muted">
          {data.opted_out_at ? (
            <Badge tone="error"><ShieldOff size={11} aria-hidden /> Opted out of AI calls</Badge>
          ) : data.consent_at ? (
            <Badge tone="success"><ShieldCheck size={11} aria-hidden /> AI call consent</Badge>
          ) : (
            <Badge tone="warning">No AI call consent</Badge>
          )}
          {data.consent_at && !data.opted_out_at && (
            <span>
              {data.consent_source === 'APPLICATION_FORM' ? 'Given on the application form' : 'Recorded by HR'}, {formatWhen(data.consent_at)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!data.consent_at && !data.opted_out_at && (
            <Button variant="ghost" size="sm" loading={consent.isPending}
                    title="Only if the candidate agreed to an AI call, e.g. on the phone or by email"
                    onClick={() => consent.mutate()}>
              Record consent
            </Button>
          )}
          <Button variant="ghost" size="sm" icon={<CalendarClock size={13} />} disabled={!canCheck} onClick={() => setChecking(true)}>
            Check availability
          </Button>
          <Button size="sm" icon={<PhoneCall size={13} />} disabled={!canCall} onClick={() => setStarting(true)}>
            Start AI pre-screen
          </Button>
        </div>
      </div>

      {active.map((c) => <CallInProgress key={c.id} call={c} />)}

      {finished.length === 0 && active.length === 0 ? (
        <Card padding="default">
          <EmptyState
            title="No AI calls yet"
            description={
              data.consent_at
                ? 'Start an AI pre-screen and the Hybent AI Agent will phone the candidate, ask the screening questions and summarise the answers here.'
                : 'AI calls need the candidate’s consent — from the application form, or recorded here once they agree.'
            }
          />
        </Card>
      ) : (
        finished.map((c) => <CallResultView key={c.id} call={c} />)
      )}

      {starting && <StartAICallDialog candidates={[candidate]} onClose={() => setStarting(false)} />}
      {checking && <AvailabilityDialog candidate={candidate} onClose={() => setChecking(false)} />}
    </div>
  )
}
