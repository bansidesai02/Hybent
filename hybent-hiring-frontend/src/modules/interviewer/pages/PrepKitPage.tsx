import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  Lock,
  Mic,
  Sparkles,
  User,
  Video,
} from 'lucide-react'

import { interviewsApi } from '@/api/interviews'
import { applicationsApi } from '@/api/applications'
import { candidatesApi } from '@/api/candidates'
import { CHECKLIST_CRITERIA, useInterviewStore } from '@/store/interviewStore'
import { useAuthStore } from '@/store/authStore'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  Meter,
  PageHeader,
  Skeleton,
} from '@/components/hb'

/**
 * The prep kit for one interview: who you are about to meet, a question bank,
 * and the checklist that unlocks the meeting link.
 *
 * Rebuilt on the design system in phase 8. Three things beyond appearance:
 *
 * - Both action buttons pointed at `/interviewer/...`, dropping the `/hiring`
 *   prefix the whole workspace is mounted under, so "Start interview mode" and
 *   "Scorecard" both landed on the marketing homepage.
 * - `generateQuestions` was called with a hardcoded empty skill list, which
 *   made the entire fourteen-skill bank below dead code — every interviewer saw
 *   the same four generic questions no matter who they were interviewing. The
 *   candidate's skills were already loaded on this page for the chips.
 * - Each question carried a `tagColor` hex, so eight tags were painted in seven
 *   colours that encoded nothing the tag text did not already say.
 */

/* ─── Question bank ────────────────────────────────────────────────────────── */

interface Question {
  text: string
  tag: string
}

const SKILL_QUESTIONS: Record<string, Question[]> = {
  react: [
    { text: 'How do you manage complex state in React — when do you pick Redux vs Context vs Zustand?', tag: 'State management' },
    { text: "Explain how React reconciliation works and how you've optimized renders in production.", tag: 'React deep dive' },
  ],
  typescript: [
    { text: "How has TypeScript's strict mode caught real bugs in your codebase? Walk me through a specific example.", tag: 'TypeScript' },
    { text: "Explain generic types and how you've used them to build reusable utilities or components.", tag: 'TypeScript' },
  ],
  python: [
    { text: 'How do you approach async programming in Python — asyncio vs threading vs multiprocessing?', tag: 'Python' },
    { text: 'Walk me through your experience with Python type hints and static analysis in production.', tag: 'Python' },
  ],
  fastapi: [
    { text: 'How have you structured a FastAPI application for scale — routers, dependencies, middleware?', tag: 'Backend' },
  ],
  django: [
    { text: "Describe how you've optimized Django ORM queries in a high-traffic application.", tag: 'Backend' },
  ],
  nodejs: [
    { text: 'How do you handle backpressure and memory leaks in a Node.js backend under heavy load?', tag: 'Backend' },
  ],
  sql: [
    { text: "Walk me through a complex query optimization you've done — indexes, execution plans, partitioning.", tag: 'Database' },
  ],
  postgresql: [
    { text: 'How have you used PostgreSQL-specific features (CTEs, window functions, JSONB) in production?', tag: 'Database' },
  ],
  aws: [
    { text: 'Describe your experience architecting on AWS — which services did you use and how did you handle cost optimization?', tag: 'Cloud' },
  ],
  docker: [
    { text: 'How have you structured Docker multi-stage builds and container orchestration in your projects?', tag: 'DevOps' },
  ],
  kubernetes: [
    { text: 'Walk me through a challenging Kubernetes deployment issue you debugged and resolved.', tag: 'DevOps' },
  ],
  nextjs: [
    { text: 'Explain the difference between SSR, SSG, and ISR in Next.js — when do you use each?', tag: 'Frontend' },
  ],
  graphql: [
    { text: 'How have you handled N+1 query problems in a GraphQL API? Walk me through your solution.', tag: 'Backend' },
  ],
  redis: [
    { text: 'How have you used Redis for caching, pub/sub, or session storage? Describe a specific use case.', tag: 'Infrastructure' },
  ],
}

const SYSTEM_DESIGN: Question = {
  text: 'Design a distributed system that needs to handle 1 million events per day with sub-second latency — walk me through your architecture decisions.',
  tag: 'System design',
}
const TECHNICAL: Question = {
  text: 'What does your ideal code review process look like? What do you look for as both an author and a reviewer?',
  tag: 'Technical depth',
}
const CULTURE: Question[] = [
  {
    text: 'Tell me about a time you had a strong technical disagreement with a teammate. How did you resolve it and what did you learn?',
    tag: 'Culture fit',
  },
  {
    text: 'Describe a technical decision you made that turned out to be wrong. How did you course-correct?',
    tag: 'Culture fit',
  },
]

