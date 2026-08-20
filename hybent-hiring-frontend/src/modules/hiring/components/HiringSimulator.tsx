import React, { useState, useEffect, useRef } from 'react'

interface CandidateProfile {
  id: string
  role: string
  name: string
  title: string
  avatar: string
  experience: string
  matchScore: number
  threshold: number
  verdict: string
  verdictType: 'strong' | 'pass'
  skills: { name: string; match: boolean }[]
  criteriaScores: { label: string; score: number }[]
  aiSummary: string
  suggestedSlot: string
}

const CANDIDATES: CandidateProfile[] = [
  {
    id: 'fullstack',
    role: 'Senior Full-Stack',
    name: 'Alex Rivera',
    title: 'Lead Full-Stack Architect',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    experience: '8.5 Yrs Exp · Ex-Stripe',
    matchScore: 96,
    threshold: 85,
    verdict: 'Strong Auto-Shortlist',
    verdictType: 'strong',
    skills: [
      { name: 'React / Next.js', match: true },
      { name: 'TypeScript', match: true },
      { name: 'Node.js / Go', match: true },
      { name: 'PostgreSQL & Redis', match: true },
      { name: 'System Design', match: true },
    ],
    criteriaScores: [
      { label: 'Core Stack Fit', score: 98 },
      { label: 'System Design', score: 95 },
      { label: 'Seniority & Scale', score: 96 },
    ],
    aiSummary: 'Exceeds threshold (96% vs 85%). 8+ yrs scaling high-concurrency apps. Dispatched technical interview invite.',
    suggestedSlot: 'Tomorrow at 2:00 PM EST',
  },
  {
    id: 'ai-ml',
    role: 'AI / ML Engineer',
    name: 'Dr. Sophia Chen',
    title: 'Senior Applied AI Researcher',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
    experience: '6.0 Yrs Exp · PhD Machine Learning',
    matchScore: 94,
    threshold: 85,
    verdict: 'Strong Auto-Shortlist',
    verdictType: 'strong',
    skills: [
      { name: 'PyTorch / LLMs', match: true },
      { name: 'RAG Pipelines', match: true },
      { name: 'Python / FastAPI', match: true },
      { name: 'Vector DBs', match: true },
      { name: 'GPU Clusters', match: true },
    ],
    criteriaScores: [
      { label: 'Modeling & Math', score: 97 },
      { label: 'Agent Architecture', score: 95 },
      { label: 'Inference Speed', score: 91 },
    ],
    aiSummary: 'Top tier candidate. Published research in semantic vector search and low-latency inference pipelines.',
    suggestedSlot: 'Thursday at 11:00 AM EST',
  },
  {
    id: 'devops-cloud',
    role: 'DevOps & Cloud',
    name: 'James Miller',
    title: 'Staff Site Reliability Engineer',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    experience: '7.0 Yrs Exp · AWS Certified',
    matchScore: 91,
    threshold: 85,
    verdict: 'Auto-Shortlisted',
    verdictType: 'pass',
    skills: [
      { name: 'Kubernetes (EKS)', match: true },
      { name: 'Terraform IaC', match: true },
      { name: 'CI/CD Pipelines', match: true },
      { name: 'Zero-Trust IAM', match: true },
      { name: 'Observability', match: true },
    ],
    criteriaScores: [
      { label: 'Kubernetes & IaC', score: 94 },
      { label: 'Security & Auth', score: 90 },
      { label: 'Cloud Architecture', score: 89 },
    ],
    aiSummary: 'Strong match for enterprise platform infrastructure. Solid track record in multi-region failover design.',
    suggestedSlot: 'Wednesday at 4:00 PM EST',
  },
  {
    id: 'product-design',
    role: 'Product Designer',
    name: 'Marcus Vance',
    title: 'Staff UI/UX Designer',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    experience: '7.5 Yrs Exp · B2B SaaS',
    matchScore: 88,
    threshold: 80,
    verdict: 'Shortlisted for Review',
    verdictType: 'pass',
    skills: [
      { name: 'Design Systems', match: true },
      { name: 'Figma Auto-Layout', match: true },
      { name: 'WCAG 2.1 AA', match: true },
      { name: 'Design Tokens', match: true },
      { name: 'Prototyping', match: true },
    ],
    criteriaScores: [
      { label: 'Component Kits', score: 94 },
      { label: 'SaaS UX Polish', score: 87 },
      { label: 'Accessibility', score: 86 },
    ],
    aiSummary: 'Solid portfolio in complex data dashboards and multi-brand tokenized Figma design systems.',
    suggestedSlot: 'Friday at 3:30 PM EST',
  },
]

