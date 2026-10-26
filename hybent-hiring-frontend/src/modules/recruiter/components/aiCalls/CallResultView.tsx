import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, CalendarCheck, ChevronDown, ChevronUp, Clock, Globe, MessageCircleQuestion, UserCheck } from 'lucide-react'

import {
  DECISION_LABEL,
  USE_CASE_LABEL,
  VOICE_CALLS_KEY,
  callStatusLabel,
  callTypeLabel,
  formatDuration,
  formatWhen,
  voiceCallsApi,
  type VoiceCallDetail,
  type VoiceDecision,
} from '@/api/voiceCalls'
import { Badge, Button, Card, Dialog, Meter, Select, Textarea } from '@/components/hb'

import {
  ANSWER_ORDER,
  COMMUNICATION_DIMENSIONS,
  RAW_KEY,
  answerLabel,
  errorMessage,
  formatAnswer,
  scoreTone,
} from './format'

/**
 * One AI pre-screen result (Plan §7A): the recommendation first, then each
 * answer with the candidate's own words, communication scores, red flags,
 * the candidate's questions and the transcript.
 */

const DECISION_OPTIONS = (Object.keys(DECISION_LABEL) as VoiceDecision[]).map((d) => ({
  value: d,
  label: DECISION_LABEL[d].label,
}))

