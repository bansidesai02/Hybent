import React, { useState, useEffect } from 'react'

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
  const [scanState, setScanState] = useState<'p1_parsing' | 'p2_scoring' | 'p3_dispatching' | 'complete'>('p1_parsing')
  const [animatedScore, setAnimatedScore] = useState(0)
  const [visibleSkillsCount, setVisibleSkillsCount] = useState(0)
  const [visibleChecklistCount, setVisibleChecklistCount] = useState(0)
  const [scheduledState, setScheduledState] = useState<Record<string, boolean>>({})
  const [scanKey, setScanKey] = useState(0)

  const candidate = CANDIDATES[selectedIndex]
  const isScheduled = Boolean(scheduledState[candidate.id])

  // Run the sequential scanning animation sequence
  const startScanSequence = (targetCandidate: CandidateProfile) => {
    setScanState('p1_parsing')
    setAnimatedScore(0)
    setVisibleSkillsCount(0)
    setVisibleChecklistCount(0)
    setScheduledState((prev) => ({ ...prev, [targetCandidate.id]: false }))

    const activeTimers: NodeJS.Timeout[] = []

    // --- PHASE 1: Resume Intake / Skills Reveal (0ms to 3000ms) ---
    targetCandidate.skills.forEach((_, idx) => {
      const timer = setTimeout(() => {
        setVisibleSkillsCount(idx + 1)
      }, 600 * (idx + 1))
      activeTimers.push(timer)
    })

    // --- PHASE 2: Transition to Scoring (Starts at 3500ms) ---
    const scoringTimer = setTimeout(() => {
      setScanState('p2_scoring')
      let current = 0
      const target = targetCandidate.matchScore
      const duration = 2000
      const step = 25
      const increment = target / (duration / step)

      const counter = setInterval(() => {
        current += increment
        if (current >= target) {
          setAnimatedScore(target)
          clearInterval(counter)
        } else {
          setAnimatedScore(Math.floor(current))
        }
      }, step)

      const intervalCleanup = setTimeout(() => clearInterval(counter), duration + 100)
      activeTimers.push(intervalCleanup)
    }, 3500)
    activeTimers.push(scoringTimer)

    // --- PHASE 3: Transition to Autopilot Actions (Starts at 7000ms) ---
    const dispatchTimer = setTimeout(() => {
      setScanState('p3_dispatching')

      // Tick off checklist items one-by-one
      const t1 = setTimeout(() => setVisibleChecklistCount(1), 500)
      const t2 = setTimeout(() => setVisibleChecklistCount(2), 1000)
      const t3 = setTimeout(() => setVisibleChecklistCount(3), 1500)
      activeTimers.push(t1, t2, t3)

      // Auto-dispatch Google Meet invite
      const t4 = setTimeout(() => {
        setScheduledState((prev) => ({ ...prev, [targetCandidate.id]: true }))
        setScanState('complete')
      }, 2200)
      activeTimers.push(t4)
    }, 7000)
    activeTimers.push(dispatchTimer)

    return () => {
      activeTimers.forEach(clearTimeout)
    }
  }

  // Trigger scanning sequence on mount or index/key change
  useEffect(() => {
    const cleanup = startScanSequence(CANDIDATES[selectedIndex])
    return cleanup
  }, [selectedIndex, scanKey])

  // Handle manual tab switcher click
  const handleSelectCandidate = (index: number) => {
    setSelectedIndex(index)
    setScanKey((k) => k + 1)
  }

  // Handle manual re-scan button click
  const handleReScan = () => {
    setScanKey((k) => k + 1)
  }

  const handleSchedule = () => {
    if (scanState === 'p3_dispatching' || scanState === 'complete') {
      setScheduledState((prev) => ({
        ...prev,
        [candidate.id]: true,
      }))
    }
  }

  // Color tokens
  const blue = '#4C6FFF'
  const cyan = '#22CFFF'
  const success = '#10B981'
  const border = 'rgba(11, 18, 32, 0.08)'
  const dim = '#64748B'

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
      {/* Styled Inline Keyframes for Scanner laser lines */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scanline-anim-sim {
          0% { top: 0%; }
          100% { top: 100%; }
        }
        @keyframes pulse-anim-sim {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}} />

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
              color: scanState !== 'complete' ? '#0284C7' : 'var(--success)',
              background: scanState !== 'complete' ? 'rgba(34, 207, 255, 0.12)' : 'rgba(16, 185, 129, 0.1)',
              border: scanState !== 'complete' ? '1px solid rgba(34, 207, 255, 0.3)' : '1px solid rgba(16, 185, 129, 0.25)',
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
                background: scanState !== 'complete' ? cyan : success,
                animation: scanState !== 'complete' ? 'pulse-anim-sim 0.6s infinite' : 'none',
              }}
            />
            {scanState === 'p1_parsing'
              ? 'AI PARSING RESUME...'
              : scanState === 'p2_scoring'
              ? 'EVALUATING MATCH SCORE...'
              : scanState === 'p3_dispatching'
              ? 'AUTOPILOT SCHEDULING...'
              : 'AI ENGINE VERIFIED'}
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

      {/* Role Switcher Tabs */}
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

        <div style={{ fontSize: '10.5px', color: 'var(--dim)', fontFamily: 'var(--f-mono)' }}>
          ⚡ 0.6s AI Vector Search
        </div>
      </div>

      {/* Simulator 3-Column Compact Grid */}
      <div
        style={{
          padding: '16px 18px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '14px',
          alignItems: 'stretch',
        }}
      >
        {/* ── STAGE 01: Resume Intelligence ── */}
        <div
          style={{
            background: '#FFFFFF',
            border: scanState === 'p1_parsing' ? '1px solid var(--cyan)' : '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: scanState === 'p1_parsing' ? '0 0 16px rgba(34, 207, 255, 0.15)' : 'none',
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Laser Scanning Line */}
          {scanState === 'p1_parsing' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: `linear-gradient(90deg, transparent, ${cyan}, ${blue}, transparent)`,
                boxShadow: `0 0 12px ${cyan}`,
                animation: 'scanline-anim-sim 1s ease-in-out infinite alternate',
                zIndex: 10,
              }}
            />
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--f-mono)', color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                01 · RESUME INTELLIGENCE
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--f-mono)',
                  color: scanState === 'p1_parsing' ? '#0284C7' : 'var(--success)',
                  fontWeight: 600,
                }}
              >
                {scanState === 'p1_parsing' ? 'PARSING PDF...' : 'PARSED & INDEXED (0.6S)'}
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

            {/* Extracted Skills List */}
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

        {/* ── STAGE 02: AI Match Scoring ── */}
        <div
          style={{
            background: 'linear-gradient(160deg, #FFFFFF, rgba(248, 250, 253, 0.9))',
            border: scanState === 'p2_scoring' ? '1px solid var(--blue)' : '1px solid rgba(76, 111, 255, 0.22)',
            borderRadius: 'var(--r-md)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: scanState === 'p2_scoring' ? '0 0 16px rgba(76, 111, 255, 0.15)' : '0 6px 16px -8px rgba(76, 111, 255, 0.12)',
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Laser Scanning Line */}
          {scanState === 'p2_scoring' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: `linear-gradient(90deg, transparent, ${cyan}, ${blue}, transparent)`,
                boxShadow: `0 0 12px ${blue}`,
                animation: 'scanline-anim-sim 1s ease-in-out infinite alternate',
                zIndex: 10,
              }}
            />
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--f-mono)', color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                02 · AI MATCH SCORE
              </span>
              {scanState === 'p1_parsing' ? (
                <span style={{ fontSize: '9px', fontFamily: 'var(--f-mono)', color: dim, fontWeight: 600 }}>
                  AWAITING PARSE
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'var(--f-mono)',
                    color: scanState === 'p2_scoring' ? 'var(--blue)' : candidate.verdictType === 'strong' ? '#059669' : 'var(--blue)',
                    background: scanState === 'p2_scoring' ? 'rgba(76, 111, 255, 0.1)' : candidate.verdictType === 'strong' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(76, 111, 255, 0.1)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontWeight: 700,
                  }}
                >
                  {scanState === 'p2_scoring' ? 'EVALUATING MATCH...' : `PASSES THRESHOLD (${candidate.threshold}%)`}
                </span>
              )}
            </div>

            {/* Score Ring Gauge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: scanState === 'p1_parsing' ? '#E2E8F0' : 'var(--grad)',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: scanState === 'p1_parsing' ? 'none' : '0 6px 16px rgba(76, 111, 255, 0.25)',
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
                    color: scanState === 'p1_parsing' ? '#94A3B8' : '#0F172A',
                    fontFamily: 'var(--f-display)',
                  }}
                >
                  {scanState === 'p1_parsing' ? '0%' : `${animatedScore}%`}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.96rem', fontWeight: 800, color: scanState === 'p1_parsing' ? '#94A3B8' : '#0F172A' }}>
                  {scanState === 'p1_parsing' ? 'Waiting...' : candidate.verdict}
                </div>
                <div style={{ fontSize: '0.7rem', color: scanState === 'p1_parsing' ? '#94A3B8' : 'var(--muted)', lineHeight: 1.3 }}>
                  {scanState === 'p1_parsing' ? 'Awaiting resume extraction' : `Threshold: ${candidate.threshold}% · Precision match verified`}
                </div>
              </div>
            </div>

            {/* Criteria Bars */}
            <div style={{ display: 'grid', gap: '6px', marginBottom: '10px' }}>
              {candidate.criteriaScores.map((cr, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, color: scanState === 'p1_parsing' ? '#94A3B8' : '#334155' }}>{cr.label}</span>
                    <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: scanState === 'p1_parsing' ? '#94A3B8' : 'var(--blue)' }}>
                      {scanState === 'p1_parsing' ? '0%' : `${cr.score}%`}
                    </span>
                  </div>
                  <div style={{ height: '3px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: scanState === 'p1_parsing' ? '0%' : `${cr.score}%`,
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
              background: scanState === 'p1_parsing' ? 'rgba(241, 245, 249, 0.4)' : 'rgba(76, 111, 255, 0.05)',
              borderLeft: `2px solid ${scanState === 'p1_parsing' ? '#CBD5E1' : 'var(--blue)'}`,
              borderRadius: '0 4px 4px 0',
              fontSize: '0.7rem',
              color: scanState === 'p1_parsing' ? '#94A3B8' : '#334155',
              lineHeight: 1.4,
            }}
          >
            <strong>AI Note:</strong> {scanState === 'p1_parsing' ? 'Analysis queued' : candidate.aiSummary}
          </div>
        </div>

        {/* ── STAGE 03: Autopilot Scheduling ── */}
        <div
          style={{
            background: '#FFFFFF',
            border: scanState === 'p3_dispatching' ? '1px solid #F59E0B' : isScheduled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: scanState === 'p3_dispatching' ? '0 0 16px rgba(245, 158, 11, 0.15)' : 'none',
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          {/* Laser Scanning Line */}
          {scanState === 'p3_dispatching' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, transparent, #F59E0B, #EF4444, transparent)',
                boxShadow: '0 0 12px #F59E0B',
                animation: 'scanline-anim-sim 1s ease-in-out infinite alternate',
                zIndex: 10,
              }}
            />
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--f-mono)', color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                03 · AUTOPILOT ACTIONS
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--f-mono)',
                  color: isScheduled ? 'var(--success)' : scanState === 'p3_dispatching' ? '#F59E0B' : 'var(--dim)',
                  fontWeight: 700,
                }}
              >
                {isScheduled ? 'INVITE DISPATCHED' : scanState === 'p3_dispatching' ? 'DISPATCHING...' : 'AWAITING SCORE'}
              </span>
            </div>

            {/* Checklist */}
            <div style={{ display: 'grid', gap: '6px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#1E293B', opacity: visibleChecklistCount >= 1 ? 1 : 0.4 }}>
                <span style={{ 
                  width: '14px', 
                  height: '14px', 
                  borderRadius: '50%', 
                  background: visibleChecklistCount >= 1 ? 'rgba(16, 185, 129, 0.15)' : '#F1F5F9', 
                  color: visibleChecklistCount >= 1 ? 'var(--success)' : 'var(--dim)', 
                  display: 'grid', 
                  placeItems: 'center', 
                  fontSize: '9px', 
                  fontWeight: 800 
                }}>
                  {visibleChecklistCount >= 1 ? '✓' : '○'}
                </span>
                <span>Auto-updated to <strong>Shortlisted</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#1E293B', opacity: visibleChecklistCount >= 2 ? 1 : 0.4 }}>
                <span style={{ 
                  width: '14px', 
                  height: '14px', 
                  borderRadius: '50%', 
                  background: visibleChecklistCount >= 2 ? 'rgba(16, 185, 129, 0.15)' : '#F1F5F9', 
                  color: visibleChecklistCount >= 2 ? 'var(--success)' : 'var(--dim)', 
                  display: 'grid', 
                  placeItems: 'center', 
                  fontSize: '9px', 
                  fontWeight: 800 
                }}>
                  {visibleChecklistCount >= 2 ? '✓' : '○'}
                </span>
                <span>Hiring Team notified via Slack</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#1E293B', opacity: visibleChecklistCount >= 3 ? 1 : 0.4 }}>
                <span style={{ 
                  width: '14px', 
                  height: '14px', 
                  borderRadius: '50%', 
                  background: visibleChecklistCount >= 3 ? 'rgba(16, 185, 129, 0.15)' : '#F1F5F9', 
                  color: visibleChecklistCount >= 3 ? 'var(--success)' : 'var(--dim)', 
                  display: 'grid', 
                  placeItems: 'center', 
                  fontSize: '9px', 
                  fontWeight: 800 
                }}>
                  {visibleChecklistCount >= 3 ? '✓' : '○'}
                </span>
                <span>Profile indexed in talent database</span>
              </div>
            </div>

            {/* Slot Box */}
            <div
              style={{
                background: scanState === 'p1_parsing' || scanState === 'p2_scoring' ? 'rgba(241, 245, 249, 0.4)' : 'rgba(241, 245, 249, 0.8)',
                border: scanState === 'p1_parsing' || scanState === 'p2_scoring' ? '1px solid rgba(203, 213, 225, 0.4)' : '1px solid rgba(203, 213, 225, 0.8)',
                borderRadius: '6px',
                padding: '8px 10px',
                marginBottom: '10px',
              }}
            >
              <div style={{ fontSize: '0.66rem', fontFamily: 'var(--f-mono)', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 600 }}>
                Optimal Conflict-Free Slot:
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: scanState === 'p1_parsing' || scanState === 'p2_scoring' ? '#94A3B8' : '#0F172A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>📅</span> {scanState === 'p1_parsing' || scanState === 'p2_scoring' ? 'Calculating...' : candidate.suggestedSlot}
              </div>
            </div>
          </div>

          {/* Autopilot Status / Action */}
          <div>
            {!isScheduled ? (
              <button
                type="button"
                onClick={handleSchedule}
                disabled={scanState !== 'p3_dispatching'}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: scanState !== 'p3_dispatching' ? '#E2E8F0' : 'var(--grad)',
                  color: scanState !== 'p3_dispatching' ? '#94A3B8' : '#05060B',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: scanState !== 'p3_dispatching' ? 'default' : 'pointer',
                  boxShadow: scanState !== 'p3_dispatching' ? 'none' : '0 6px 16px rgba(76, 111, 255, 0.22)',
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
                  animation: 'fadeIn 0.2s ease',
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
          <span>🎯 <strong>Precision:</strong> {scanState === 'p1_parsing' ? '...' : `${candidate.matchScore}% Match`}</span>
          <span>📅 <strong>Scheduling:</strong> 1-Click Zero Emails</span>
        </div>
        <span style={{ color: 'var(--blue)', fontWeight: 600 }}>Interactive Autopilot Live Simulator</span>
      </div>
    </div>
  )
}
