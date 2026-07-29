import { portalApi } from '@/api/portal'
import { useNavigate } from 'react-router-dom'
import { AddToCalendarDropdown } from '@/components/calendar/AddToCalendarDropdown'
import { useQuery } from '@tanstack/react-query'
import type { Interview } from '@/types'
import { CheckCircle, User, Clock, Video, MapPin, Target, Calendar, Check, FileText } from 'lucide-react'
import { GlassIcon } from '@/components/common/GlassIcon'

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.setHours(0,0,0,0) === now.setHours(0,0,0,0)
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  let hours = d.getHours()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  const mins = d.getMinutes().toString().padStart(2, '0')
  return { hr: `${hours}:${mins}`, ampm, dt: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
}

function InterviewCard({ interview }: { interview: Interview }) {
  const navigate = useNavigate()
  const today = interview.status === 'scheduled' && isToday(interview.scheduled_at)
  const t = formatTime(interview.scheduled_at)
  
  let cardClass = 'int-card ic-up'
  if (today) cardClass = 'int-card ic-live'
  if (interview.status !== 'scheduled') cardClass = 'int-card ic-done'

  const isPassed = interview.status === 'completed' || (interview.status as string) === 'passed'
  const isFailed = interview.status === 'cancelled' || (interview.status as string) === 'failed'

  const panelists = interview.panelists?.map(p => p.user_name || p.user_email).join(', ') || 'TBD'
  
  return (
    <div className={cardClass} style={interview.status !== 'scheduled' ? { opacity: 0.75 } : {}}>
      <div className="int-time">
        <div className="int-hr" style={interview.status !== 'scheduled' ? { color: 'var(--text-lite)' } : {}}>{t.hr.split(':')[0]}</div>
        <div className="int-ampm">{t.hr.split(':')[1]} {t.ampm}</div>
        <div className="int-dt">{today ? 'Today' : t.dt}</div>
      </div>
      
      <div className="int-info">
        <div className="int-title">{interview.title}</div>
        <div className="int-round" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {interview.interview_type.replace(/_/g, ' ')} · {interview.duration_minutes} min 
          {interview.status !== 'scheduled' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green)' }}>
              · Completed <GlassIcon icon="CheckCircle" variant="emerald" size={18} iconSize={10} ghost glow={false} />
            </span>
          )}
        </div>
        
        <div className="int-meta">
          <div className="int-meta-item">
            <User size={12} style={{ color: 'var(--violet)' }} /> <span>Panel: {panelists}</span>
          </div>
          <div className="int-meta-item">
            <Clock size={12} style={{ color: 'var(--violet)' }} /> <span>{interview.duration_minutes} minutes</span>
          </div>
        </div>

        {interview.meeting_link && interview.status === 'scheduled' ? (
          <div className="int-link">
            <Video size={14} style={{ color: 'var(--brand)' }} /> 
            <a href={interview.meeting_link} target="_blank" rel="noreferrer">Join Meeting</a>
          </div>
        ) : interview.location && interview.status === 'scheduled' ? (
          <div className="int-link">
            <MapPin size={14} style={{ color: 'var(--brand)' }} /> {interview.location}
          </div>
        ) : null}

        {interview.notes && (
          <div style={{ fontSize: 11, color: 'var(--text-lite)', marginTop: 4, fontStyle: 'italic' }}>
            {interview.notes}
          </div>
        )}
      </div>

      <div className="int-actions">
        {interview.status === 'scheduled' ? (
          <>
            <AddToCalendarDropdown interview={interview} />
            {interview.meeting_link && (
              <a href={interview.meeting_link} target="_blank" rel="noreferrer" className="btn btn-teal btn-sm" style={{ textDecoration: 'none' }}>
                Join Meet
              </a>
            )}
            <button className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => navigate('/hiring/portal/prep')}>
              <GlassIcon icon="Target" variant="violet" size={24} iconSize={12} ghost glow={false} /> Prep Kit
            </button>
          </>
        ) : (
          <>
            {isPassed && (
              <span className="chip chip-green" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                Passed <Check size={11} />
              </span>
            )}
            {isFailed && <span className="chip chip-gray" style={{ fontSize: 11 }}>{interview.status}</span>}
          </>
        )}
      </div>
    </div>
  )
}

export default function PortalInterviewsPage() {
  const { data: interviews, isLoading, isError } = useQuery({
    queryKey: ['portal', 'interviews'],
    queryFn: () => portalApi.myInterviews().then((r: any) => r.data),
  })

  const todayInterviews = interviews?.filter((i: any) => i.status === 'scheduled' && isToday(i.scheduled_at)) ?? []
  const upcoming = interviews
    ?.filter((i: any) => i.status === 'scheduled' && !isToday(i.scheduled_at))
    .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()) ?? []
  const past = interviews
    ?.filter((i: any) => i.status !== 'scheduled')
    .sort((a: any, b: any) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()) ?? []

  return (
    <div className="page active">
      <div className="ph">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="pt" style={{ display: 'flex', alignItems: 'center', gap: 10 }}> My Interview Schedule <GlassIcon icon="Calendar" variant="violet" size={28} iconSize={14} /></div>
            <div className="ps">All your upcoming and past interviews in one place.</div>
          </div>
          {todayInterviews.length > 0 && <span className="chip chip-teal"><span className="chd"></span>{todayInterviews.length} Interview{todayInterviews.length > 1 ? 's' : ''} Today</span>}
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center" style={{ color: 'var(--text-lite)' }}>Loading interviews...</div>
      ) : isError ? (
        <div className="py-8 text-center" style={{ color: 'var(--red)' }}>Failed to load interviews.</div>
      ) : !interviews?.length ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-lite)' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <GlassIcon icon="Calendar" variant="violet" size={60} iconSize={28} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No interviews scheduled</div>
          <div style={{ fontSize: 13 }}>When an interviewer schedules you, it will appear here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {todayInterviews.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', letterSpacing: '1.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Space Grotesk', sans-serif" }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', display: 'inline-block', animation: 'blink 2s infinite' }}></span>
                Today
              </div>
              {todayInterviews.map((iv: any) => <InterviewCard key={iv.id} interview={iv} />)}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", marginTop: 4 }}>
                Upcoming
              </div>
              {upcoming.map((iv: any) => <InterviewCard key={iv.id} interview={iv} />)}
            </>
          )}

          {past.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-lite)', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", marginTop: 4 }}>
                Completed
              </div>
              {past.map((iv: any) => <InterviewCard key={iv.id} interview={iv} />)}
            </>
          )}
          
        </div>
      )}
    </div>
  )
}
