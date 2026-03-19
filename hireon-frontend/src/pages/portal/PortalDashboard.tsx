import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { portalApi } from '@/api/portal'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/utils/formatters'

const STAGES = ['applied', 'screening', 'interview', 'interviewed', 'offer', 'hired'] as const
type PipelineStage = (typeof STAGES)[number]

function stageIndex(stage: string): number {
  if (!stage || stage === 'applied') return 0
  if (['screening', 'pre_screening', 'pre_screening_rejected'].includes(stage)) return 1
  if (['interview', 'interviewed', 'technical_round', 'practical_round', 'techno_functional_round', 'management_round', 'hr_round'].includes(stage)) return 2
  if (stage.includes('selected') || stage === 'shorlisted') return 3 // Next milestone
  if (stage === 'offer') return 4
  if (stage === 'hired' || stage === 'hired_joined') return 5
  return STAGES.indexOf(stage as PipelineStage)
}

function getProgressPercent(currentIndex: number): number {
  if (currentIndex === 0) return 15;
  if (currentIndex === 1) return 30;
  if (currentIndex === 2) return 50;
  if (currentIndex === 3) return 70;
  if (currentIndex === 4) return 85;
  if (currentIndex >= 5) return 100;
  return 0;
}


function StageChip({ stage }: { stage: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    applied:   { bg: 'rgba(124,58,237,0.10)', color: '#7c3aed', label: 'Applied' },
    screening: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Screening' },
    pre_screening: { bg: 'rgba(59,130,246,0.10)', color: '#3b82f6', label: 'Pre-screening' },
    technical_round: { bg: 'rgba(6,182,212,0.12)', color: '#06b6d4', label: 'Technical Round' },
    practical_round: { bg: 'rgba(6,182,212,0.12)', color: '#06b6d4', label: 'Practical Round' },
    techno_functional_round: { bg: 'rgba(6,182,212,0.12)', color: '#06b6d4', label: 'Techno-Functional Round' },
    management_round: { bg: 'rgba(6,182,212,0.12)', color: '#06b6d4', label: 'Management Round' },
    hr_round: { bg: 'rgba(6,182,212,0.12)', color: '#06b6d4', label: 'HR Round' },
    interview: { bg: 'rgba(6,182,212,0.12)',  color: '#06b6d4', label: 'Interview' },
    interviewed: { bg: 'rgba(6,182,212,0.12)', color: '#06b6d4', label: 'Interviewed' },
    offer:     { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Offer' },
    hired:     { bg: 'rgba(16,185,129,0.16)', color: '#059669', label: 'Hired' },
    rejected:  { bg: 'rgba(239,68,68,0.10)',  color: '#ef4444', label: 'Rejected' },
  }
  const c = cfg[stage] ?? cfg.applied
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 11px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: c.bg,
        color: c.color,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {c.label}
    </span>
  )
}

function StageTracker({ stage }: { stage: string }) {
  const current = stageIndex(stage)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 16 }}>
      {STAGES.map((s, i) => {
        const isDone = i < current
        const isActive = i === current
        const isPending = i > current
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STAGES.length - 1 ? 1 : undefined }}>
            {/* Dot */}
            <div
              title={s.charAt(0).toUpperCase() + s.slice(1)}
              style={{
                width: isActive ? 14 : 10,
                height: isActive ? 14 : 10,
                borderRadius: '50%',
                flexShrink: 0,
                background: isDone
                  ? 'linear-gradient(135deg,#7c3aed,#a855f7)'
                  : isActive
                  ? 'linear-gradient(135deg,#06b6d4,#22d3ee)'
                  : 'rgba(176,164,204,0.35)',
                boxShadow: isActive ? '0 0 0 4px rgba(6,182,212,0.18)' : undefined,
                animation: isActive ? 'portal-stage-pulse 2s ease-in-out infinite' : undefined,
                transition: 'all 0.3s',
              }}
            />
            {/* Line */}
            {i < STAGES.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: isDone || isActive
                    ? 'linear-gradient(90deg,#7c3aed,#a855f7)'
                    : 'rgba(176,164,204,0.25)',
                  margin: '0 2px',
                  transition: 'background 0.3s',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )}

