import { useQuery } from '@tanstack/react-query'
import { portalApi } from '@/api/portal'
import { formatDateTime, timeAgo } from '@/utils/formatters'
import type { Interview, InterviewStatus } from '@/types'

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function borderColor(interview: Interview): string {
  if (interview.status !== 'scheduled') return 'rgba(176,164,204,0.40)'
  if (isToday(interview.scheduled_at)) return 'linear-gradient(180deg,#06b6d4,#22d3ee)'
  return 'linear-gradient(180deg,#7c3aed,#a855f7)'
}

function StatusChip({ status }: { status: InterviewStatus }) {
  const cfg: Record<InterviewStatus, { bg: string; color: string; label: string }> = {
    scheduled:  { bg: 'rgba(6,182,212,0.12)',  color: '#06b6d4', label: 'Scheduled' },
    completed:  { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Completed' },
    cancelled:  { bg: 'rgba(239,68,68,0.10)',  color: '#ef4444', label: 'Cancelled' },
    no_show:    { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'No Show' },
  }
  const c = cfg[status]
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

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: 20,
        background: 'rgba(124,58,237,0.10)',
        color: '#7c3aed',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        textTransform: 'capitalize',
      }}
    >
      {type.replace(/_/g, ' ')}
    </span>
  )
}

function InterviewCard({ interview, dimmed = false }: { interview: Interview; dimmed?: boolean }) {
  const today = interview.status === 'scheduled' && isToday(interview.scheduled_at)
  const borderGrad = borderColor(interview)

  return (
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
        opacity: dimmed ? 0.72 : 1,
        boxShadow: 'var(--p-shadow)',
        transition: 'all 0.25s',
      }}
      onMouseEnter={(e) => {
        if (!dimmed) {
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--p-shadow-h)'
          ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--p-shadow)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
      }}
    >
      {/* Left accent border */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          borderRadius: '4px 0 0 4px',
          background: borderGrad,
        }}
      />

      <div style={{ flex: 1, minWidth: 0, paddingLeft: 6 }}>
        {/* Row 1: title + chips */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 20,
                color: 'var(--p-text)',
                lineHeight: 1.2,
                marginBottom: 4,
              }}
            >
              {interview.title}
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <TypeBadge type={interview.interview_type} />
              {today && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 20,
                    background: 'rgba(6,182,212,0.14)',
                    color: '#06b6d4',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  Today
                </span>
              )}
            </div>
          </div>
          <StatusChip status={interview.status} />
        </div>

        {/* Time */}
        <p
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 16,
            color: 'var(--p-text-mid)',
            marginBottom: 2,
          }}
        >
          {formatDateTime(interview.scheduled_at)}
        </p>
        <p style={{ fontSize: 12, color: 'var(--p-text-lite)', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 8 }}>
          {interview.duration_minutes} min · {timeAgo(interview.scheduled_at)}
        </p>

        {/* Notes */}
        {interview.notes && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--p-text-mid)',
              background: 'rgba(124,58,237,0.05)',
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 10,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {interview.notes}
          </p>
        )}

        {/* Panelists */}
        {interview.panelists.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--p-text-lite)',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                marginBottom: 6,
              }}
            >
              Interviewers
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {interview.panelists.map((p) => (
                <span
                  key={p.id}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: 'rgba(124,58,237,0.08)',
                    color: 'var(--p-text-mid)',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {p.user_name ?? p.user_email ?? 'Unknown'}
                  {p.role ? ` · ${p.role}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Meeting link */}
        {interview.meeting_link && interview.status === 'scheduled' && (
          <a
            href={interview.meeting_link}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 10,
              background: today
                ? 'linear-gradient(135deg,#06b6d4,#22d3ee)'
                : 'linear-gradient(135deg,#7c3aed,#a855f7)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              boxShadow: today
                ? '0 4px 14px rgba(6,182,212,0.35)'
                : '0 4px 14px rgba(124,58,237,0.35)',
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Join Meeting
          </a>
        )}

        {/* Location fallback */}
        {!interview.meeting_link && interview.location && interview.status === 'scheduled' && (
          <p style={{ fontSize: 12, color: 'var(--p-text-mid)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <strong>Location:</strong> {interview.location}
          </p>
        )}
      </div>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "'Fraunces', serif",
        fontSize: 20,
        color: 'var(--p-text)',
        marginBottom: 14,
      }}
    >
      {children}
    </h2>
  )
}

export default function PortalInterviewsPage() {
  const { data: interviews, isLoading, isError } = useQuery({
    queryKey: ['portal', 'interviews'],
    queryFn: () => portalApi.myInterviews().then((r) => r.data),
  })

  const todayInterviews =
    interviews?.filter((i) => i.status === 'scheduled' && isToday(i.scheduled_at)) ?? []

  const upcoming =
    interviews
      ?.filter((i) => i.status === 'scheduled' && !isToday(i.scheduled_at))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()) ?? []

  const past = interviews?.filter((i) => i.status !== 'scheduled') ?? []

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: 'var(--p-text)' }}>
      {/* Header */}
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
          My Interviews
        </h1>
        <p style={{ fontSize: 14, color: 'var(--p-text-mid)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Your scheduled and past interviews
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 130, borderRadius: 14, background: 'rgba(124,58,237,0.05)' }} />
          ))}
        </div>
      ) : isError ? (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 12,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.20)',
            color: '#ef4444',
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Failed to load interviews.
        </div>
      ) : !interviews?.length ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--p-text-lite)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <p
            style={{
              fontSize: 16,
              fontWeight: 600,
              fontFamily: "'Fraunces', serif",
              color: 'var(--p-text-mid)',
              marginBottom: 6,
            }}
          >
            No interviews scheduled
          </p>
          <p style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            When an interviewer schedules you, it will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Today */}
          {todayInterviews.length > 0 && (
            <div>
              <SectionHeading>Today</SectionHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {todayInterviews.map((iv) => (
                  <InterviewCard key={iv.id} interview={iv} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <SectionHeading>Upcoming</SectionHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {upcoming.map((iv) => (
                  <InterviewCard key={iv.id} interview={iv} />
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div>
              <SectionHeading>Past</SectionHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {past.map((iv) => (
                  <InterviewCard key={iv.id} interview={iv} dimmed />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
