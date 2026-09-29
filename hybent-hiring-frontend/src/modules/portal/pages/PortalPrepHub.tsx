import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Lightbulb, Sparkles, Target } from 'lucide-react'

import { portalApi } from '@/api/portal'
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  IconTile,
  PageHeader,
  Skeleton,
} from '@/components/hb'

/**
 * AI-generated interview prep: a flashcard hero, focus topics and a question
 * bank, tailored to the candidate's next round.
 *
 * Rebuilt on the design system in phase 7 — the last portal page off
 * portal.css (`.prep-*`, `.pcc-*`, `.ptopic-*`, `.pprac-*`). The flashcard
 * hero keeps its tap-to-advance behaviour but is a real button now.
 */

interface Flashcard {
  topic: string
  question: string
  answer: string
}

export default function PortalPrepHub() {
  const [activeQuestion, setActiveQuestion] = useState(0)

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['portal', 'applications'],
    queryFn: () => portalApi.myApplications().then((r: any) => r.data),
  })

  // We fetch interviews to get the "next interview" info for the header
  const { data: interviews } = useQuery({
    queryKey: ['portal', 'interviews'],
    queryFn: () => portalApi.myInterviews().then((r: any) => r.data),
  })

  // Find the most relevant upcoming interview (today onwards)
  let nextInterview = null
  if (interviews && interviews.length > 0) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const upcoming = interviews
      .filter((i: any) => new Date(i.scheduled_at) >= todayStart && i.status !== 'cancelled')
      .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

    if (upcoming.length > 0) nextInterview = upcoming[0]
  }

  // Tie the active application to the next interview if one exists
  const activeAppId = nextInterview?.application_id
    ? nextInterview.application_id
    : applications?.find((a: any) => !['hired', 'rejected'].includes(a.stage))?.id ||
      applications?.[0]?.id

  const activeApp = applications?.find((a: any) => a.id === activeAppId)

  const { data: prepData, isLoading: prepLoading } = useQuery({
    queryKey: ['portal', 'prep', activeApp?.id],
    queryFn: () => portalApi.generatePrep(activeApp!.id).then((r: any) => r.data),
    enabled: !!activeApp,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const rawFlashcards = prepData?.flashcards || []
  const focusAreas = prepData?.focus_areas || []

  const flashcards: Flashcard[] = rawFlashcards.map((fc: any) => ({
    topic: fc.category || fc.topic || 'Prep',
    question: fc.question,
    answer:
      fc.answer || (fc.key_points ? fc.key_points.join(' • ') : fc.hint || 'Review key concepts.'),
  }))

  const nextInterviewDate = nextInterview ? new Date(nextInterview.scheduled_at) : null
  const timeStr = nextInterviewDate
    ? nextInterviewDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : ''
  const dateStr = nextInterviewDate
    ? nextInterviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''
  const titleStr = nextInterview?.title || activeApp?.job?.title || 'your next'

  if (appsLoading) {
    return (
      <div className="pb-hb-10">
        <Skeleton className="mb-hb-6 h-12 w-80" rounded="md" />
        <Skeleton className="mb-hb-5 h-52 w-full" rounded="md" />
        <div className="grid gap-hb-4 md:grid-cols-2">
          <Skeleton className="h-72 w-full" rounded="md" />
          <Skeleton className="h-72 w-full" rounded="md" />
        </div>
      </div>
    )
  }

  if (!activeApp) {
    return (
      <div className="pb-hb-10">
        <PageHeader eyebrow="Candidate portal" title="Interview prep hub" />
        <Card padding="none">
          <EmptyState
            icon={<Target />}
            title="Nothing to prepare yet"
            description="Apply for a job to unlock tailored prep materials."
            size="page"
          />
        </Card>
      </div>
    )
  }

  const currentQ = flashcards[activeQuestion]

  const handleNextQ = () => {
    if (flashcards.length > 0) {
      setActiveQuestion((prev) => (prev + 1) % flashcards.length)
    }
  }

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Candidate portal"
        title="Interview prep hub"
        description={`AI-generated tips, questions and flashcards — tailored for your ${titleStr} interview.`}
        actions={
          nextInterview ? (
            <div className="rounded-hb-md border border-hb-border bg-hb-surface px-4 py-2.5 text-right">
              <p className="font-mono text-hb-micro uppercase tracking-[.14em] text-hb-dim">
                Next interview
              </p>
              <p className="font-display text-hb-h3 text-hb-text">{timeStr}</p>
              <p className="text-hb-micro text-hb-muted">
                {dateStr} · {titleStr}
              </p>
            </div>
          ) : undefined
        }
      />

      <div className="space-y-hb-5">
        {prepLoading && (
          <Card padding="loose" className="flex flex-col items-center gap-3 text-center">
            <Sparkles size={32} aria-hidden className="animate-pulse text-hb-cyan" />
            <p className="text-hb-body font-semibold text-hb-text">
              Analyzing your resume and generating personalized prep questions…
            </p>
            <p className="text-hb-sm text-hb-muted">This might take a few seconds.</p>
          </Card>
        )}

        {flashcards.length > 0 && currentQ && (
          <button
            type="button"
            onClick={handleNextQ}
            className="block w-full rounded-hb-lg bg-hb-grad-diag p-8 text-center text-white transition-transform duration-hb ease-hb hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-hb-ring md:p-10"
          >
            <span className="font-mono text-hb-label uppercase tracking-[.22em] text-white/75">
              Question {activeQuestion + 1} of {flashcards.length} · {currentQ.topic}
            </span>
            <span className="mx-auto mt-4 block max-w-[38ch] font-display text-hb-h2 leading-snug">
              {currentQ.question}
            </span>
            <span className="mt-5 inline-flex items-center gap-1.5 text-hb-xs text-white/75">
              Tap to see the next question
              <ArrowRight size={13} aria-hidden />
            </span>
          </button>
        )}

        {!prepLoading && (flashcards.length > 0 || focusAreas.length > 0) && (
          <div className="grid gap-hb-4 md:grid-cols-2">
            <Card padding="default">
              <CardHeader title="Topics to prepare" action={<Badge tone="brand">Role specific</Badge>} />
              {focusAreas.length > 0 ? (
                <ul className="space-y-3">
                  {focusAreas.map((area: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <IconTile size="sm">
                        <Lightbulb />
                      </IconTile>
                      <div className="min-w-0">
                        <p className="text-hb-sm font-semibold text-hb-text">{area.topic}</p>
                        <p className="mt-0.5 text-hb-xs text-hb-muted">
                          {area.reason || 'AI-recommended focus area'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-hb-sm text-hb-muted">No specific topics generated.</p>
              )}
            </Card>

            <Card padding="default">
              <CardHeader title="AI practice questions" />
              <ul className="space-y-3">
                {flashcards.map((card, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <IconTile size="sm">
                      <Sparkles />
                    </IconTile>
                    <div className="min-w-0">
                      <p className="text-hb-sm leading-snug text-hb-text">{card.question}</p>
                      <Badge className="mt-1.5">{card.topic}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {!flashcards.length && !prepLoading && (
          <Card padding="none">
            <EmptyState
              icon={<Sparkles />}
              title="No prep materials available"
              description="Prep questions are generated once your application has a resume attached."
            />
          </Card>
        )}
      </div>
    </div>
  )
}