export default function PortalDashboard() {
  const navigate = useNavigate()

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['portal', 'applications'],
    queryFn: () => portalApi.myApplications().then((r) => r.data),
  })

  const { data: interviews, isLoading: intLoading } = useQuery({
    queryKey: ['portal', 'interviews'],
    queryFn: () => portalApi.myInterviews().then((r) => r.data),
  })

  if (appsLoading || intLoading) {
    return <div className="p-8 text-center text-[var(--text-lite)]">Loading application journey...</div>
  }

  const activeApp = applications?.find(a => !['hired', 'rejected'].includes(a.stage)) || applications?.[0]
  
  if (!activeApp) {
    return (
      <div className="page active" id="page-journey">
        <div className="ph">
          <div className="pt">Your Application Journey 🗺️</div>
          <div className="ps">Start applying to open roles to track your progress!</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/portal/openings')}>View Openings</button>
      </div>
    )
  }

  const currentIdx = stageIndex(activeApp.stage)
  const isRejected = activeApp.stage === 'rejected'
  const isHired = activeApp.stage === 'hired'
  const progressWidth = `${getProgressPercent(currentIdx)}%`

  // Sort interviews by date descending
  const history = [...(interviews || [])].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  // Calc days in process
  const msInSys = Date.now() - new Date(activeApp.applied_at).getTime()
  const daysInProcess = Math.max(1, Math.floor(msInSys / (1000 * 60 * 60 * 24)))

  return (
    <div className="page active" id="page-journey">
      <div className="ph">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="pt">Your Application Journey 🗺️</div>
            <div className="ps">Applying for <strong>{activeApp.job?.title || 'Role'}</strong> · Applied {formatDate(activeApp.applied_at)}</div>
          </div>
          {isRejected ? (
            <span className="chip chip-red"><span className="chd"></span>Rejected</span>
          ) : isHired ? (
            <span className="chip chip-green"><span className="chd"></span>Hired!</span>
          ) : (
            <span className="chip chip-teal"><span className="chd"></span>Stage: {activeApp.stage.charAt(0).toUpperCase() + activeApp.stage.slice(1)}</span>
          )}
        </div>
      </div>

      {/* Tracker Card */}
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <div className="ctitle">
          Stage Progress 
          <span className="ctag teal">Step {Math.min(currentIdx + 1, 5)} of 5</span>
        </div>
        
        <div className="tracker-wrap">
          <div className="tracker-line"></div>
          <div className="tracker-progress" style={{ width: progressWidth }}></div>
          <div className="tracker-steps">
            
            <div className={`tstep ${currentIdx > 0 ? 'done' : currentIdx === 0 ? 'active' : 'pending'}`}>
              <div className="tstep-dot">{currentIdx > 0 ? '✓' : currentIdx === 0 ? '●' : '○'}</div>
              <div className="tstep-label">Applied</div>
              {currentIdx >= 0 && <div className="tstep-date">{formatDate(activeApp.applied_at)}</div>}
            </div>

            <div className={`tstep ${currentIdx > 1 ? 'done' : currentIdx === 1 ? 'active' : 'pending'}`}>
              <div className="tstep-dot">{currentIdx > 1 ? '✓' : currentIdx === 1 ? '●' : '○'}</div>
              <div className="tstep-label">Shortlisted</div>
              {currentIdx < 1 && <div className="tstep-note">Pending</div>}
            </div>

            <div className={`tstep ${currentIdx > 2 ? 'done' : currentIdx === 2 ? 'active' : 'pending'}`}>
              <div className="tstep-dot">{currentIdx > 2 ? '✓' : currentIdx === 2 ? '●' : '○'}</div>
              <div className="tstep-label">Interviews</div>
              {currentIdx < 2 && <div className="tstep-note">Pending</div>}
            </div>

            <div className={`tstep ${currentIdx > 3 ? 'done' : currentIdx === 3 ? 'active' : 'pending'}`}>
              <div className="tstep-dot">{currentIdx > 3 ? '✓' : currentIdx === 3 ? '●' : '○'}</div>
              <div className="tstep-label">Offer</div>
              {currentIdx < 3 && <div className="tstep-note">Pending</div>}
            </div>

            <div className={`tstep ${currentIdx > 4 ? 'done' : currentIdx === 4 ? 'active' : 'pending'}`}>
              <div className="tstep-dot">{currentIdx === 4 ? (isHired ? '✓' : '●') : '○'}</div>
              <div className="tstep-label">{isRejected ? 'Closed' : 'Hired'}</div>
              {currentIdx < 4 && <div className="tstep-note">Pending</div>}
            </div>

          </div>
        </div>

        {/* Dynamic Stage Detail Card based on active stage */}
        <div className="stage-detail-card">
          <div className="stage-label">Current Stage</div>
          <div className="stage-title">
            {currentIdx === 0 && "Application Received"}
            {currentIdx === 1 && "Screening & Formatting"}
            {currentIdx === 2 && "Interview Rounds"}
            {currentIdx === 3 && "Offer Processing"}
            {currentIdx >= 4 && (isHired ? "Welcome to the team!" : "Application Closed")}
          </div>
          <div className="stage-sub">
            {currentIdx === 0 && "Your application has been received and is waiting to be reviewed by the team."}
            {currentIdx === 1 && "Your profile is under active consideration. An HR representative will reach out shortly."}
            {currentIdx === 2 && "You are currently in the interview phase. Complete your scheduled rounds."}
            {currentIdx === 3 && "Congratulations on making it to the offer stage! Your offer document is being prepared."}
            {currentIdx >= 4 && (isHired ? "You have officially accepted the offer." : "Thank you for your time. This application didn't proceed further.")}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {currentIdx === 2 && <button className="btn btn-teal btn-sm" onClick={() => navigate('/portal/interviews')}>📅 View Interviews</button>}
            {currentIdx === 3 && <button className="btn btn-primary btn-sm" onClick={() => navigate('/portal/offers')}>📄 View Offer</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/portal/prep')}>🎯 Open Prep Hub</button>
          </div>
        </div>
      </div>

      <div className="g2">
        {/* Round History */}
        <div className="card">
          <div className="ctitle">Round History</div>
          <div>
            {history.length === 0 ? (
              <div className="py-4 text-center text-[12px] text-[var(--text-lite)]">No interview history yet.</div>
            ) : (
              history.map((intv) => {
                const isUpcoming = intv.status === 'scheduled';
                const isPassed = intv.status === 'completed' || (intv.status as string) === 'passed';
                const isFailed = (intv.status as string) === 'failed' || intv.status === 'cancelled';
                return (
                  <div className="rh-item" key={intv.id}>
                    <div className={`rh-dot ${isUpcoming ? 'rhd-active' : isPassed ? 'rhd-done' : 'rhd-pend'}`}></div>
                    <div>
                      <div className="rh-name">{intv.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-lite)' }}>
                        {intv.interview_type.replace('_', ' ')} · {intv.duration_minutes} min · {formatDate(intv.scheduled_at)}
                      </div>
                    </div>
                    {isUpcoming && <span className="chip chip-teal">Upcoming</span>}
                    {isPassed && <span className="chip chip-green">Passed ✓</span>}
                    {isFailed && <span className="chip chip-gray">Closed</span>}
                  </div>
                )
              })
            )}
            {/* Show pending next rounds based on stage */}
            {currentIdx === 2 && (
              <div className="rh-item">
                <div className="rh-dot rhd-pend"></div>
                <div>
                  <div className="rh-name">Next Rounds</div>
                  <div style={{ fontSize: 11, color: 'var(--text-lite)' }}>Pending HR scheduling</div>
                </div>
                <span className="chip chip-gray" style={{ fontSize: 10 }}>Upcoming</span>
              </div>
            )}
          </div>
        </div>

        {/* Application Stats */}
        <div className="card">
          <div className="ctitle">Your Application Stats</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="kpi" style={{ border: 'none', padding: 0, boxShadow: 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="kpi-ico ki1">📅</div>
              <div><div className="kpi-val" style={{ fontSize: 24 }}>{daysInProcess}</div><div className="kpi-lbl">Days in Process</div></div>
            </div>
            
            <div style={{ borderTop: '1px solid var(--table-border)', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>Process Completion</div>
              <div className="pbar"><div className="pfill" style={{ width: progressWidth }}></div></div>
              <div style={{ fontSize: 11, color: 'var(--text-lite)', marginTop: 5 }}>
                {Math.min(currentIdx + 1, 5)} of 5 stages · {progressWidth}
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid var(--table-border)', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 10, fontFamily: "'Space Grotesk', sans-serif" }}>Applied Role</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{activeApp.job?.title || 'Unknown Role'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-lite)', marginTop: 3 }}>
                {activeApp.job?.department || ''} · {activeApp.job?.location || 'Remote'}
              </div>
              {activeApp.job?.skills_required && activeApp.job.skills_required.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {activeApp.job.skills_required.slice(0, 4).map((skill: string) => (
                    <span key={skill} style={{ background: 'rgba(124,58,237,.08)', color: 'var(--brand)', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
