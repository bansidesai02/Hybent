import React, { useState, useEffect, useRef } from 'react'

export interface CandidateProfile {
  id: number
  name: string
  role: string
  experience: string
  topSkills: string[]
  fileName: string
  fileSize: string
  overallScore: number
  categoryScores: {
    skills: number
    experience: number
    relevance: number
    roleFit: number
  }
  scoreLabel: string
  scoreTier: 'excellent' | 'strong' | 'good' | 'potential' | 'low'
  extractedHighlights: { label: string; text: string }[]
  summary: string
  strengths: string[]
  missing: string[]
  decision: 'shortlisted' | 'review' | 'talent_pool'
  decisionLabel: string
  interview?: {
    type: string
    time: string
    interviewer: string
  }
  reviewNote?: string
}

const CANDIDATES: CandidateProfile[] = [
  {
    id: 1,
    name: 'John Anderson',
    role: 'Senior Frontend Developer',
    experience: '6 yrs exp',
    topSkills: ['React', 'TypeScript', 'Next.js'],
    fileName: 'john-anderson-resume.pdf',
    fileSize: '142 KB',
    overallScore: 91,
    categoryScores: {
      skills: 94,
      experience: 92,
      relevance: 90,
      roleFit: 88,
    },
    scoreLabel: 'Strong Match',
    scoreTier: 'strong',
    extractedHighlights: [
      { label: 'Experience', text: '6.2 yrs · Lead Frontend' },
      { label: 'Core Skills', text: 'React, Next.js, TS, Tailwind' },
      { label: 'Education', text: 'B.S. Computer Science' },
      { label: 'Certifications', text: 'AWS Solutions Architect' },
    ],
    summary: 'Strong React & Next.js background with solid frontend architecture experience.',
    strengths: ['React & Next.js', 'TypeScript', 'Frontend Arch'],
    missing: ['Limited Go / Backend'],
    decision: 'shortlisted',
    decisionLabel: 'Move to Shortlist',
    interview: {
      type: 'Technical Interview',
      time: 'Tuesday · 11:00 AM',
      interviewer: 'with Engineering Lead',
    },
  },
  {
    id: 2,
    name: 'Sarah Mitchell',
    role: 'Senior Product Designer',
    experience: '5 yrs exp',
    topSkills: ['Figma', 'Design Systems', 'User Research'],
    fileName: 'sarah-mitchell-cv.pdf',
    fileSize: '2.1 MB',
    overallScore: 78,
    categoryScores: {
      skills: 84,
      experience: 76,
      relevance: 81,
      roleFit: 70,
    },
    scoreLabel: 'Good Match',
    scoreTier: 'good',
    extractedHighlights: [
      { label: 'Experience', text: '5.1 yrs · Product Design' },
      { label: 'Core Skills', text: 'Design Systems, Tokens, Figma' },
      { label: 'Education', text: 'B.Des Interaction Design' },
      { label: 'Certifications', text: 'Nielsen Norman UX Certified' },
    ],
    summary: 'Extensive design system expertise with deep user testing background.',
    strengths: ['Design Systems', 'Figma Tokens', 'User Research'],
    missing: ['Basic HTML/CSS knowledge'],
    decision: 'shortlisted',
    decisionLabel: 'Move to Shortlist',
    interview: {
      type: 'Portfolio Review',
      time: 'Thursday · 2:30 PM',
      interviewer: 'with Head of Design',
    },
  },
  {
    id: 3,
    name: 'Michael Chen',
    role: 'Full Stack Engineer',
    experience: '3 yrs exp',
    topSkills: ['Node.js', 'Python', 'PostgreSQL'],
    fileName: 'michael-chen-resume.pdf',
    fileSize: '98 KB',
    overallScore: 67,
    categoryScores: {
      skills: 72,
      experience: 61,
      relevance: 70,
      roleFit: 65,
    },
    scoreLabel: 'Potential Match',
    scoreTier: 'potential',
    extractedHighlights: [
      { label: 'Experience', text: '3.0 yrs · Full Stack Dev' },
      { label: 'Core Skills', text: 'Node.js, Python, PostgreSQL' },
      { label: 'Education', text: 'B.E. Information Tech' },
      { label: 'Certifications', text: 'PostgreSQL Specialist' },
    ],
    summary: 'Solid backend capabilities, but less direct experience in target framework.',
    strengths: ['Node.js / Python', 'Database Schema', 'API Design'],
    missing: ['React experience', 'Senior leadership'],
    decision: 'review',
    decisionLabel: 'Needs Review',
    reviewNote: 'Routed to Hiring Manager review queue',
  },
  {
    id: 4,
    name: 'Emma Wilson',
    role: 'Junior Frontend Developer',
    experience: '1 yr exp',
    topSkills: ['HTML5', 'CSS3', 'JavaScript'],
    fileName: 'emma-wilson-resume.pdf',
    fileSize: '115 KB',
    overallScore: 48,
    categoryScores: {
      skills: 52,
      experience: 44,
      relevance: 51,
      roleFit: 45,
    },
    scoreLabel: 'Low Match',
    scoreTier: 'low',
    extractedHighlights: [
      { label: 'Experience', text: '1.2 yrs · Junior Frontend' },
      { label: 'Core Skills', text: 'HTML5, CSS3, JavaScript' },
      { label: 'Education', text: 'Bootcamp Graduate (2024)' },
      { label: 'Certifications', text: 'Frontend Foundations' },
    ],
    summary: 'Strong foundational fundamentals, but lacks required 5+ years seniority.',
    strengths: ['Quick Learner', 'Modern JavaScript'],
    missing: ['TypeScript', 'System Design', 'Cloud Infra'],
    decision: 'talent_pool',
    decisionLabel: 'Saved to Talent Pool',
    reviewNote: 'Indexed in permanent talent pool for junior openings',
  },
  {
    id: 5,
    name: 'David Carter',
    role: 'Principal Systems Architect',
    experience: '10 yrs exp',
    topSkills: ['Distributed Systems', 'Kubernetes', 'Go'],
    fileName: 'david-carter-cv.pdf',
    fileSize: '180 KB',
    overallScore: 96,
    categoryScores: {
      skills: 98,
      experience: 94,
      relevance: 97,
      roleFit: 91,
    },
    scoreLabel: 'Excellent Match',
    scoreTier: 'excellent',
    extractedHighlights: [
      { label: 'Experience', text: '10.5 yrs · Principal Architect' },
      { label: 'Core Skills', text: 'Kubernetes, Go, Microservices' },
      { label: 'Education', text: 'M.S. Computer Engineering' },
      { label: 'Certifications', text: 'CKA Certified Kubernetes' },
    ],
    summary: 'Exceptional distributed systems background; exceeds technical requirements.',
    strengths: ['Kubernetes / Go', 'High Scale Systems', 'Tech Leadership'],
    missing: ['None identified'],
    decision: 'shortlisted',
    decisionLabel: 'Fast-track Shortlist',
    interview: {
      type: 'Exec & Arch Deep Dive',
      time: 'Monday · 10:00 AM',
      interviewer: 'with VP of Engineering',
    },
  },
]

