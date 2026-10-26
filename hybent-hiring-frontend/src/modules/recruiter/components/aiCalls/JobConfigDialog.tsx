import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'

import { voiceCallsApi, type JobVoiceConfig } from '@/api/voiceCalls'
import { Button, Checkbox, Dialog, Input, Skeleton, Switch } from '@/components/hb'

import { errorMessage } from './format'

/**
 * A job's AI pre-screen setup (Spec §5.3, §5.5, §5.8): the pass criteria the
 * recommendation is checked against, and optional job-specific questions.
 * No custom questions = the standard ten (experience, CTC, notice period…).
 */

type QuestionRow = { field: string; question: string; required: boolean }

function slug(text: string, taken: Set<string>): string {
  const base = (text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'question')
    .replace(/^(\d)/, 'q_$1')
  let field = base.length < 2 ? `${base}_q` : base
  let n = 2
  while (taken.has(field)) field = `${base}_${n++}`
  taken.add(field)
  return field
}

const numberOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

export function JobConfigDialog({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['voice-job-config', jobId],
    queryFn: () => voiceCallsApi.getJobConfig(jobId).then((r) => r.data),
  })

  const [clientFacing, setClientFacing] = useState(false)
  const [minExp, setMinExp] = useState('')
  const [maxExp, setMaxExp] = useState('')
  const [budgetLpa, setBudgetLpa] = useState('')
  const [maxNotice, setMaxNotice] = useState('')
  const [custom, setCustom] = useState(false)
  const [questions, setQuestions] = useState<QuestionRow[]>([])

  useEffect(() => {
    if (!data) return
    const c = data.criteria ?? {}
    setClientFacing(!!data.client_facing)
    setMinExp(c.min_experience_years?.toString() ?? '')
    setMaxExp(c.max_experience_years?.toString() ?? '')
    setBudgetLpa(c.budget_max?.value ? String(c.budget_max.value / 100_000) : '')
    setMaxNotice(c.max_notice_days?.toString() ?? '')
    setCustom(data.questions.length > 0)
    setQuestions(data.questions)
  }, [data])

  const save = useMutation({
    mutationFn: () => {
      const taken = new Set(questions.map((q) => q.field).filter(Boolean))
      const qs = custom
        ? questions.filter((q) => q.question.trim()).map((q) => ({ ...q, field: q.field || slug(q.question, taken) }))
        : []
      const budget = numberOrNull(budgetLpa)
      const config: JobVoiceConfig = {
        client_facing: clientFacing,
        currency: 'INR',
        questions: qs,
        criteria: {
          min_experience_years: numberOrNull(minExp),
          max_experience_years: numberOrNull(maxExp),
          budget_max: budget ? { value: Math.round(budget * 100_000), currency: 'INR' } : null,
          max_notice_days: numberOrNull(maxNotice),
        },
      }
      return voiceCallsApi.saveJobConfig(jobId, config)
    },
    onSuccess: () => {
      toast.success('Pre-screen setup saved')
      onClose()
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't save the setup")),
  })

  const update = (i: number, patch: Partial<QuestionRow>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch, field: patch.question !== undefined ? '' : q.field } : q)))

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title="AI pre-screen setup"
      description="The AI recommends next round, hold or not recommended by checking answers against these limits. Leave a limit empty to skip it."
      footer={
        <>
          <Button variant="quiet" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={save.isPending} disabled={isLoading} onClick={() => save.mutate()}>Save</Button>
        </>
      }
    >
      {isLoading ? (
        <Skeleton className="h-64 w-full" rounded="md" />
      ) : (
        <div className="flex flex-col gap-hb-4 pb-2">
          <div className="grid gap-hb-3 sm:grid-cols-2">
            <Input label="Min experience (yrs)" type="number" min={0} step="0.5" value={minExp} onChange={(e) => setMinExp(e.target.value)} />
            <Input label="Max experience (yrs)" type="number" min={0} step="0.5" value={maxExp} onChange={(e) => setMaxExp(e.target.value)} />
            <Input label="Budget (LPA)" type="number" min={0} step="0.5" value={budgetLpa} onChange={(e) => setBudgetLpa(e.target.value)}
                   description="Up to 10% over still recommends; 10–25% over is hold." />
            <Input label="Max notice period (days)" type="number" min={0} value={maxNotice} onChange={(e) => setMaxNotice(e.target.value)} />
          </div>
          <Switch checked={clientFacing} onChange={setClientFacing} label="Client-facing role"
                  description="Uses the higher communication threshold from Settings → AI Calls." />
          <Switch checked={custom} onChange={(on) => { setCustom(on); if (on && !questions.length) setQuestions([{ field: '', question: '', required: true }]) }}
                  label="Use my own questions"
                  description="Off: the standard questions (experience, company, role, skills, CTC, expected CTC, notice period, location, reason for change)." />
          {custom && (
            <div className="flex flex-col gap-2">
              {questions.map((q, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input label={i === 0 ? 'Questions' : undefined} value={q.question} maxLength={300}
                           placeholder="e.g. Are you comfortable with night shifts?" onChange={(e) => update(i, { question: e.target.value })} />
                  </div>
                  <Checkbox label="Required" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} />
                  <Button variant="quiet" size="sm" aria-label="Remove question" icon={<Trash2 size={14} />}
                          onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} />
                </div>
              ))}
              {questions.length < 15 && (
                <Button variant="ghost" size="sm" icon={<Plus size={14} />} className="self-start"
                        onClick={() => setQuestions((qs) => [...qs, { field: '', question: '', required: true }])}>
                  Add question
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}