export function HiringSimulator() {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scanState, setScanState] = useState<'scanning' | 'scoring' | 'complete'>('complete')
  const [animatedScore, setAnimatedScore] = useState(CANDIDATES[0].matchScore)
  const [visibleSkillsCount, setVisibleSkillsCount] = useState(5)
  const [scheduledState, setScheduledState] = useState<Record<string, boolean>>({ fullstack: true })

  const candidate = CANDIDATES[selectedIndex]
  const isScheduled = Boolean(scheduledState[candidate.id])

  // Run a realistic scan sequence
  const startScanSequence = (targetCandidate: CandidateProfile) => {
    setScanState('scanning')
    setAnimatedScore(0)
    setVisibleSkillsCount(0)

    // Step 1: Reveal skills during scan (100ms - 600ms)
    const skillTimers: NodeJS.Timeout[] = []
    targetCandidate.skills.forEach((_, idx) => {
      const timer = setTimeout(() => {
        setVisibleSkillsCount(idx + 1)
      }, 120 * (idx + 1))
      skillTimers.push(timer)
    })

    // Step 2: Trigger scoring count up (800ms)
    const scoringTimer = setTimeout(() => {
      setScanState('scoring')
      let current = 0
      const target = targetCandidate.matchScore
      const duration = 600
      const step = 20
      const increment = target / (duration / step)

      const counter = setInterval(() => {
        current += increment
        if (current >= target) {
          setAnimatedScore(target)
          setScanState('complete')
          clearInterval(counter)
        } else {
          setAnimatedScore(Math.floor(current))
        }
      }, step)
    }, 800)

    return () => {
      skillTimers.forEach(clearTimeout)
      clearTimeout(scoringTimer)
    }
  }

  // Initial load or tab switch
  const handleSelectCandidate = (index: number) => {
    setSelectedIndex(index)
    startScanSequence(CANDIDATES[index])
  }

  // Re-scan button click
  const handleReScan = () => {
    startScanSequence(candidate)
  }

  const handleSchedule = () => {
    setScheduledState((prev) => ({
      ...prev,
      [candidate.id]: true,
    }))
  }

  return (
    <div
      className="card card--flat"
      style={{
        width: '100%',
        maxWidth: '920px',
        marginInline: 'auto',
        marginTop: 'clamp(28px, 4vw, 40px)',
        borderRadius: 'var(--r-lg)',
        background: 'linear-gradient(160deg, #FFFFFF 0%, rgba(248, 250, 253, 0.96) 100%)',
        border: '1px solid rgba(203, 213, 225, 0.9)',
        boxShadow: '0 24px 60px -15px rgba(76, 111, 255, 0.14), 0 4px 18px -6px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden',
        position: 'relative',
        textAlign: 'left',
      }}
      data-rv="scale"
    >
      {/* Laser Scanning Animation Bar (Active during 'scanning') */}
      {scanState === 'scanning' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent, var(--cyan), var(--blue), transparent)',
            boxShadow: '0 0 12px var(--cyan)',
            animation: 'scanline 0.8s ease-in-out infinite alternate',
            zIndex: 10,
          }}
        />
      )}

      {/* Top Window Chrome Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(241, 245, 249, 0.75)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF5F56', display: 'inline-block' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFBD2E', display: 'inline-block' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27C93F', display: 'inline-block' }} />
          </div>
          <span
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: '10.5px',
              color: '#475569',
              fontWeight: 600,
              marginLeft: '6px',
            }}
          >
            hybent-hiring://autopilot.simulator
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '10px',
              fontFamily: 'var(--f-mono)',
              color: scanState === 'scanning' ? '#0284C7' : 'var(--success)',
              background: scanState === 'scanning' ? 'rgba(34, 207, 255, 0.12)' : 'rgba(16, 185, 129, 0.1)',
              border: scanState === 'scanning' ? '1px solid rgba(34, 207, 255, 0.3)' : '1px solid rgba(16, 185, 129, 0.25)',
              padding: '2px 8px',
              borderRadius: '20px',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: scanState === 'scanning' ? 'var(--cyan)' : 'var(--success)',
                animation: scanState === 'scanning' ? 'pulse 0.6s infinite' : 'none',
              }}
            />
            {scanState === 'scanning' ? 'AI SCANNING RESUME...' : 'AI ENGINE VERIFIED'}
          </span>

          <button
            type="button"
            onClick={handleReScan}
            style={{
              background: 'linear-gradient(135deg, rgba(76, 111, 255, 0.1), rgba(34, 207, 255, 0.1))',
              border: '1px solid rgba(76, 111, 255, 0.3)',
              borderRadius: '6px',
              padding: '3px 10px',
              fontSize: '10.5px',
              fontFamily: 'var(--f-mono)',
              color: 'var(--blue)',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            title="Click to trigger live resume scanning animation"
          >
            <span>⚡</span> Re-Scan Resume
          </button>
        </div>
      </div>

      {/* Role Switcher Tabs (4 Technical Roles) */}
      <div
        style={{
          padding: '8px 16px',
          background: '#FFFFFF',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10.5px', fontFamily: 'var(--f-mono)', color: 'var(--dim)', textTransform: 'uppercase', marginRight: '4px' }}>
            Candidates:
          </span>
          {CANDIDATES.map((c, i) => {
            const isActive = selectedIndex === i
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectCandidate(i)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  border: isActive ? '1px solid var(--blue)' : '1px solid var(--border)',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(76, 111, 255, 0.12), rgba(34, 207, 255, 0.12))'
                    : 'rgba(248, 250, 253, 0.8)',
                  color: isActive ? 'var(--blue)' : '#64748B',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{c.role}</span>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--f-mono)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isActive ? 'var(--blue)' : 'rgba(100, 116, 139, 0.12)',
                    color: isActive ? '#FFFFFF' : '#475569',
                    fontWeight: 700,
                  }}
                >
                  {c.matchScore}%
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ fontSize: '0.72rem', color: 'var(--dim)', fontFamily: 'var(--f-mono)' }}>
          ⚡ 0.6s AI Vector Search
        </div>
      </div>

      {/* Simulator 3-Column Compact Grid */}
      <div
        style={{
          padding: '16px 18px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '14px',
          alignItems: 'stretch',
        }}
      >
        {/* ── STAGE 01: Resume Intake & Extraction ───────────────────── */}
        <div
          style={{
            background: '#FFFFFF',
            border: scanState === 'scanning' ? '1px solid var(--cyan)' : '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: scanState === 'scanning' ? '0 0 16px rgba(34, 207, 255, 0.15)' : 'none',
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--f-mono)', color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                01 · RESUME INTELLIGENCE
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--f-mono)',
                  color: scanState === 'scanning' ? '#0284C7' : 'var(--success)',
                  fontWeight: 600,
                }}
              >
                {scanState === 'scanning' ? 'PARSING PDF...' : 'PARSED & INDEXED (0.6S)'}
              </span>
            </div>

            {/* Candidate Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <img
                src={candidate.avatar}
                alt={candidate.name}
                style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(76, 111, 255, 0.25)' }}
              />
              <div>
                <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: '#0F172A' }}>{candidate.name}</h4>
                <div style={{ fontSize: '0.74rem', color: 'var(--blue)', fontWeight: 600 }}>{candidate.title}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--dim)', fontFamily: 'var(--f-mono)' }}>{candidate.experience}</div>
              </div>
            </div>

            {/* Extracted Skills Animated List */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '0.68rem', fontFamily: 'var(--f-mono)', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
                Verified Skills ({visibleSkillsCount}/{candidate.skills.length}):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '44px' }}>
                {candidate.skills.slice(0, visibleSkillsCount).map((s, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.68rem',
                      fontFamily: 'var(--f-mono)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(76, 111, 255, 0.08)',
                      border: '1px solid rgba(76, 111, 255, 0.2)',
                      color: 'var(--blue)',
                      fontWeight: 600,
                      animation: 'fadeIn 0.2s ease',
                    }}
                  >
                    ✓ {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '6px 10px',
              background: 'rgba(241, 245, 249, 0.8)',
              borderRadius: '6px',
              fontSize: '0.68rem',
              color: '#475569',
              fontFamily: 'var(--f-mono)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Format: PDF Resume</span>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>100% Vectorized</span>
          </div>
        </div>

        {/* ── STAGE 02: AI Match Scoring ─────────────────────────────── */}
        <div
          style={{
            background: 'linear-gradient(160deg, #FFFFFF, rgba(248, 250, 253, 0.9))',
            border: '1px solid rgba(76, 111, 255, 0.22)',
            borderRadius: 'var(--r-md)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 6px 16px -8px rgba(76, 111, 255, 0.12)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--f-mono)', color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                02 · AI MATCH SCORE
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--f-mono)',
                  color: candidate.verdictType === 'strong' ? '#059669' : 'var(--blue)',
                  background: candidate.verdictType === 'strong' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(76, 111, 255, 0.1)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 700,
                }}
              >
                PASSES THRESHOLD ({candidate.threshold}%)
              </span>
            </div>

            {/* Score Ring Gauge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'var(--grad)',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 6px 16px rgba(76, 111, 255, 0.25)',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: '0.98rem',
                    color: '#0F172A',
                    fontFamily: 'var(--f-display)',
                  }}
                >
                  {animatedScore}%
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A' }}>{candidate.verdict}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.3 }}>
                  Threshold: {candidate.threshold}% · Precision match verified
                </div>
              </div>
            </div>

            {/* Criteria Bars */}
            <div style={{ display: 'grid', gap: '6px', marginBottom: '10px' }}>
              {candidate.criteriaScores.map((cr, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{cr.label}</span>
                    <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: 'var(--blue)' }}>
                      {scanState === 'scanning' ? '0%' : `${cr.score}%`}
                    </span>
                  </div>
                  <div style={{ height: '3px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: scanState === 'scanning' ? '0%' : `${cr.score}%`,
                        background: 'linear-gradient(90deg, var(--cyan), var(--blue))',
                        borderRadius: '3px',
                        transition: 'width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: '6px 10px',
              background: 'rgba(76, 111, 255, 0.05)',
              borderLeft: '2px solid var(--blue)',
              borderRadius: '0 4px 4px 0',
              fontSize: '0.7rem',
              color: '#334155',
              lineHeight: 1.4,
            }}
          >
            <strong>AI Note:</strong> {candidate.aiSummary}
          </div>
        </div>

        {/* ── STAGE 03: Autopilot Scheduling ─────────────────────────── */}
        <div
          style={{
            background: '#FFFFFF',
            border: isScheduled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--f-mono)', color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                03 · AUTOPILOT ACTIONS
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--f-mono)',
                  color: isScheduled ? '#10B981' : '#F59E0B',
                  fontWeight: 700,
                }}
              >
                {isScheduled ? 'INVITE DISPATCHED' : 'READY TO BOOK'}
              </span>
            </div>

            {/* Checklist */}
            <div style={{ display: 'grid', gap: '6px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#1E293B' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', display: 'grid', placeItems: 'center', fontSize: '9px', fontWeight: 800 }}>✓</span>
                <span>Auto-updated to <strong>Shortlisted</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#1E293B' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', display: 'grid', placeItems: 'center', fontSize: '9px', fontWeight: 800 }}>✓</span>
                <span>Hiring Team notified via Slack</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#1E293B' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', display: 'grid', placeItems: 'center', fontSize: '9px', fontWeight: 800 }}>✓</span>
                <span>Profile indexed in talent database</span>
              </div>
            </div>

            {/* Slot Box */}
            <div
              style={{
                background: 'rgba(241, 245, 249, 0.8)',
                border: '1px solid rgba(203, 213, 225, 0.8)',
                borderRadius: '6px',
                padding: '8px 10px',
                marginBottom: '10px',
              }}
            >
              <div style={{ fontSize: '0.66rem', fontFamily: 'var(--f-mono)', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 600 }}>
                Optimal Conflict-Free Slot:
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>📅</span> {candidate.suggestedSlot}
              </div>
            </div>
          </div>

          {/* Autopilot Status / Action */}
          <div>
            {!isScheduled ? (
              <button
                type="button"
                onClick={handleSchedule}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: 'var(--grad)',
                  color: '#05060B',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(76, 111, 255, 0.22)',
                }}
              >
                <span>⚡ Auto-Dispatch Google Meet</span>
              </button>
            ) : (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  textAlign: 'center',
                  color: '#059669',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                }}
              >
                🎉 Google Meet Sent: <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 600, color: '#334155' }}>meet.google.com/hyb-demo</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Live Metrics */}
      <div
        style={{
          background: 'rgba(241, 245, 249, 0.8)',
          borderTop: '1px solid var(--border)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '0.72rem',
          fontFamily: 'var(--f-mono)',
          color: 'var(--dim)',
        }}
      >
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <span>⏱️ <strong>Screening:</strong> 0.6s</span>
          <span>🎯 <strong>Precision:</strong> {candidate.matchScore}% Match</span>
          <span>📅 <strong>Scheduling:</strong> 1-Click Zero Emails</span>
        </div>
        <span style={{ color: 'var(--blue)', fontWeight: 600 }}>Interactive Autopilot Live Simulator</span>
      </div>
    </div>
  )
}