type Stage = 0 | 1 | 2 | 3
// 0: Resume Intake & Scanning
// 1: AI Screening & Evaluation Metrics
// 2: Match Score & Recommendation
// 3: Decision & Interview / Pool Routing (Completed)

export function AiRecruitmentWorkflowAnimation() {
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [stage, setStage] = useState<Stage>(0)
  const [displayScore, setDisplayScore] = useState(0)
  const [parseProgress, setParseProgress] = useState(0)
  const [isScanning, setIsScanning] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [scanKey, setScanKey] = useState(0) // increment to re-trigger scan
  const [hasScrolledAway, setHasScrolledAway] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const candidate = CANDIDATES[candidateIndex]

  // Viewport visibility detection
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          // User scrolled away
          setHasScrolledAway(true)
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Scan workflow runner
  useEffect(() => {
    let cancelled = false
    setIsScanning(true)
    setIsTransitioning(false)
    setStage(0)
    setDisplayScore(0)
    setParseProgress(18)

    // Stage 0: Resume Intake & Parsing
    const p1 = setTimeout(() => {
      if (!cancelled) setParseProgress(68)
    }, 600)

    const p2 = setTimeout(() => {
      if (!cancelled) setParseProgress(100)
    }, 1600)

    // Stage 1: AI Screening Breakdown
    const s1 = setTimeout(() => {
      if (!cancelled) {
        setStage(1)
      }
    }, 2400)

    // Stage 2: Overall Score & AI Insights
    const s2 = setTimeout(() => {
      if (!cancelled) {
        setStage(2)
        const target = candidate.overallScore
        let current = 0
        const stepTime = 25
        const totalSteps = 24
        const increment = target / totalSteps
        const scoreInterval = setInterval(() => {
          if (cancelled) {
            clearInterval(scoreInterval)
            return
          }
          current += increment
          if (current >= target) {
            setDisplayScore(target)
            clearInterval(scoreInterval)
          } else {
            setDisplayScore(Math.round(current))
          }
        }, stepTime)
      }
    }, 4800)

    // Stage 3: Decision & Interview / Action (Completed resting state)
    const s3 = setTimeout(() => {
      if (!cancelled) {
        setStage(3)
        setIsScanning(false)
      }
    }, 7200)

    return () => {
      cancelled = true
      clearTimeout(p1)
      clearTimeout(p2)
      clearTimeout(s1)
      clearTimeout(s2)
      clearTimeout(s3)
    }
  }, [candidateIndex, scanKey, candidate.overallScore])

  // Trigger Re-scan on current candidate
  const handleReScan = (idx?: number) => {
    setIsTransitioning(true)
    setTimeout(() => {
      if (typeof idx === 'number') {
        setCandidateIndex(idx)
      }
      setScanKey((k) => k + 1)
      setIsTransitioning(false)
    }, 180)
  }

  const handleNextCandidate = () => {
    const nextIdx = (candidateIndex + 1) % CANDIDATES.length
    handleReScan(nextIdx)
  }

  // Tier color styling tokens
  const getTierColors = (tier: CandidateProfile['scoreTier']) => {
    switch (tier) {
      case 'excellent':
        return {
          bg: 'rgba(34,207,255,0.12)',
          border: 'rgba(34,207,255,0.3)',
          text: '#06B6D4',
          accent: '#22CFFF',
          ring: '#06B6D4',
        }
      case 'strong':
        return {
          bg: 'rgba(76,111,255,0.12)',
          border: 'rgba(76,111,255,0.3)',
          text: '#4C6FFF',
          accent: '#6366F1',
          ring: '#4C6FFF',
        }
      case 'good':
        return {
          bg: 'rgba(16,185,129,0.12)',
          border: 'rgba(16,185,129,0.3)',
          text: '#10B981',
          accent: '#059669',
          ring: '#10B981',
        }
      case 'potential':
        return {
          bg: 'rgba(245,158,11,0.12)',
          border: 'rgba(245,158,11,0.3)',
          text: '#D97706',
          accent: '#F59E0B',
          ring: '#F59E0B',
        }
      case 'low':
      default:
        return {
          bg: 'rgba(100,116,139,0.12)',
          border: 'rgba(100,116,139,0.25)',
          text: '#64748B',
          accent: '#94A3B8',
          ring: '#94A3B8',
        }
    }
  }

  const tierColors = getTierColors(candidate.scoreTier)

  // Calculate SVG circular ring parameters
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (displayScore / 100) * circumference

  return (
    <div
      ref={containerRef}
      className="hybent-live-wf"
      style={{
        width: '100%',
        maxWidth: '100%',
        borderRadius: '16px',
        background: '#FFFFFF',
        border: '1px solid rgba(11, 18, 32, 0.08)',
        boxShadow: '0 4px 24px -6px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none',
        fontFamily: 'var(--f-body, "Manrope", system-ui, sans-serif)',
        color: '#1E293B',
      }}
    >
      {/* ── Dashboard Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: '#FFFFFF',
          borderBottom: '1px solid rgba(11, 18, 32, 0.06)',
          fontSize: '0.82rem',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isScanning ? '#22CFFF' : '#10B981',
              boxShadow: isScanning
                ? '0 0 0 3px rgba(34, 207, 255, 0.3)'
                : '0 0 0 3px rgba(16, 185, 129, 0.2)',
              animation: isScanning ? 'hbPulse 1.2s infinite' : 'none',
            }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: '0.78rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#475569',
              fontFamily: 'var(--f-mono, "IBM Plex Mono", monospace)',
            }}
          >
            AI Hiring Pipeline
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '2px 7px',
              borderRadius: '999px',
              background: isScanning ? 'rgba(34,207,255,0.12)' : 'rgba(16,185,129,0.12)',
              color: isScanning ? '#0284C7' : '#059669',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isScanning ? 'Scanning...' : 'Scan Complete'}
          </span>
        </div>

        {/* Action Controls & Candidate Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Re-scan Button */}
          <button
            onClick={() => handleReScan()}
            title="Re-run AI Resume Scan"
            aria-label="Re-scan Resume"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(76, 111, 255, 0.25)',
              background: isScanning ? '#F8FAFC' : 'rgba(76, 111, 255, 0.08)',
              color: '#4C6FFF',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{
                transform: isScanning ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.4s ease',
              }}
            >
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>Re-scan</span>
          </button>

          {/* Candidate Switcher Dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}>
            {CANDIDATES.map((c, i) => (
              <button
                key={c.id}
                onClick={() => handleReScan(i)}
                title={`${c.name} (${c.overallScore}%)`}
                aria-label={`View Candidate ${c.name}`}
                style={{
                  width: candidateIndex === i ? '20px' : '7px',
                  height: '7px',
                  borderRadius: '4px',
                  border: 'none',
                  background:
                    candidateIndex === i
                      ? 'linear-gradient(90deg, #4C6FFF, #22CFFF)'
                      : 'rgba(148, 163, 184, 0.35)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.3, 1)',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Dynamic Stage Area ── */}
      <div
        style={{
          padding: '18px 20px',
          minHeight: '230px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? 'translateY(4px)' : 'translateY(0)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        {/* ════ STAGE 0: Resume Intake & Scanning ════ */}
        {stage === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Animated AI Scanning Laser Line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #22CFFF, #4C6FFF, transparent)',
                  boxShadow: '0 0 10px #22CFFF',
                  animation: 'hbScanLine 1.4s ease-in-out infinite',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '9px',
                    background: 'linear-gradient(135deg, rgba(76,111,255,0.12), rgba(34,207,255,0.12))',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#4C6FFF',
                    fontSize: '18px',
                    flexShrink: 0,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.96rem', color: '#0F172A' }}>
                      {candidate.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: '#F1F5F9',
                        color: '#64748B',
                      }}
                    >
                      {candidate.experience}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                    {candidate.role}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#4C6FFF',
                    fontFamily: 'var(--f-mono, monospace)',
                  }}
                >
                  {candidate.fileName}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>{candidate.fileSize}</div>
              </div>
            </div>

            {/* Parsing Progress Bar & Extracted tags */}
            <div
              style={{
                background: '#FFFFFF',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(11, 18, 32, 0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.76rem',
                  marginBottom: '8px',
                }}
              >
                <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: parseProgress === 100 ? '#10B981' : '#4C6FFF',
                    }}
                  />
                  {parseProgress === 100 ? 'Resume parsed successfully' : `Parsing resume structure... ${parseProgress}%`}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--f-mono, monospace)',
                    fontWeight: 600,
                    color: parseProgress === 100 ? '#10B981' : '#4C6FFF',
                  }}
                >
                  {parseProgress === 100 ? '✓ Complete' : `${parseProgress}%`}
                </span>
              </div>

              {/* Progress track */}
              <div
                style={{
                  height: '4px',
                  background: '#E2E8F0',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  marginBottom: '10px',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${parseProgress}%`,
                    background: 'linear-gradient(90deg, #4C6FFF, #22CFFF)',
                    borderRadius: '999px',
                    transition: 'width 0.6s cubic-bezier(0.2, 0.8, 0.3, 1)',
                  }}
                />
              </div>

              {/* Extraction criteria chips */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {candidate.extractedHighlights.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.72rem',
                      color: parseProgress >= 50 ? '#334155' : '#94A3B8',
                      background: '#F8FAFC',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      transition: 'all 0.3s ease',
                      opacity: parseProgress >= (idx + 1) * 25 ? 1 : 0.4,
                    }}
                  >
                    <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span>
                    <strong style={{ fontWeight: 600 }}>{item.label}:</strong>
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: '#64748B',
                      }}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ STAGE 1: AI Screening & Criteria Breakdown ════ */}
        {stage === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#64748B',
                    fontFamily: 'var(--f-mono, monospace)',
                  }}
                >
                  Phase 02 · AI Screening
                </span>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A', marginTop: '1px' }}>
                  Evaluating {candidate.name} against rubric
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  background: 'rgba(34,207,255,0.12)',
                  color: '#0284C7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#0284C7',
                    animation: 'hbPulse 1.5s infinite',
                  }}
                />
                Analyzing Competencies
              </span>
            </div>

            {/* Evaluation Bars */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: '#FFFFFF',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(11, 18, 32, 0.06)',
              }}
            >
              {[
                { label: 'Skills Match', score: candidate.categoryScores.skills },
                { label: 'Experience Match', score: candidate.categoryScores.experience },
                { label: 'Role Relevance', score: candidate.categoryScores.relevance },
                { label: 'Culture / Role Fit', score: candidate.categoryScores.roleFit },
              ].map((metric, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.74rem',
                      fontWeight: 500,
                      color: '#475569',
                    }}
                  >
                    <span>{metric.label}</span>
                    <span style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'var(--f-mono, monospace)' }}>
                      {metric.score}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: '5px',
                      background: '#F1F5F9',
                      borderRadius: '999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${metric.score}%`,
                        background:
                          metric.score >= 80
                            ? 'linear-gradient(90deg, #4C6FFF, #22CFFF)'
                            : metric.score >= 65
                            ? 'linear-gradient(90deg, #3B82F6, #60A5FA)'
                            : 'linear-gradient(90deg, #94A3B8, #CBD5E1)',
                        borderRadius: '999px',
                        animation: `hbFillBar 0.8s cubic-bezier(0.2, 0.8, 0.3, 1) forwards`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ STAGE 2: Overall Match Score & AI Recommendation ════ */}
        {stage === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                gap: '14px',
                alignItems: 'center',
                background: '#FFFFFF',
                padding: '12px 14px',
                borderRadius: '12px',
                border: `1px solid ${tierColors.border}`,
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
              }}
            >
              {/* Left: Circular Progress Gauge */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <svg width="68" height="68" viewBox="0 0 68 68">
                  <circle
                    cx="34"
                    cy="34"
                    r={radius}
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="5"
                  />
                  <circle
                    cx="34"
                    cy="34"
                    r={radius}
                    fill="none"
                    stroke={tierColors.ring}
                    strokeWidth="5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform="rotate(-90 34 34)"
                    style={{ transition: 'stroke-dashoffset 0.4s ease-out' }}
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      lineHeight: 1,
                      fontFamily: 'var(--f-display, "Sora", sans-serif)',
                      color: '#0F172A',
                    }}
                  >
                    {displayScore}%
                  </div>
                  <div
                    style={{
                      fontSize: '0.55rem',
                      color: '#64748B',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      marginTop: '2px',
                    }}
                  >
                    Match
                  </div>
                </div>
              </div>

              {/* Right: Score Tier & AI Insight */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: tierColors.bg,
                      color: tierColors.text,
                      border: `1px solid ${tierColors.border}`,
                    }}
                  >
                    {candidate.scoreLabel}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>AI Evaluation</span>
                </div>
                <p
                  style={{
                    fontSize: '0.78rem',
                    lineHeight: '1.45',
                    color: '#334155',
                    margin: 0,
                    fontWeight: 500,
                  }}
                >
                  “{candidate.summary}”
                </p>
              </div>
            </div>

            {/* Key Strengths & Missing Criteria */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '0.72rem',
              }}
            >
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                }}
              >
                <div style={{ fontWeight: 700, color: '#059669', marginBottom: '4px' }}>
                  ✓ Key Strengths
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {candidate.strengths.map((s, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        color: '#065F46',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 500,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1px solid rgba(100, 116, 139, 0.15)',
                }}
              >
                <div style={{ fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                  ⚠ Gaps / Considerations
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {candidate.missing.map((m, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: '#F1F5F9',
                        color: '#475569',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 500,
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ STAGE 3: Decision & Interview Scheduling / Routing (COMPLETED STATE) ════ */}
        {stage === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Candidate Summary Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid rgba(11, 18, 32, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: tierColors.bg,
                    color: tierColors.text,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {candidate.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>
                    {candidate.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{candidate.role}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: tierColors.text,
                    fontFamily: 'var(--f-mono, monospace)',
                  }}
                >
                  {candidate.overallScore}% Match
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    background: tierColors.bg,
                    color: tierColors.text,
                    border: `1px solid ${tierColors.border}`,
                  }}
                >
                  {candidate.decisionLabel}
                </span>
              </div>
            </div>

            {/* Shortlisted Flow: Interview Scheduled Card */}
            {candidate.decision === 'shortlisted' && candidate.interview && (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(76,111,255,0.05), rgba(34,207,255,0.05))',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(76,111,255,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  animation: 'hbSlideUp 0.35s cubic-bezier(0.2, 0.8, 0.3, 1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: '#FFFFFF',
                      border: '1px solid rgba(76,111,255,0.2)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#4C6FFF',
                      fontSize: '16px',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0F172A' }}>
                      {candidate.interview.type}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#4C6FFF', fontWeight: 600 }}>
                      {candidate.interview.time}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                      {candidate.interview.interviewer}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#059669',
                    background: '#FFFFFF',
                    padding: '5px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <span style={{ fontSize: '0.9rem' }}>✓</span> Interview Scheduled
                </div>
              </div>
            )}

            {/* Non-shortlisted Flow: Review / Pool Routing */}
            {candidate.decision !== 'shortlisted' && (
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(100, 116, 139, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  animation: 'hbSlideUp 0.35s cubic-bezier(0.2, 0.8, 0.3, 1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#64748B',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#334155' }}>
                      {candidate.decision === 'review' ? 'Manual Review Queued' : 'Talent Pool Indexed'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>
                      {candidate.reviewNote}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#64748B',
                    background: '#F1F5F9',
                    padding: '5px 9px',
                    borderRadius: '8px',
                  }}
                >
                  {candidate.decision === 'review' ? 'Needs Review' : 'Talent DB'}
                </div>
              </div>
            )}

            {/* Resting State Interactive Action Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#F8FAFC',
                borderRadius: '8px',
                border: '1px dashed rgba(11, 18, 32, 0.12)',
                fontSize: '0.74rem',
              }}
            >
              <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span>
                Workflow finished for {candidate.name}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleReScan()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(76, 111, 255, 0.3)',
                    background: '#FFFFFF',
                    color: '#4C6FFF',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  ↻ Re-scan This Resume
                </button>
                <button
                  onClick={handleNextCandidate}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'linear-gradient(90deg, #4C6FFF, #22CFFF)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  Scan Next Profile →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Pipeline Progress Stepper ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          padding: '10px 16px',
          background: '#FFFFFF',
          borderTop: '1px solid rgba(11, 18, 32, 0.06)',
          fontSize: '0.72rem',
        }}
      >
        {[
          { label: 'Applied', step: 0, phase: 'Intake' },
          { label: 'Screening', step: 1, phase: 'AI Scoring' },
          { label: 'Shortlist', step: 2, phase: 'Rubric' },
          {
            label: candidate.decision === 'shortlisted' ? 'Interview' : 'Talent Pool',
            step: 3,
            phase: 'Action',
          },
        ].map((item, idx) => {
          const isCompleted = stage > item.step
          const isActive = stage === item.step || (item.step === 3 && stage >= 3)
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    background: isCompleted
                      ? '#10B981'
                      : isActive
                      ? '#4C6FFF'
                      : '#E2E8F0',
                    color: isCompleted || isActive ? '#FFFFFF' : '#94A3B8',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isCompleted ? '✓' : idx + 1}
                </span>
                <span
                  style={{
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#0F172A' : isCompleted ? '#334155' : '#94A3B8',
                    transition: 'color 0.3s ease',
                  }}
                >
                  {item.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Embedded Micro-Animation Keyframes */}
      <style>{`
        @keyframes hbScanLine {
          0% { transform: translateY(0); opacity: 0.8; }
          50% { transform: translateY(58px); opacity: 1; }
          100% { transform: translateY(0); opacity: 0.8; }
        }
        @keyframes hbPulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        @keyframes hbFillBar {
          0% { width: 0%; }
          100% { width: inherit; }
        }
        @keyframes hbSlideUp {
          0% { transform: translateY(8px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hybent-live-wf * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}
