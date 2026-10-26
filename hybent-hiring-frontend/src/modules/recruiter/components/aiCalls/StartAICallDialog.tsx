import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { jobsApi } from '@/api/jobs'
import { VOICE_CALLS_KEY, voiceCallsApi, type StartResult } from '@/api/voiceCalls'
import { Button, Checkbox, Dialog, Select, Skeleton } from '@/components/hb'

import { JobConfigDialog } from './JobConfigDialog'
import { errorMessage } from './format'

/**
 * Start AI pre-screen calls for one or more candidates against one job.
 * The engine schedules each call inside the org's calling hours; this only
 * asks for them. Candidates who can't be called (no consent, no phone, opted
 * out, already in progress) are listed with the reason.
 */
export function StartAICallDialog({
  candidates,
  defaultJobId,
  onClose,
}: {
  candidates: Array<{ id: string; full_name: string }>
  defaultJobId?: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [jobId, setJobId] = useState(defaultJobId ?? '')
  const [configuring, setConfiguring] = useState(false)
  const [failures, setFailures] = useState<StartResult[] | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs', 'active-for-ai-calls'],
    queryFn: () => jobsApi.list({ status: 'active', limit: 100 }).then((r: any) => (r.data?.items ?? r.data ?? []) as Array<{ id: string; title: string }>),
    staleTime: 60_000,
  })
  const picked = jobId || jobs?.[0]?.id || ''
  const names = new Map(candidates.map((c) => [c.id, c.full_name]))

  const start = useMutation({
    mutationFn: (ids?: string[]) =>
      voiceCallsApi.startPrescreen(picked, ids ?? candidates.map((c) => c.id)).then((r) => r.data),
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: VOICE_CALLS_KEY })
      const failed = results.filter((r) => r.error)
      const ok = results.length - failed.length
      if (ok) toast.success(ok === 1 ? 'AI call scheduled' : `${ok} AI calls scheduled`)
      setConfirmed(false)
      if (failed.length) setFailures(failed)
      else onClose()
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't start the AI calls")),
  })

  // Only missing consent can be fixed here: HR confirms the candidate agreed
  // (on a call, by email…), we record it, then call them in the same step.
  const noConsent = (failures ?? []).filter((f) => f.error?.includes('consent')).map((f) => f.candidate_id)

  const consentAndCall = useMutation({
    mutationFn: async () => {
      for (const id of noConsent) await voiceCallsApi.recordConsent(id, 'HR_RECORDED_OTHER')
      return noConsent
    },
    onSuccess: (ids) => start.mutate(ids),
    onError: (err) => toast.error(errorMessage(err, "Couldn't record consent")),
  })

  if (failures) {
    return (
      <Dialog
        open
        onClose={onClose}
        size="sm"
        title={failures.length === candidates.length ? "These candidates couldn't be called" : 'Some candidates were skipped'}
        footer={
          noConsent.length ? (
            <>
              <Button variant="quiet" size="sm" onClick={onClose}>Not now</Button>
              <Button size="sm" disabled={!confirmed} loading={consentAndCall.isPending || start.isPending}
                      onClick={() => consentAndCall.mutate()}>
                Record consent &amp; call
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onClose}>Done</Button>
          )
        }
      >
        <div className="flex flex-col gap-hb-3 pb-2">
          <ul className="flex flex-col gap-2 text-hb-sm">
            {failures.map((f) => (
              <li key={f.candidate_id}>
                <span className="font-semibold text-hb-text">{names.get(f.candidate_id) ?? 'Candidate'}</span>
                <span className="text-hb-muted"> — {f.error}</span>
              </li>
            ))}
          </ul>
          {noConsent.length > 0 && (
            <Checkbox
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              label={
                <span className="text-hb-sm text-hb-muted">
                  {noConsent.length === 1 ? 'This candidate has' : `These ${noConsent.length} candidates have`} agreed to
                  an AI screening call (for example on the phone or by email). Record their consent and call now.
                </span>
              }
            />
          )}
        </div>
      </Dialog>
    )
  }

  // One dialog at a time: the job setup replaces this one, then comes back.
  if (configuring && picked) return <JobConfigDialog jobId={picked} onClose={() => setConfiguring(false)} />

  const who = candidates.length === 1 ? candidates[0].full_name : `${candidates.length} candidates`
  return (
    <>
      <Dialog
        open
        onClose={onClose}
        size="sm"
        title="Start AI pre-screen"
        description={`The Hybent AI Agent will phone ${who}, ask the screening questions for this job and send you a summary. Calls are made only within your calling hours.`}
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" loading={start.isPending} disabled={!picked} onClick={() => start.mutate(undefined)}>
              {candidates.length === 1 ? 'Schedule call' : `Schedule ${candidates.length} calls`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2 pb-2">
          {isLoading ? (
            <Skeleton className="h-11 w-full" rounded="md" />
          ) : jobs?.length ? (
            <>
              <Select label="Job" options={jobs.map((j) => ({ value: j.id, label: j.title }))}
                      value={picked} onChange={(e) => setJobId(e.target.value)} />
              <button type="button" onClick={() => setConfiguring(true)}
                      className="self-start text-hb-xs font-semibold text-hb-blue hover:underline">
                Questions & pass criteria for this job
              </button>
            </>
          ) : (
            <p className="text-hb-sm text-hb-error">There's no open job to screen against.</p>
          )}
        </div>
      </Dialog>
    </>
  )
}