function generateQuestions(skills: string[], interviewType: string): Question[] {
  const result: Question[] = []
  const seen = new Set<string>()

  const push = (q: Question) => {
    if (seen.has(q.text)) return
    seen.add(q.text)
    result.push(q)
  }

  skills.forEach((skill) => {
    const key = skill.toLowerCase().replace(/[^a-z]/g, '')
    SKILL_QUESTIONS[key]?.forEach(push)
  })

  push(SYSTEM_DESIGN)
  if (interviewType === 'technical' || interviewType === 'final') push(TECHNICAL)
  CULTURE.forEach(push)

  return result.slice(0, 8)
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function PrepKitPage() {
  const { interviewId } = useParams<{ interviewId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const toggleStep = useInterviewStore((s) => s.toggleStep)
  const checklists = useInterviewStore((s) => s.checklists)
  const isComplete = useInterviewStore((s) => s.isComplete)

  const checked = checklists[interviewId!] ?? new Array(CHECKLIST_CRITERIA.length).fill(false)
  const checkedCount = checked.filter(Boolean).length
  /* The gate is for interviewers. A recruiter or admin sitting in on the round
     can always open the link. */
  const unlocked = isComplete(interviewId!) || user?.role !== 'interviewer'

  const { data: interview, isLoading: intLoading } = useQuery({
    queryKey: ['interview', interviewId],
    queryFn: () => interviewsApi.get(interviewId!).then((r) => r.data),
    enabled: !!interviewId,
  })

  const { data: application, isLoading: appLoading } = useQuery({
    queryKey: ['application', interview?.application_id],
    queryFn: () => applicationsApi.get(interview!.application_id!).then((r) => r.data),
    enabled: !!interview?.application_id,
  })

  const candidate = application?.candidate
  const isLoading = intLoading || appLoading
  const skills = candidate?.skills ?? []
  const questions = interview ? generateQuestions(skills, interview.interview_type) : []

  async function openResume() {
    if (!candidate) return
    if (candidate.resume_storage_path) {
      try {
        const res = await candidatesApi.getResumeUrl(candidate.id ?? '')
        const data = (res.data as any)?.data ?? res.data
        if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer')
        else toast.error('Could not load resume. Please try again.')
      } catch {
        toast.error('Could not load resume. Please try again.')
      }
      return
    }
    const base = import.meta.env.VITE_API_BASE_URL || window.location.origin
    const url = candidate.resume_url!.startsWith('http')
      ? candidate.resume_url!
      : `${base}${candidate.resume_url}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (isLoading) {
    return (
      <div className="pb-hb-10">
        <Skeleton className="mb-hb-6 h-12 w-72" rounded="md" />
        <div className="grid gap-hb-5 md:grid-cols-5">
          <div className="space-y-hb-4 md:col-span-2">
            <Skeleton className="h-56 w-full" rounded="md" />
            <Skeleton className="h-64 w-full" rounded="md" />
          </div>
          <Skeleton className="h-[480px] w-full md:col-span-3" rounded="md" />
        </div>
      </div>
    )
  }

  if (!interview) {
    return (
      <div className="pb-hb-10">
        <Card padding="none">
          <EmptyState
            icon={<BookOpen />}
            title="Interview not found"
            description="This interview may have been cancelled or reassigned."
            size="page"
            action={{
              label: 'Back to my interviews',
              onClick: () => navigate('/hiring/interviewer/interviews'),
            }}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="pb-hb-10">
      <PageHeader
        breadcrumbs={[
          { label: 'My interviews', to: '/hiring/interviewer/interviews' },
          { label: 'Prep kit' },
        ]}
        eyebrow="Prep kit"
        title="Interview prep kit"
        description={`${interview.title || 'General interview'} · questions tailored to ${
          skills.length > 0 ? "the candidate's skills" : 'the standard bank'
        }.`}
        actions={
          interview.meeting_link ? (
            unlocked ? (
              <Button
                icon={<Video size={15} />}
                href={interview.meeting_link}
                target="_blank"
                rel="noreferrer"
              >
                Join Google Meet
              </Button>
            ) : (
              <Button
                variant="ghost"
                icon={<Lock size={14} />}
                disabled
                title={`Complete all ${CHECKLIST_CRITERIA.length} checklist items to unlock the meeting link`}
              >
                Link locked
              </Button>
            )
          ) : undefined
        }
      />

      <div className="grid gap-hb-5 md:grid-cols-5">
        {/* ── Left: who you are meeting, and what to do first ─────────────── */}
        <div className="space-y-hb-4 md:col-span-2">
          <Card padding="default">
            <CardHeader title="Candidate snapshot" />

            {candidate ? (
              <div className="space-y-hb-4">
                <div className="flex items-center gap-3">
                  <Avatar name={candidate.full_name} src={candidate.avatar_url} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-hb-body font-semibold text-hb-text">
                      {candidate.full_name}
                    </p>
                    <p className="truncate text-hb-xs text-hb-muted">
                      {candidate.current_title ?? 'Candidate'}
                      {candidate.current_company ? ` · ${candidate.current_company}` : ''}
                    </p>
                  </div>
                </div>

                {(candidate.years_experience != null || candidate.relevant_experience) && (
                  <p className="text-hb-sm text-hb-muted">
                    <span className="font-semibold text-hb-text">Experience: </span>
                    {candidate.years_experience != null
                      ? `${candidate.years_experience} years`
                      : candidate.relevant_experience}
                  </p>
                )}

                {skills.length > 0 && (
                  <div>
                    <p className="mb-2 font-mono text-hb-label uppercase text-hb-dim">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.slice(0, 12).map((skill) => (
                        <Badge key={skill}>{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(candidate.resume_storage_path || candidate.resume_url) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<FileText size={14} />}
                    onClick={openResume}
                    className="w-full"
                  >
                    View résumé
                  </Button>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<User />}
                title={interview.candidate_name ?? 'Candidate'}
                description="Detailed profile unavailable for this round."
              />
            )}
          </Card>

          <Card padding="default">
            <CardHeader
              title="Pre-interview checklist"
              action={
                <Badge tone={checkedCount === CHECKLIST_CRITERIA.length ? 'success' : 'info'}>
                  {checkedCount}/{CHECKLIST_CRITERIA.length}
                </Badge>
              }
            />

            <Meter
              value={checkedCount}
              max={CHECKLIST_CRITERIA.length}
              tone={checkedCount === CHECKLIST_CRITERIA.length ? 'success' : 'brand'}
              size="xs"
              aria-label="Checklist progress"
              className="mb-hb-4"
            />

            <div className="space-y-3">
              {CHECKLIST_CRITERIA.map((item, idx) => (
                <Checkbox
                  key={item}
                  checked={!!checked[idx]}
                  onChange={() => toggleStep(interviewId!, idx)}
                  label={
                    <span className={checked[idx] ? 'text-hb-dim line-through' : undefined}>
                      {item}
                    </span>
                  }
                />
              ))}
            </div>
          </Card>
        </div>

        {/* ── Right: the questions ────────────────────────────────────────── */}
        <div className="space-y-hb-4 md:col-span-3">
          <Card padding="default">
            <CardHeader
              title="Suggested questions"
              subtitle={
                skills.length > 0
                  ? `Drawn from the candidate's listed skills and the ${interview.interview_type.replace(/_/g, ' ')} bank.`
                  : 'The candidate listed no skills, so these come from the standard bank.'
              }
              action={<Badge>{questions.length} questions</Badge>}
            />

            <ul className="space-y-2.5">
              {questions.map((q, idx) => (
                <motion.li
                  key={q.text}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.055 }}
                  className="flex gap-3 rounded-hb-md border border-hb-border bg-hb-surface-2 p-4"
                >
                  <span
                    aria-hidden
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-hb-sm bg-hb-grad font-mono text-hb-micro font-bold text-white"
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-hb-sm leading-relaxed text-hb-text">{q.text}</p>
                    <Badge className="mt-2">{q.tag}</Badge>
                  </div>
                </motion.li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-wrap gap-2.5">
            <Button
              icon={<Mic size={15} />}
              onClick={() => navigate(`/hiring/interviewer/live-room/${interviewId}`)}
              className="flex-1"
            >
              Start interview mode
            </Button>
            <Button
              variant="ghost"
              icon={<ClipboardCheck size={15} />}
              onClick={() => navigate(`/hiring/interviewer/scorecard/${interviewId}`)}
            >
              Scorecard
            </Button>
          </div>

          {!unlocked && (
            <p className="flex items-center justify-center gap-2 rounded-hb-md border border-hb-border bg-hb-surface-2 px-4 py-2.5 text-hb-xs text-hb-muted">
              <Sparkles size={14} aria-hidden className="shrink-0 text-hb-cyan" />
              Complete all {CHECKLIST_CRITERIA.length} checklist items to unlock the Google Meet
              link.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
