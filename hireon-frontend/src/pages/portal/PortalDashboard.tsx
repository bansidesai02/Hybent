import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { portalApi } from '@/api/portal'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime, formatDate, formatSalary } from '@/utils/formatters'

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired'] as const
type PipelineStage = (typeof STAGES)[number]

function stageIndex(stage: string): number {
  return STAGES.indexOf(stage as PipelineStage)
}

function StageChip({ stage }: { stage: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    applied:   { bg: 'rgba(124,58,237,0.10)', color: '#7c3aed', label: 'Applied' },
    screening: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Screening' },
    interview: { bg: 'rgba(6,182,212,0.12)',  color: '#06b6d4', label: 'Interview' },
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
  )
}

export default function PortalDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['portal', 'applications'],
    queryFn: () => portalApi.myApplications().then((r) => r.data),
  })

  const { data: interviews, isLoading: intLoading } = useQuery({
    queryKey: ['portal', 'interviews'],
    queryFn: () => portalApi.myInterviews().then((r) => r.data),
  })

  const { data: offers, isLoading: offersLoading } = useQuery({
    queryKey: ['portal', 'offers'],
    queryFn: () => portalApi.myOffers().then((r) => r.data),
  })

  const activeApps = applications?.filter((a) => !['hired', 'rejected'].includes(a.stage)) ?? []
  const nextInterview = interviews
    ?.filter((i) => i.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]
  const pendingOffer = offers?.find((o) => o.status === 'sent')

  const kpis = [
    {
      icon: '📄',
      value: appsLoading ? '—' : activeApps.length,
      label: 'Active Applications',
      iconBg: 'linear-gradient(135deg,rgba(124,58,237,.14),rgba(168,85,247,.06))',
      badgeBg: 'rgba(124,58,237,0.12)',
      badgeColor: '#7c3aed',
      badgeText: 'Active',
      href: '/portal/applications',
    },
    {
      icon: '🎤',
      value: intLoading ? '—' : (interviews?.filter((i) => i.status === 'scheduled').length ?? 0),
      label: 'Upcoming Interviews',
      iconBg: 'linear-gradient(135deg,rgba(6,182,212,.14),rgba(34,211,238,.06))',
      badgeBg: 'rgba(6,182,212,0.12)',
      badgeColor: '#06b6d4',
      badgeText: 'Scheduled',
      href: '/portal/interviews',
    },
    {
      icon: '🎁',
      value: offersLoading ? '—' : (offers?.length ?? 0),
      label: 'Offers Received',
      iconBg: 'linear-gradient(135deg,rgba(16,185,129,.14),rgba(52,211,153,.06))',
      badgeBg: 'rgba(16,185,129,0.12)',
      badgeColor: '#10b981',
      badgeText: '+Active',
      href: '/portal/offers',
    },
  ]

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: 'var(--p-text)' }}>
      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 30,
            fontWeight: 700,
            color: 'var(--p-text)',
            lineHeight: 1.2,
            marginBottom: 4,
          }}
        >
          Welcome back{user ? `, ${user.full_name.split(' ')[0]}` : ''}!
        </h1>
        <p style={{ fontSize: 14, color: 'var(--p-text-mid)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Track your applications, interviews and offers all in one place.
        </p>
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            onClick={() => navigate(kpi.href)}
            style={{
              background: 'var(--p-kpi)',
              border: '1px solid var(--p-table-border)',
              borderRadius: 16,
              padding: 20,
              cursor: 'pointer',
              transition: 'all .3s',
              boxShadow: 'var(--p-shadow)',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--p-shadow-h)'
              ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--p-shadow)'
              ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 19,
                  background: kpi.iconBg,
                }}
              >
                {kpi.icon}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 20,
                  background: kpi.badgeBg,
                  color: kpi.badgeColor,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {kpi.badgeText}
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 36,
                lineHeight: 1,
                color: 'var(--p-text)',
                marginBottom: 4,
              }}
            >
              {kpi.value}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--p-text-lite)',
                fontWeight: 500,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Application Stage Tracker (show first active app) */}
      {!appsLoading && activeApps.length > 0 && (
        <div
          style={{
            background: 'var(--p-kpi)',
            border: '1px solid var(--p-table-border)',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 24,
            boxShadow: 'var(--p-shadow)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--p-text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {activeApps[0].job?.title ?? 'Current Application'} — Stage Progress
            </span>
            <StageChip stage={activeApps[0].stage} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--p-text-lite)', marginBottom: 4 }}>
            Applied {formatDate(activeApps[0].applied_at)}
          </p>
          <StageTracker stage={activeApps[0].stage} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {STAGES.map((s) => (
              <span
                key={s}
                style={{
                  fontSize: 10,
                  color: s === activeApps[0].stage ? '#7c3aed' : 'var(--p-text-lite)',
                  fontWeight: s === activeApps[0].stage ? 700 : 500,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  textTransform: 'capitalize',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Upcoming Interview card */}
        {!intLoading && nextInterview && (
          <div
            style={{
              background: 'var(--p-kpi)',
              border: '1px solid var(--p-table-border)',
              borderRadius: 14,
              padding: 20,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 18,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'var(--p-shadow)',
            }}
          >
            {/* teal left border */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                borderRadius: '4px 0 0 4px',
                background: 'linear-gradient(180deg,#06b6d4,#22d3ee)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 4 }}>
                Upcoming Interview
              </p>
              <h3
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 20,
                  color: 'var(--p-text)',
                  lineHeight: 1.2,
                  marginBottom: 6,
                }}
              >
                {nextInterview.title}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--p-text-mid)', marginBottom: 4 }}>
                {formatDateTime(nextInterview.scheduled_at)} · {nextInterview.duration_minutes} min
              </p>
              <p style={{ fontSize: 12, color: 'var(--p-text-lite)', textTransform: 'capitalize' }}>
                {nextInterview.interview_type.replace(/_/g, ' ')} interview
              </p>
              {nextInterview.meeting_link && (
                <a
                  href={nextInterview.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 12,
                    padding: '8px 16px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg,#06b6d4,#22d3ee)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    boxShadow: '0 4px 14px rgba(6,182,212,0.35)',
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Join Meeting
                </a>
              )}
            </div>
          </div>
        )}

        {/* Pending Offer banner */}
        {!offersLoading && pendingOffer && (
          <div
            style={{
              background: 'linear-gradient(135deg,#1a0050,#2d0080,#7c3aed,#a855f7)',
              borderRadius: 16,
              padding: '24px 28px',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(124,58,237,0.35)',
            }}
          >
            {/* decorative circles */}
            <div
              style={{
                position: 'absolute',
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                top: -60,
                right: -40,
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.04)',
                bottom: -30,
                left: 20,
              }}
            />
            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Pending Offer
              </p>
              <h3
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 22,
                  lineHeight: 1.2,
                  marginBottom: 6,
                }}
              >
                {pendingOffer.position_title}
              </h3>
              <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>
                {formatSalary(pendingOffer.base_salary, null, pendingOffer.salary_currency)}
                {pendingOffer.expiry_date && ` · Expires ${formatDate(pendingOffer.expiry_date)}`}
              </p>
              <button
                onClick={() => navigate('/portal/offers')}
                style={{
                  marginTop: 14,
                  padding: '9px 20px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.20)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  backdropFilter: 'blur(8px)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.30)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.20)' }}
              >
                Review Offer →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Applications */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 20,
              color: 'var(--p-text)',
            }}
          >
            Recent Applications
          </h2>
          <button
            onClick={() => navigate('/portal/applications')}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#7c3aed',
              background: 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(124,58,237,0.18)',
              borderRadius: 8,
              padding: '5px 12px',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            View All
          </button>
        </div>

        {appsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 64,
                  borderRadius: 12,
                  background: 'rgba(124,58,237,0.05)',
                  animation: 'pulse 2s infinite',
                }}
              />
            ))}
          </div>
        ) : !applications?.length ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 0',
              color: 'var(--p-text-lite)',
              fontSize: 14,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            No applications yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {applications.slice(0, 5).map((app) => (
              <div
                key={app.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  background: 'var(--p-kpi)',
                  border: '1px solid var(--p-table-border)',
                  borderRadius: 12,
                  boxShadow: 'var(--p-shadow)',
                  transition: 'box-shadow 0.2s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: 'var(--p-text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: 2,
                    }}
                  >
                    {app.job?.title ?? 'Position'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--p-text-lite)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Applied {formatDate(app.applied_at)}
                  </p>
                </div>
                <StageChip stage={app.stage} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
