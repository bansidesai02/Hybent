import { useQuery } from '@tanstack/react-query'
import { Bot, PhoneCall } from 'lucide-react'

import { useAICallsEnabled } from '@/hooks/useAICallsNav'
import {
  OUTCOME_LABEL,
  USE_CASE_LABEL,
  VOICE_CALLS_KEY,
  formatWhen,
  voiceCallsApi,
  type ReminderStatus,
} from '@/api/voiceCalls'
import { Badge } from '@/components/hb'

/**
 * On an interview: whether the AI Agent booked it, and where each reminder
 * call stands (Spec §7.7: interviewers see up-to-date confirmation status).
 */

const WHICH: Record<string, string> = { '1': 'Day-before reminder', '2': '1-hour reminder' }

function reminderBadge(r: ReminderStatus): { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' } {
  if (r.use_case_outcome) return USE_CASE_LABEL[r.use_case_outcome]
  if (r.task_status === 'IN_CALL') return { label: 'calling now', tone: 'info' }
  if (r.task_status === 'SCHEDULED') {
    return { label: r.next_attempt_at ? formatWhen(r.next_attempt_at) : 'scheduled', tone: 'neutral' }
  }
  if (r.task_status === 'FAILED_TO_START') return { label: "couldn't start", tone: 'error' }
  return { label: r.outcome ? OUTCOME_LABEL[r.outcome].toLowerCase() : 'done', tone: 'warning' }
}

export function InterviewAIStatus({ interviewId }: { interviewId: string }) {
  const enabled = useAICallsEnabled()
  const { data } = useQuery({
    queryKey: [...VOICE_CALLS_KEY, 'interview', interviewId],
    queryFn: () => voiceCallsApi.interviewStatus([interviewId]).then((r) => r.data[interviewId] ?? null),
    enabled,
    staleTime: 30_000,
  })
  if (!enabled || !data) return null
  const reminders = Object.entries(data.reminders).sort(([a], [b]) => a.localeCompare(b))
  if (!data.booked_by_ai && reminders.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {data.booked_by_ai && (
        <Badge tone="info"><Bot size={11} aria-hidden /> Booked by AI Agent</Badge>
      )}
      {reminders.map(([n, r]) => {
        const { label, tone } = reminderBadge(r)
        return (
          <Badge key={n} tone={tone}>
            <PhoneCall size={11} aria-hidden /> {WHICH[n] ?? 'Reminder'}: {label}
          </Badge>
        )
      })}
    </div>
  )
}
