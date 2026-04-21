import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  BookOpen, 
  Video, 
  Lock, 
  FileText, 
  User, 
  Sparkles, 
  Mic, 
  ClipboardCheck, 
  ArrowLeft 
} from 'lucide-react'
import { interviewsApi } from '@/api/interviews'
import { applicationsApi } from '@/api/applications'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { useInterviewStore, CHECKLIST_CRITERIA } from '@/store/interviewStore'
import { useAuthStore } from '@/store/authStore'

// ─── Question Generator ────────────────────────────────────────────────────────

interface Question {
  text: string
  tag: string
  tagColor: string
}

const SKILL_QUESTIONS: Record<string, Question[]> = {
  react: [
    { text: 'How do you manage complex state in React — when do you pick Redux vs Context vs Zustand?', tag: 'State Management', tagColor: '#6c47ff' },
    { text: 'Explain how React reconciliation works and how you\'ve optimized renders in production.', tag: 'React Deep Dive', tagColor: '#6c47ff' },
  ],
  typescript: [
    { text: 'How has TypeScript\'s strict mode caught real bugs in your codebase? Walk me through a specific example.', tag: 'TypeScript', tagColor: '#3b82f6' },
    { text: 'Explain generic types and how you\'ve used them to build reusable utilities or components.', tag: 'TypeScript', tagColor: '#3b82f6' },
  ],
  python: [
    { text: 'How do you approach async programming in Python — asyncio vs threading vs multiprocessing?', tag: 'Python', tagColor: '#f59e0b' },
    { text: 'Walk me through your experience with Python type hints and static analysis in production.', tag: 'Python', tagColor: '#f59e0b' },
  ],
  fastapi: [
    { text: 'How have you structured a FastAPI application for scale — routers, dependencies, middleware?', tag: 'Backend', tagColor: '#10b981' },
  ],
  django: [
    { text: 'Describe how you\'ve optimized Django ORM queries in a high-traffic application.', tag: 'Backend', tagColor: '#10b981' },
  ],
  nodejs: [
    { text: 'How do you handle backpressure and memory leaks in a Node.js backend under heavy load?', tag: 'Backend', tagColor: '#10b981' },
  ],
  sql: [
    { text: 'Walk me through a complex query optimization you\'ve done — indexes, execution plans, partitioning.', tag: 'Database', tagColor: '#8b5cf6' },
  ],
  postgresql: [
    { text: 'How have you used PostgreSQL-specific features (CTEs, window functions, JSONB) in production?', tag: 'Database', tagColor: '#8b5cf6' },
  ],
  aws: [
    { text: 'Describe your experience architecting on AWS — which services did you use and how did you handle cost optimization?', tag: 'Cloud', tagColor: '#f59e0b' },
  ],
  docker: [
    { text: 'How have you structured Docker multi-stage builds and container orchestration in your projects?', tag: 'DevOps', tagColor: '#06b6d4' },
  ],
  kubernetes: [
    { text: 'Walk me through a challenging Kubernetes deployment issue you debugged and resolved.', tag: 'DevOps', tagColor: '#06b6d4' },
  ],
  nextjs: [
    { text: 'Explain the difference between SSR, SSG, and ISR in Next.js — when do you use each?', tag: 'Frontend', tagColor: '#6c47ff' },
  ],
  graphql: [
    { text: 'How have you handled N+1 query problems in a GraphQL API? Walk me through your solution.', tag: 'Backend', tagColor: '#10b981' },
  ],
  redis: [
    { text: 'How have you used Redis for caching, pub/sub, or session storage? Describe a specific use case.', tag: 'Infrastructure', tagColor: '#ef4444' },
  ],
}

function generateQuestions(skills: string[], interviewType: string): Question[] {
  const result: Question[] = []
  const seen = new Set<string>()

  skills.forEach((skill) => {
    const key = skill.toLowerCase().replace(/[^a-z]/g, '')
    const qs = SKILL_QUESTIONS[key]
    if (qs) {
      qs.forEach((q) => {
        if (!seen.has(q.text)) {
          seen.add(q.text)
          result.push(q)
        }
      })
    }
  })

  // Always add system design + behavioral
  const systemDesign: Question = {
    text: 'Design a distributed system that needs to handle 1 million events per day with sub-second latency — walk me through your architecture decisions.',
    tag: 'System Design',
    tagColor: '#8b5cf6',
  }
  const technical: Question = {
    text: 'What does your ideal code review process look like? What do you look for as both an author and a reviewer?',
    tag: 'Technical Depth',
    tagColor: '#6c47ff',
  }
  const culture1: Question = {
    text: 'Tell me about a time you had a strong technical disagreement with a teammate. How did you resolve it and what did you learn?',
    tag: 'Culture Fit',
    tagColor: '#00d4c8',
  }
  const culture2: Question = {
    text: 'Describe a technical decision you made that turned out to be wrong. How did you course-correct?',
    tag: 'Culture Fit',
    tagColor: '#00d4c8',
  }

  if (!seen.has(systemDesign.text)) result.push(systemDesign)
  if (interviewType === 'technical' || interviewType === 'final') {
    if (!seen.has(technical.text)) result.push(technical)
  }
  if (!seen.has(culture1.text)) result.push(culture1)
  if (!seen.has(culture2.text)) result.push(culture2)

  return result.slice(0, 8)
}