function OverrideDialog({ call, onClose }: { call: VoiceCallDetail; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<VoiceDecision>(call.hr_override?.decision ?? call.decision ?? 'HOLD')
  const [note, setNote] = useState(call.hr_override?.note ?? '')
  const save = useMutation({
    mutationFn: () => voiceCallsApi.override(call.id, decision, note || undefined),
    onSuccess: () => {
      toast.success('Decision saved')
      queryClient.invalidateQueries({ queryKey: VOICE_CALLS_KEY })
      onClose()
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't save the decision")),
  })
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="Your decision"
      description="The AI only recommends. Your decision is what the team sees, and it helps tune the AI's thresholds."
      footer={
        <>
          <Button variant="quiet" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-hb-4 pb-2">
        <Select label="Decision" options={DECISION_OPTIONS} value={decision}
                onChange={(e) => setDecision(e.target.value as VoiceDecision)} />
        <Textarea label="Note" description="Optional. Why you decided differently." rows={3}
                  value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </div>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="font-mono text-hb-label uppercase text-hb-dim">{title}</h4>
      {children}
    </section>
  )
}

function Transcript({ call }: { call: VoiceCallDetail }) {
  const [open, setOpen] = useState(false)
  if (!call.transcript.length) return null
  return (
    <div>
      <Button variant="quiet" size="sm" icon={open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide transcript' : 'Show transcript'}
      </Button>
      {open && (
        <ol className="mt-2 flex flex-col gap-2 rounded-hb-sm bg-hb-surface-2 p-3">
          {call.transcript.map((t, i) => (
            <li key={i} className="text-hb-sm">
              <span className={t.role === 'assistant' ? 'font-semibold text-hb-blue' : 'font-semibold text-hb-text'}>
                {t.role === 'assistant' ? 'AI Agent' : 'Candidate'}:
              </span>{' '}
              <span className="text-hb-text">{t.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Availability check / interview reminder result (Spec §6.6, §7.5). */
function UseCaseResultView({ call }: { call: VoiceCallDetail }) {
  const r = call.result?.structured_data.result ?? {}
  const outcome = call.use_case_outcome ?? r.outcome
  return (
    <Card padding="default">
      <div className="flex flex-col gap-hb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={outcome ? USE_CASE_LABEL[outcome].tone : 'neutral'}>
              {outcome ? USE_CASE_LABEL[outcome].label : callStatusLabel(call)}
            </Badge>
            <span className="text-hb-xs font-semibold text-hb-muted">{callTypeLabel(call)}</span>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-hb-xs text-hb-muted">
            {call.started_at && <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden />{formatWhen(call.started_at)}</span>}
            {call.duration_sec != null && <span>{formatDuration(call.duration_sec)}</span>}
            {call.request?.round && <span>{call.request.round}</span>}
            <span>Attempt {Math.max(call.attempt_no, 1)}</span>
          </p>
        </div>
        {r.confirmed_slot && (
          <p className="flex items-center gap-2 text-hb-sm text-hb-text">
            <CalendarCheck size={15} className="text-hb-success" aria-hidden />
            Booked for <strong>{formatWhen(r.confirmed_slot.start)}</strong>
            {call.interview_id ? ' — the interview, invites and reminders are set up.' : ''}
          </p>
        )}
        {r.proposed_slot && (
          <p className="text-hb-sm text-hb-text">
            Candidate asked for <strong>{formatWhen(r.proposed_slot.start)}</strong>, which isn't an open slot.
            {r.proposed_slot.note && <span className="text-hb-muted"> {r.proposed_slot.note}</span>}
          </p>
        )}
        {!!r.constraints?.length && (
          <Section title="Constraints">
            <ul className="list-disc pl-5 text-hb-sm text-hb-text">{r.constraints.map((c) => <li key={c}>{c}</li>)}</ul>
          </Section>
        )}
        {!!r.alternatives_offered?.length && (
          <p className="text-hb-xs text-hb-muted">Offered instead: {r.alternatives_offered.map(formatWhen).join(', ')}</p>
        )}
        {r.reason && <p className="text-hb-sm text-hb-text"><span className="text-hb-muted">Reason:</span> {r.reason}</p>}
        {r.link_resent && <p className="text-hb-xs text-hb-muted">The interview details were re-sent to the candidate.</p>}
        <Transcript call={call} />
      </div>
    </Card>
  )
}

export function CallResultView({ call }: { call: VoiceCallDetail }) {
  if (call.type !== 'PRESCREEN') return <UseCaseResultView call={call} />
  return <PrescreenResultView call={call} />
}

function PrescreenResultView({ call }: { call: VoiceCallDetail }) {
  const [overriding, setOverriding] = useState(false)
  const result = call.result
  const answers = result?.structured_data.answers ?? {}
  const raw = result?.structured_data.answers_raw ?? {}
  const rec = result?.recommendation
  const comm = result?.communication
  const decision = call.hr_override?.decision ?? call.decision
  const fields = [
    ...ANSWER_ORDER.filter((f) => f in answers),
    ...Object.keys(answers).filter((f) => !ANSWER_ORDER.includes(f) && f !== 'candidate_questions'),
  ].filter((f) => f !== 'responsibilities_summary' && f !== 'key_skills')
  const questions = (answers.candidate_questions as string[] | undefined) ?? []
  // Machine codes ("llm_review_skipped", "unparsed_callback_time:…") are for us, not HR.
  const flags = (result?.flags ?? []).filter((f) => f === 'callee_hung_up' || !/^[a-z_]+(:.*)?$/.test(f))

  return (
    <Card padding="default">
      <div className="flex flex-col gap-hb-5">
        {/* Recommendation */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {decision ? (
                <Badge tone={DECISION_LABEL[decision].tone}>{DECISION_LABEL[decision].label}</Badge>
              ) : (
                <Badge>{callStatusLabel(call)}</Badge>
              )}
              {call.hr_override && (
                <span className="inline-flex items-center gap-1 text-hb-xs text-hb-muted">
                  <UserCheck size={12} aria-hidden /> Decided by {call.hr_override.by_name}
                  {call.decision && call.decision !== call.hr_override.decision &&
                    ` · AI said ${DECISION_LABEL[call.decision].label.toLowerCase()}`}
                </span>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-hb-xs text-hb-muted">
              {call.started_at && <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden />{formatWhen(call.started_at)}</span>}
              {call.duration_sec != null && <span>{formatDuration(call.duration_sec)}</span>}
              {call.language_detected && <span className="inline-flex items-center gap-1"><Globe size={12} aria-hidden />{call.language_detected === 'hi' ? 'Hindi' : 'English'}</span>}
              <span>Attempt {call.attempt_no}</span>
              {call.job_title && <span>{call.job_title}</span>}
            </p>
          </div>
          {call.decision && (
            <Button variant="ghost" size="sm" onClick={() => setOverriding(true)}>
              {call.hr_override ? 'Change decision' : 'Override'}
            </Button>
          )}
        </div>

        {(rec?.reasons?.length || call.summary_text) && (
          <div className="flex flex-col gap-2">
            {call.summary_text && <p className="text-hb-sm text-hb-text">{call.summary_text}</p>}
            {rec?.reasons?.length ? (
              <ul className="list-disc pl-5 text-hb-sm text-hb-muted">
                {rec.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            ) : null}
          </div>
        )}

        {/* Answers with the candidate's own words */}
        {fields.length > 0 && (
          <Section title="Answers">
            <dl className="divide-y divide-hb-border rounded-hb-sm border border-hb-border">
              {fields.map((f) => {
                const value = answers[f]
                const text = formatAnswer(f, value)
                const quote = raw[RAW_KEY[f] ?? f]
                return (
                  <div key={f} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[180px_1fr]">
                    <dt className="text-hb-xs font-semibold text-hb-muted">{answerLabel(f)}</dt>
                    <dd className="flex flex-col gap-0.5">
                      {text ? (
                        <span className="text-hb-sm text-hb-text">{text}</span>
                      ) : (
                        <Badge tone="warning">{value === 'DECLINED_TO_SHARE' ? 'Declined to share' : 'Unclear'}</Badge>
                      )}
                      {quote && quote !== text && <span className="text-hb-xs italic text-hb-dim">“{quote}”</span>}
                    </dd>
                  </div>
                )
              })}
            </dl>
            {call.profile_updated_at && (
              <p className="text-hb-xs text-hb-dim">Clear answers were copied to the candidate profile (source: AI pre-screen).</p>
            )}
          </Section>
        )}

        {/* Communication */}
        {comm && (
          <Section title={`Communication · ${comm.overall}/5`}>
            {comm.confidence === 'LOW_CONFIDENCE' && (
              <p className="flex items-center gap-1.5 text-hb-xs text-hb-warning">
                <AlertTriangle size={13} aria-hidden /> Poor call audio — these scores may not reflect the candidate.
              </p>
            )}
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {COMMUNICATION_DIMENSIONS.map(([key, label]) => {
                const score = (comm as any)[key] as number
                return (
                  <Meter key={key} value={score} max={5} size="sm" tone={scoreTone(score)}
                         label={label} valueLabel={`${score}/5`} />
                )
              })}
            </div>
            {comm.notes && <p className="text-hb-xs text-hb-muted">{comm.notes}</p>}
          </Section>
        )}

        {flags.length > 0 && (
          <Section title="Points to verify">
            <ul className="flex flex-col gap-1 text-hb-sm text-hb-text">
              {flags.map((f) => (
                <li key={f} className="flex gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-hb-warning" aria-hidden />
                  {f === 'callee_hung_up' ? 'The candidate hung up before the call finished' : f}</li>
              ))}
            </ul>
          </Section>
        )}

        {questions.length > 0 && (
          <Section title="Candidate asked">
            <ul className="flex flex-col gap-1 text-hb-sm text-hb-text">
              {questions.map((q) => (
                <li key={q} className="flex gap-2"><MessageCircleQuestion size={14} className="mt-0.5 shrink-0 text-hb-blue" aria-hidden />{q}</li>
              ))}
            </ul>
          </Section>
        )}

        {rec?.suggested_round && (
          <Section title="Next round">
            <p className="text-hb-sm text-hb-text">
              {rec.suggested_round}
              {rec.focus_areas?.length ? <span className="text-hb-muted"> — probe {rec.focus_areas.join(', ')}</span> : null}
            </p>
          </Section>
        )}

        {call.recording_url && (
          <audio controls preload="none" src={call.recording_url} className="w-full">
            <a href={call.recording_url}>Download recording</a>
          </audio>
        )}

        <Transcript call={call} />
      </div>
      {overriding && <OverrideDialog call={call} onClose={() => setOverriding(false)} />}
    </Card>
  )
}
