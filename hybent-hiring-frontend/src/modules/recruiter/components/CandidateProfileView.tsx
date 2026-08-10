import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, CalendarPlus, FileText, Mail, Mic, Sparkles, User, Zap } from 'lucide-react'

import { useCopilotStore } from '@/store/useCopilotStore'
import { candidatesApi } from '@/api/candidates'
import type { Candidate } from '@/types'
import { Avatar, Badge, Button, StatusPill, Tabs, TabPanel } from '@/components/hb'

import { DetailsTab } from './profile/DetailsTab'
import { FeedbackTab } from './profile/FeedbackTab'
import { PreScreenTab } from './profile/PreScreenTab'
import { TimelineTab } from './profile/TimelineTab'

/**
 * The candidate profile.
 *
 * Was 1,700 lines and 146 inline styles — the worst file in the repository, and
 * the one that appears on the most screens: it opens from the candidates list,
 * the talent list and the pipeline board. Phase 6 split it into four tab
 * components under `./profile/` and rebuilt all of it on the design system.
 *
 * The tab strip is now `Tabs`, which implements the WAI-ARIA pattern. It was
 * four `<button>`s with a manually positioned underline and no `role`, so a
 * keyboard user could tab into them but arrow keys did nothing and a screen
 * reader announced four unrelated buttons rather than a tablist.
 */

type TabKey = 'details' | 'feedback' | 'prescreen' | 'timeline'

const TABS = [
  { value: 'details' as const, label: <><User size={14} aria-hidden /> Details</> },
  { value: 'feedback' as const, label: <><Mic size={14} aria-hidden /> Feedback</> },
  { value: 'prescreen' as const, label: <><Sparkles size={14} aria-hidden /> Pre-screen</> },
  { value: 'timeline' as const, label: <><Activity size={14} aria-hidden /> Audit trail</> },
]

interface CandidateProfileViewProps {
  candidate: Candidate
  onInvite?: () => void
  onSchedule?: () => void
  hasInvitation?: boolean
  hideInvite?: boolean
  hideSchedule?: boolean
  initialTab?: TabKey
}

/** Opens the résumé, refreshing the signed URL when the file lives in storage. */
async function openResume(candidate: Candidate) {
  if (candidate.resume_storage_path) {
    try {
      const res = await candidatesApi.getResumeUrl(candidate.id)
      const data = (res.data as any)?.data ?? res.data
      if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch {
      /* A signed URL can only be refreshed server-side; nothing useful to retry. */
      window.alert('Could not load the résumé. Please try again.')
    }
    return
  }

  const base = import.meta.env.VITE_API_BASE_URL || window.location.origin
  const url = candidate.resume_url!.startsWith('http')
    ? candidate.resume_url!
    : `${base}${candidate.resume_url}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function CandidateProfileView({
  candidate: initialCandidate,
  onInvite,
  onSchedule,
  hasInvitation,
  hideInvite,
  hideSchedule,
  initialTab,
}: CandidateProfileViewProps) {
  const { data: candidate = initialCandidate } = useQuery({
    queryKey: ['candidate-detail', initialCandidate.id],
    queryFn: () => candidatesApi.get(initialCandidate.id).then((r: any) => r.data),
    // Use initialCandidate as a placeholder but always fetch fresh detail data
    // (the list endpoint defers some fields; the detail endpoint returns everything)
    placeholderData: initialCandidate,
    staleTime: 0,
  })

  const setPageContext = useCopilotStore((s) => s.setPageContext)
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'details')

  useEffect(() => {
    setPageContext({ candidate_id: candidate.id, candidate_name: candidate.full_name })
    return () => setPageContext(null)
  }, [candidate.id, candidate.full_name, setPageContext])

  const score = candidate.match_score
  const scoreTone = score == null ? 'neutral' : score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error'
  const hasResume = candidate.resume_storage_path || candidate.resume_url

  return (
    <div>
      <header className="flex flex-col gap-4 pb-hb-5 sm:flex-row sm:items-start">
        <Avatar name={candidate.full_name} src={candidate.avatar_url} size="xl" />

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-hb-h2 text-hb-text">{candidate.full_name}</h2>
          {candidate.current_title && (
            <p className="mt-0.5 text-hb-sm text-hb-muted">
              {candidate.current_title}
              {candidate.current_company ? ` · ${candidate.current_company}` : ''}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {candidate.pipeline_stage ? (
              <StatusPill status={candidate.pipeline_stage} />
            ) : (
              <Badge>Talent pool</Badge>
            )}

            {score != null && (
              <Badge tone={scoreTone}>
                <Zap size={11} aria-hidden />
                {Math.round(score)}% match
              </Badge>
            )}

            {hasResume && (
              <Button
                variant="ghost"
                size="sm"
                icon={<FileText size={13} />}
                onClick={() => openResume(candidate)}
              >
                Resume
              </Button>
            )}

            {onInvite && !hideInvite && (
              <Button variant="ghost" size="sm" icon={<Mail size={13} />} onClick={onInvite}>
                {hasInvitation ? 'Resend invite' : 'Invite'}
              </Button>
            )}

            {onSchedule && !hideSchedule && (
              <Button size="sm" icon={<CalendarPlus size={13} />} onClick={onSchedule}>
                Schedule
              </Button>
            )}
          </div>
        </div>
      </header>

      <Tabs items={TABS} value={tab} onChange={setTab} aria-label="Candidate profile sections" />

      <TabPanel value="details" active={tab === 'details'}>
        <DetailsTab candidate={candidate} />
      </TabPanel>
      <TabPanel value="feedback" active={tab === 'feedback'}>
        <FeedbackTab candidate={candidate} />
      </TabPanel>
      <TabPanel value="prescreen" active={tab === 'prescreen'}>
        <PreScreenTab candidate={candidate} />
      </TabPanel>
      <TabPanel value="timeline" active={tab === 'timeline'}>
        <TimelineTab candidate={candidate} />
      </TabPanel>
    </div>
  )
}