// No local CHECKLIST constant needed, using CHECKLIST_CRITERIA from store

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrepKitPage() {
  const { interviewId } = useParams<{ interviewId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  
  const toggleStep = useInterviewStore(s => s.toggleStep)
  const checklists = useInterviewStore(s => s.checklists)
  const isComplete = useInterviewStore(s => s.isComplete)

  const interviewChecklist = checklists[interviewId!] || new Array(CHECKLIST_CRITERIA.length).fill(false)
  const checkedCount = interviewChecklist.filter(Boolean).length
  const isChecklistComplete = isComplete(interviewId!) || user?.role !== 'interviewer'

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

  const questions = (candidate && interview)
    ? generateQuestions(candidate.skills ?? [], interview.interview_type)
    : (interview ? generateQuestions([], interview.interview_type) : [])

  if (isLoading) {
    return (
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
          <div className="md:col-span-3">
            <Skeleton className="h-[480px] rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!interview) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-lite)' }}>
        Interview not found.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/interviewer/interviews')}
          style={{
            width: 36, height: 36, borderRadius: 10, border: '1px solid var(--input-border)',
            background: 'var(--input-bg)', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--text-mid)', flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={22} className="text-[var(--violet)]" /> Interview Prep Kit
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 2 }}>
            {interview.title} · AI-generated questions tailored to role + resume
          </p>
        </div>
        {interview.meeting_link && (
          isChecklistComplete ? (
            <a href={interview.meeting_link} target="_blank" rel="noreferrer">
              <button style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
                borderRadius: 8, background: 'rgba(16,185,129,0.10)', border: '1.5px solid rgba(16,185,129,0.30)',
                color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Sora', sans-serif",
              }}>
                <Video size={14} /> Google Meet
              </button>
            </a>
          ) : (
            <button 
              onClick={() => {}}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
                borderRadius: 8, background: 'var(--input-bg)', border: '1.5px solid var(--input-border)',
                color: 'var(--text-lite)', fontSize: 12, fontWeight: 700, cursor: 'not-allowed', fontFamily: "'Sora', sans-serif",
                opacity: 0.6
              }}
              title="Complete checklist to unlock link"
            >
              <Lock size={14} /> Link Locked
            </button>
          )
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-5 gap-6">

        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="md:col-span-2">

          {/* Candidate Snapshot */}
          <Card>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-lite)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
              Candidate Snapshot
            </p>
            {candidate ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <Avatar name={candidate.full_name} src={candidate.avatar_url} size="md" />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{candidate.full_name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-mid)' }}>{candidate.current_title ?? 'Candidate'}</p>
                    {candidate.current_company && (
                      <p style={{ fontSize: 11, color: 'var(--text-lite)' }}>{candidate.current_company}</p>
                    )}
                  </div>
                </div>

                {candidate.years_experience != null && (
                  <p style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600 }}>Experience:</span> {candidate.years_experience} years
                  </p>
                )}

                {candidate.skills?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-lite)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 7 }}>Skills</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {candidate.skills.slice(0, 12).map((skill) => (
                        <span key={skill} style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                          background: 'rgba(108,71,255,0.08)', color: '#6c47ff',
                          border: '1px solid rgba(108,71,255,0.15)',
                        }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {candidate.resume_url && (
                  <a href={candidate.resume_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 12 }}>
                    <button style={{
                      width: '100%', padding: '8px', borderRadius: 8, border: '1.5px solid rgba(108,71,255,0.25)',
                      background: 'rgba(108,71,255,0.05)', color: '#6c47ff', fontSize: 12,
                      fontWeight: 700, cursor: 'pointer', fontFamily: "'Sora', sans-serif",
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}>
                      <FileText size={14} /> View Resume
                    </button>
                  </a>
                )}
              </div>
            ) : (
              <div style={{ padding: '16px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 22, color: 'var(--text-mid)', display: 'flex', justifyContent: 'center' }}><User size={32} /></p>
                <p style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 6, fontWeight: 600 }}>
                  {interview.candidate_name ?? 'Candidate'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-lite)', marginTop: 3 }}>
                  Detailed profile unavailable
                </p>
              </div>
            )}
          </Card>

          {/* Pre-Interview Checklist */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-lite)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Pre-Interview Checklist
              </p>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                background: checkedCount === CHECKLIST_CRITERIA.length ? 'rgba(16,185,129,0.12)' : 'rgba(108,71,255,0.09)',
                color: checkedCount === CHECKLIST_CRITERIA.length ? '#059669' : '#6c47ff',
              }}>
                {checkedCount}/{CHECKLIST_CRITERIA.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {CHECKLIST_CRITERIA.map((item, idx) => (
                <label key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!interviewChecklist[idx]}
                    onChange={() => toggleStep(interviewId!, idx)}
                    style={{ accentColor: '#6c47ff', width: 14, height: 14, cursor: 'pointer', flexShrink: 0, marginTop: 1 }}
                  />
                  <span style={{
                    fontSize: 12, color: interviewChecklist[idx] ? 'var(--text-lite)' : 'var(--text-mid)',
                    fontWeight: interviewChecklist[idx] ? 400 : 500,
                    textDecoration: interviewChecklist[idx] ? 'line-through' : 'none',
                    lineHeight: 1.5, transition: 'all 0.15s',
                  }}>
                    {item}
                  </span>
                </label>
              ))}
            </div>
          </Card>

        </div>

        {/* Right Column: AI Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="md:col-span-3">
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} className="text-[var(--violet)]" /> AI-Generated Questions
              </h3>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: 'rgba(108,71,255,0.09)', color: '#6c47ff',
                border: '1px solid rgba(108,71,255,0.18)', textTransform: 'uppercase', letterSpacing: '0.8px',
              }}>
                Role + Resume Based
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {questions.map((q, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.055 }}
                  style={{
                    display: 'flex', gap: 12, padding: '14px 16px',
                    borderRadius: 12, background: 'rgba(108,71,255,0.03)',
                    border: '1px solid var(--card-border)',
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: 'linear-gradient(135deg, #6c47ff, #8b6bff)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0,
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, fontWeight: 500 }}>
                      {q.text}
                    </p>
                    <span style={{
                      display: 'inline-block', marginTop: 8, fontSize: 10, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 6,
                      color: q.tagColor, background: `${q.tagColor}15`,
                      border: `1px solid ${q.tagColor}25`,
                    }}>
                      {q.tag}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Action bar */}
          <div style={{ display: 'flex', gap: 10 }}>
            {interview.meeting_link && (
              isChecklistComplete ? (
                <a href={interview.meeting_link} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
                  <button style={{
                    width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Sora', sans-serif",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
                  }}>
                    <Video size={14} /> Enter Google Meet
                  </button>
                </a>
              ) : (
                <div style={{ flex: 1, opacity: 0.5, cursor: 'not-allowed' }}>
                  <button disabled style={{
                    width: '100%', padding: '11px 0', borderRadius: 10, border: '1.5px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-lite)', fontSize: 13, fontWeight: 700, cursor: 'not-allowed',
                    fontFamily: "'Sora', sans-serif",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
                  }}>
                    <Video size={14} /> Enter Google Meet
                  </button>
                </div>
              )
            )}
            <button
              onClick={() => navigate(`/interviewer/live-room/${interviewId}`)}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #6c47ff, #8b6bff)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Sora', sans-serif",
                boxShadow: '0 4px 14px rgba(108,71,255,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
              }}
            >
              <Mic size={14} /> Start Interview Mode
            </button>
            <button
              onClick={() => navigate(`/interviewer/scorecard/${interviewId}`)}
              style={{
                padding: '11px 18px', borderRadius: 10,
                border: '1.5px solid rgba(108,71,255,0.30)',
                background: 'none', color: '#6c47ff', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: "'Sora', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
              }}
            >
              <ClipboardCheck size={14} /> Scorecard
            </button>
          </div>

          {!isChecklistComplete && (
            <p style={{
              fontSize: 11, color: '#6c47ff', marginTop: 12, textAlign: 'center',
              fontWeight: 600, background: 'rgba(108,71,255,0.06)', padding: '8px', borderRadius: 8
            }}>
              <Sparkles size={14} className="inline-block mr-1" /> Complete all {CHECKLIST_CRITERIA.length} checklist items to unlock the Google Meet link
            </p>
          )}

        </div>
      </div>
    </div>
  )
}
