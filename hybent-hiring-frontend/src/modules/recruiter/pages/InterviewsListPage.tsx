import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AddToCalendarDropdown } from '@/components/calendar/AddToCalendarDropdown'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { interviewsApi } from '@/api/interviews'
import { GlassIcon } from '@/components/common/GlassIcon'
import { candidatesApi } from '@/api/candidates'
import { scorecardsApi } from '@/api/scorecards'
import { adminApi } from '@/api/admin'
import type { Interview, InterviewStatus, InterviewType, Candidate, Scorecard } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Avatar } from '@/components/ui/Avatar'
import { formatDateTime, formatDate } from '@/utils/formatters'
import { 
  Phone, 
  Video, 
  Laptop, 
  Building2, 
  User, 
  Trophy, 
  Star, 
  ChevronDown, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  Clock, 
  Link as LinkIcon,
  Check,
  List as ListIcon,
  Calendar as CalendarIcon,
  ClipboardList
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const STATUS_CONFIG: Record<InterviewStatus, { label: string; color: string; bg: string; border: string; variant: 'purple' | 'success' | 'warning' | 'danger' }> = {
  scheduled: { label: 'Scheduled', color: 'var(--brand1, #3b82f6)', bg: 'var(--brand1-10, rgba(59,130,246,0.10))', border: 'var(--brand1-25, rgba(59,130,246,0.25))', variant: 'purple' },
  completed: { label: 'Completed', color: 'var(--teal, #10b981)', bg: 'var(--teal-10, rgba(16,185,129,0.10))', border: 'var(--teal-25, rgba(16,185,129,0.25))', variant: 'success' },
  no_show: { label: 'No Show', color: 'var(--amber, #f59e0b)', bg: 'var(--amber-10, rgba(245,158,11,0.10))', border: 'var(--amber-25, rgba(245,158,11,0.25))', variant: 'warning' },
  cancelled: { label: 'Cancelled', color: 'var(--danger, #ef4444)', bg: 'var(--danger-10, rgba(239,68,68,0.10))', border: 'var(--danger-25, rgba(239,68,68,0.25))', variant: 'danger' },
} as const

const TYPE_ICONS: Record<string, React.ReactNode> = {
  phone: <Phone size={14} />,
  video: <Video size={14} />,
  technical: <Laptop size={14} />,
  onsite: <Building2 size={14} />,
  hr: <User size={14} />,
  final: <Trophy size={14} />,
}

const REC_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  strong_yes: { label: 'Strong Hire', color: 'var(--teal, #059669)', bg: 'rgba(16,185,129,0.12)' },
  yes: { label: 'Hire', color: 'var(--teal, #059669)', bg: 'rgba(16,185,129,0.10)' },
  maybe: { label: 'Maybe', color: 'var(--amber, #d97706)', bg: 'rgba(251,191,36,0.12)' },
  no: { label: 'Rejected', color: 'var(--danger, #ef4444)', bg: 'rgba(239,68,68,0.10)' },
  strong_no: { label: 'Strong No', color: 'var(--danger, #ef4444)', bg: 'rgba(239,68,68,0.12)' },
}

const INTERVIEW_TYPES = [
  { value: 'video', label: 'Video Call' },
  { value: 'technical', label: 'Technical' },
  { value: 'onsite', label: 'On-site' },
  { value: 'hr', label: 'HR Interview' },
  { value: 'final', label: 'Final Round' },
]

const SCHEDULE_TITLES = [
  { value: 'Technical Round', type: 'technical' },
  { value: 'Practical Round', type: 'technical' },
  { value: 'HR Round', type: 'hr' },
  { value: 'Management Round', type: 'hr' },
  { value: 'Techno-Functional Round', type: 'technical' },
  { value: 'Final Round', type: 'final' },
]

// ─── Utils ──────────────────────────────────────────────────────────────────

/** Parses an API ISO date string and ensures it's treated as UTC */
const parseISO = (iso: string) => {
  if (!iso) return new Date()
  // Clean up if the server sometimes sends space instead of T
  const cleaned = iso.includes('T') ? iso : iso.replace(' ', 'T')
  // Ensure the 'Z' suffix so browser knows it's UTC (preventing 4:30 AM local shift)
  const withZ = (cleaned.endsWith('Z') || cleaned.includes('+')) ? cleaned : cleaned + 'Z'
  return new Date(withZ)
}

// ─── Schedule Schema ───────────────────────────────────────────────────────────

const scheduleSchema = z.object({
  candidate_id: z.string().min(1, 'Candidate is required'),
  panelist_ids: z.array(z.string()).min(1, 'At least one interviewer is required'),
  title: z.string().min(2, 'Title required'),
  interview_type: z.string().min(1, 'Type required'),
  scheduled_at: z.string().min(1, 'Schedule date required'),
  duration_minutes: z.coerce.number().int().min(15).default(60),
  notes: z.string().optional(),
})
type ScheduleForm = z.infer<typeof scheduleSchema>

// ─── Sub-components ───────────────────────────────────────────────────────────

import toast from 'react-hot-toast'
import { Pagination } from '@/components/ui/Pagination'

function MiniStars({ value }: { value: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star 
          key={s} 
          size={12} 
          fill={s <= value ? 'var(--amber, #fbbf24)' : 'transparent'} 
          stroke={s <= value ? 'var(--amber, #fbbf24)' : 'var(--violet-20, rgba(108,71,255,0.18))'} 
        />
      ))}
      <span style={{ fontSize: 11, color: 'var(--text-mid)', marginLeft: 4 }}>{value}/5</span>
    </span>
  )
}

function ScorecardAccordion({ applicationId }: { applicationId: string }) {
  const { data: scorecards, isLoading } = useQuery({
    queryKey: ['scorecards', 'application', applicationId],
    queryFn: () => scorecardsApi.getForApplication(applicationId).then((r: any) => r.data),
  })

  if (isLoading) return (
    <div style={{ padding: '14px 20px', borderTop: '1px solid var(--table-border)' }}>
      <p style={{ fontSize: 12, color: 'var(--text-light)' }}>Loading scorecards…</p>
    </div>
  )

  if (!scorecards?.length) return (
    <div style={{ padding: '14px 20px', borderTop: '1px solid var(--table-border)' }}>
      <p style={{ fontSize: 12, color: 'var(--text-light)', textAlign: 'center' }}>No scorecards submitted yet.</p>
    </div>
  )

  return (
    <div style={{ borderTop: '1px solid var(--table-border)', padding: '14px 20px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
        Scorecards ({scorecards.length})
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {scorecards.map((sc: Scorecard) => {
          const rec = REC_BADGE[sc.recommendation]
          const criteria = ((sc as any).criteria || (sc.criteria_scores as any)?.criteria || sc.criteria_scores) ?? []
          return (
            <div key={sc.id} style={{ background: 'var(--kpi-bg)', border: '1px solid var(--table-border)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={sc.submitted_by_name ?? 'R'} size="sm" />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{sc.submitted_by_name ?? 'Reviewer'}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-light)' }}>{formatDate(sc.submitted_at)}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MiniStars value={sc.overall_rating} />
                  {rec && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: rec.bg, color: rec.color }}>{rec.label}</span>}
                </div>
              </div>
              {criteria.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', marginBottom: 8 }}>
                  {criteria.map((c: any) => (
                    <div key={c.criterion}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-mid)' }}>{c.criterion}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-light)' }}>{c.score}/5</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--violet)/10', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${(c.score / 5) * 100}%`, background: 'linear-gradient(90deg, var(--violet), var(--pink))', borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {sc.summary && <p style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.6, fontStyle: 'italic' }}>"{sc.summary}"</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CustomNumberSelector({ 
  value, 
  options, 
  onChange, 
  width = '100%' 
}: { 
  value: string | number; 
  options: (string | number)[]; 
  onChange: (val: string) => void;
  width?: string;
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width }}>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 12, border: '1px solid var(--sidebar-border)',
          background: 'var(--card-bg)', color: 'var(--text)', fontSize: 14, fontWeight: 700,
          textAlign: 'center', cursor: 'pointer', outline: 'none', transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: isOpen ? '0 0 0 2px var(--violet)/20' : 'none'
        }}
      >
        <span>{String(value).padStart(2, '0')}</span>
        <ChevronDown 
          size={10} 
          style={{ opacity: 0.4, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            style={{
              position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', x: '-50%',
              width: 70, background: 'var(--sidebar-bg)', border: '1px solid var(--sidebar-border)',
              borderRadius: 14, boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              zIndex: 1000, maxHeight: 220, overflowY: 'auto', padding: 5,
              backdropFilter: 'blur(20px)'
            }}
          >
            {options.map((opt) => {
              const active = String(opt) === String(value)
              return (
                <div
                  key={opt}
                  onClick={() => {
                    onChange(String(opt))
                    setIsOpen(false)
                  }}
                  style={{
                    padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                    fontSize: 14, fontWeight: 800, color: active ? '#fff' : 'var(--text)',
                    background: active ? 'linear-gradient(135deg, var(--violet), var(--pink))' : 'transparent',
                    textAlign: 'center', transition: 'all 0.15s', marginBottom: 2
                  }}
                  onMouseOver={(e) => !active && (e.currentTarget.style.background = 'rgba(108,71,255,0.08)')}
                  onMouseOut={(e) => !active && (e.currentTarget.style.background = 'transparent')}
                >
                  {String(opt).padStart(2, '0')}
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TimeSlotPicker({ 
  selected, 
  onSelect, 
  interviews, 
  selectedDate 
}: { 
  selected: string; 
  onSelect: (time: string) => void;
  interviews: Interview[];
  selectedDate: Date | null;
}) {
  const slots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
  ]

  const formatAMPM = (time: string) => {
    const [hh, mm] = time.split(':')
    const h = parseInt(hh)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${mm} ${ampm}`
  }

  const getSlotStatus = useCallback((time: string) => {
    if (!selectedDate) return 'available'
    const [h, m] = time.split(':').map(Number)
    
    // Create a date object for this specific slot at the selected date (Local)
    const slotTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), h, m, 0, 0)
    
    // 1. First check if the slot overlaps with existing interviews
    const isTaken = (interviews || []).some(iv => {
      if (iv.status === 'cancelled') return false
      const ivStart = parseISO(iv.scheduled_at)
      const duration = iv.duration_minutes || 60
      const ivEnd = new Date(ivStart.getTime() + duration * 60 * 1000)
      return slotTime >= ivStart && slotTime < ivEnd
    })
    
    if (isTaken) return 'scheduled'

    // 2. Then check if it's a past slot (with 1-minute grace period)
    const now = new Date()
    // If it's today, we check the time. If it's a future date, it's never "past".
    if (slotTime.getTime() < now.getTime() - 60000) return 'past'

    return 'available'
  }, [selectedDate, interviews])

  // Auto-select first available slot only if current selection is invalid or missing
  useEffect(() => {
    if (selectedDate) {
      const currentStatus = selected ? getSlotStatus(selected) : 'none'
      if (currentStatus !== 'available' && slots && slots.length > 0) {
        const firstAvailable = slots.find((s: string) => getSlotStatus(s) === 'available')
        if (firstAvailable) {
          onSelect(firstAvailable)
        }
      }
    }
  }, [selectedDate, interviews, getSlotStatus, onSelect])

  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Available Slots</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {slots.map((s: string) => {
          const active = selected === s
          const status = getSlotStatus(s)
          const blocked = status !== 'available'
          return (
            <button
              key={s}
              disabled={blocked}
              onClick={() => onSelect(s)}
              style={{
                padding: '10px 0', borderRadius: 10, 
                border: `1px solid ${active ? 'var(--violet)' : blocked ? 'rgba(245,158,11,0.2)' : 'var(--card-border)'}`,
                background: active ? 'var(--violet)/10' : blocked? 'rgba(245,158,11,0.08)' : 'var(--card-bg)',
                color: active ? 'var(--violet)' : blocked ? 'var(--amber, #f59e0b)' : 'var(--text-mid)',
                fontSize: 11, fontWeight: active ? 700 : 600, 
                cursor: blocked ? 'not-allowed' : 'pointer', 
                transition: 'all 0.15s',
                opacity: blocked ? 0.8 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
              }}
            >
              <span style={{ fontSize: 13 }}>{formatAMPM(s)}</span>
              {status === 'scheduled' && <span style={{ fontSize: 8, textTransform: 'uppercase' }}>Scheduled</span>}
              {status === 'past' && <span style={{ fontSize: 8, textTransform: 'uppercase' }}>Past</span>}
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px dashed var(--table-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Or Enter Custom Time</p>
          <span style={{ fontSize: 13, background: 'var(--violet)/10', padding: '4px 8px', borderRadius: 8, color: 'var(--violet)', fontWeight: 700 }}>{formatAMPM(selected || '09:00')}</span>
        </div>
        
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Hours */}
          <CustomNumberSelector
            value={parseInt((selected || '09:00').split(':')[0]) % 12 || 12}
            options={Array.from({ length: 12 }, (_, i) => i + 1)}
            onChange={(val) => {
              const [_, oldM] = (selected || '09:00').split(':')
              const isPM = parseInt((selected || '09:00').split(':')[0]) >= 12
              let nextH = parseInt(val)
              if (isPM && nextH < 12) nextH += 12
              if (!isPM && nextH === 12) nextH = 0
              onSelect(`${String(nextH).padStart(2, '0')}:${oldM}`)
            }}
          />

          <span style={{ fontWeight: 900, opacity: 0.2, fontSize: 18 }}>:</span>

          {/* Minutes */}
          <CustomNumberSelector
            value={(selected || '09:00').split(':')[1]}
            options={['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']}
            onChange={(val) => {
              const [oldH, _] = (selected || '09:00').split(':')
              onSelect(`${oldH}:${val}`)
            }}
          />

          <div style={{ width: 1, height: 24, background: 'var(--sidebar-border)', margin: '0 4px', opacity: 0.5 }} />

          {/* AM/PM Toggle */}
          <div style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: 12, border: '1px solid var(--table-border)', padding: 3, gap: 2 }}>
             {['AM', 'PM'].map(p => {
               const currentH = parseInt((selected || '09:00').split(':')[0])
               const active = (p === 'AM' && currentH < 12) || (p === 'PM' && currentH >= 12)
               return (
                 <button
                   key={p}
                   type="button"
                   onClick={() => {
                     const [oldH, oldM] = (selected || '09:00').split(':').map(Number)
                     let nextH = oldH
                     if (p === 'AM' && oldH >= 12) nextH -= 12
                     if (p === 'PM' && oldH < 12) nextH += 12
                     onSelect(`${String(nextH).padStart(2, '0')}:${String(oldM).padStart(2, '0')}`)
                   }}
                   style={{
                     padding: '8px 12px', border: 'none', borderRadius: 9,
                     background: active ? 'var(--violet)' : 'transparent',
                     color: active ? '#fff' : 'var(--text-mid)',
                     fontSize: 10, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                   }}
                 >
                   {p}
                 </button>
               )
             })}
          </div>
        </div>

        {selected && getSlotStatus(selected) !== 'available' && !slots.includes(selected) && (
          <motion.p 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <AlertTriangle size={12} /> This time slot is {getSlotStatus(selected)}
          </motion.p>
        )}
      </div>
    </div>
  )
}



// ─── Calendar ─────────────────────────────────────────────────────────────────

function Calendar({
  interviews, selectedDate, onSelectDate,
}: {
  interviews: Interview[]
  selectedDate: Date | null
  onSelectDate: (d: Date | null) => void
}) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const today = new Date()

  const dateMap = useMemo(() => {
    const map: Record<string, InterviewStatus[]> = {}
    for (const iv of interviews) {
      if (iv.status === 'cancelled') continue
      const d = parseISO(iv.scheduled_at)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(iv.status)
    }
    return map
  }, [interviews])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function statusColor(statuses: InterviewStatus[]) {
    if (statuses.includes('scheduled')) return 'var(--brand1, #3b82f6)'
    if (statuses.includes('completed')) return 'var(--teal, #10b981)'
    if (statuses.includes('no_show')) return 'var(--amber, #f59e0b)'
    return 'var(--danger, #ef4444)'
  }

  return (
    <div>
      {/* Month Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--table-border)', background: 'var(--input-bg)', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
        >
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{MONTHS[month]} {year}</span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--table-border)', background: 'var(--input-bg)', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
        {WEEK_DAYS.map((d, i) => (
          <span key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-light)', opacity: 0.6, textTransform: 'uppercase', padding: '4px 0' }}>{d}</span>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dayDate = new Date(year, month, day)
          const key = `${year}-${month}-${day}`
          const statuses = dateMap[key]
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          const isSelected = selectedDate?.getFullYear() === year && selectedDate?.getMonth() === month && selectedDate?.getDate() === day
          const dotColor = statuses ? statusColor(statuses) : null
          
          // Disable clicking on past dates (anything before today midnight)
          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
          const isPast = dayDate < todayMidnight

          return (
            <button
              key={day}
              onClick={() => onSelectDate(dayDate)}
              style={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: 12,
                border: isSelected ? '2px solid var(--violet)' : isToday ? '1px solid var(--violet)/30' : '1px solid transparent',
                cursor: isPast ? 'not-allowed' : 'pointer',
                background: isSelected ? 'var(--violet)/15' : isToday ? 'var(--violet)/5' : 'transparent',
                color: isSelected ? 'var(--violet)' : isToday ? 'var(--violet)' : isPast ? 'var(--text-mid)' : 'var(--text)',
                opacity: isPast ? 0.4 : 1,
                fontSize: 13, fontWeight: isToday || isSelected ? 800 : 500,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
            >
              <span>{day}</span>
              {dotColor && <span style={{ width: 4, height: 4, borderRadius: '50%', background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--card-border)', flexWrap: 'wrap' }}>
        {([['var(--brand1, #3b82f6)', 'Scheduled'], ['var(--teal, #10b981)', 'Done'], ['var(--amber, #f59e0b)', 'No Show'], ['var(--danger, #ef4444)', 'Cancelled']] as const).map(([color, label]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-light)', fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />{label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Schedule Form ─────────────────────────────────────────────────────────────

function MultiSelectPanelists({
  value,
  onChange,
  options,
  error
}: {
  value: string[];
  onChange: (val: string[]) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if a modal overlay is open.
      const modalOpen = document.querySelector('[data-modal-root="true"]')
      if (modalOpen) return
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter(v => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  const selectedLabels = options.filter(o => value.includes(o.value)).map(o => o.label);

  return (
    <div ref={containerRef} className="w-full relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-[#b0a8d8] mb-1.5">
        Interviewers *
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`input-base cursor-pointer min-h-[42px] flex items-center flex-wrap gap-1.5 ${error ? 'border-red-400' : ''}`}
        style={{ position: 'relative', paddingRight: 36, userSelect: 'none' }}
      >
        {selectedLabels.length === 0 ? (
          <span style={{ color: 'var(--text-mid)', fontSize: 13 }}>Select interviewers...</span>
        ) : (
          selectedLabels.map(l => (
            <span key={l} style={{
              background: 'var(--violet)/10',
              color: 'var(--violet)',
              padding: '2px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              border: '1px solid var(--violet)/20',
              display: 'inline-flex',
              alignItems: 'center',
            }}>
              {l}
            </span>
          ))
        )}
        {/* Chevron — absolutely positioned inside this div */}
        <div style={{
          position: 'absolute', right: 12, top: '50%',
          color: 'var(--text-light)', transition: 'transform 0.2s', pointerEvents: 'none',
          transform: isOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
          display: 'flex', alignItems: 'center'
        }}>
          <ChevronDown size={14} />
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            className="absolute z-[1000] w-full mt-1 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-[#2a2550] rounded-xl shadow-2xl max-h-60 overflow-y-auto"
          >
            {options.map(opt => (
              <div 
                key={opt.value} 
                onClick={() => toggleOption(opt.value)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(108,71,255,0.05)] cursor-pointer transition-colors"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${value.includes(opt.value) ? 'bg-[var(--violet)] border-[var(--violet)]' : 'border-[var(--card-border)]'}`}>
                  {value.includes(opt.value) && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-[13px] font-semibold text-[var(--text)]">{opt.label}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function ScheduleForm({
  onSuccess, preselectedCandidateId, selectedDate, selectedTime, duration,
}: {
  onSuccess: (msg: string) => void
  preselectedCandidateId?: string | null
  selectedDate: Date | null
  selectedTime: string
  duration: number
}) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { duration_minutes: 60, scheduled_at: '', interview_type: 'video', panelist_ids: [] },
  })

  // 1. Initial population for new interviews
  useEffect(() => {
    const initialIso = (selectedDate && selectedTime) ? (() => {
      const [hh, mm] = selectedTime.split(':')
      const d = new Date(selectedDate)
      d.setHours(parseInt(hh), parseInt(mm), 0, 0)
      return d.toISOString()
    })() : ''
    
    reset({
      candidate_id: preselectedCandidateId || '',
      duration_minutes: 60,
      scheduled_at: initialIso,
      interview_type: 'video',
      panelist_ids: [],
      title: 'Technical Interview',
      notes: '',
    })
  }, [reset, preselectedCandidateId, selectedDate, selectedTime])

  // 2. Sync date/time from calendar - store full ISO with timezone
  useEffect(() => {
    if (selectedDate && selectedTime) {
      const [hh, mm] = selectedTime.split(':')
      const targetDate = new Date(selectedDate)
      targetDate.setHours(parseInt(hh), parseInt(mm), 0, 0)
      setValue('scheduled_at', targetDate.toISOString())
    }
  }, [selectedDate, selectedTime, setValue])

  const { data: usersResponse } = useQuery({
    queryKey: ['users'],
    queryFn: () => adminApi.listUsers().then((r: any) => r.data),
  })
  const interviewers = (usersResponse || []).filter((u: any) => u.role === 'interviewer')

  const { data: candidatesList = [] } = useQuery({
    queryKey: ['candidates-for-schedule'],
    queryFn: () => candidatesApi.list({ limit: 100 }).then((r: any) => r.data.items),
  })

  const mutation = useMutation({
    mutationFn: (formData: ScheduleForm) => { // Renamed 'data' to 'formData' to avoid conflict with watch()
      const data = watch() // Get current form data from watch()
      const scheduledIso = formData.scheduled_at
      const selectedStage = SCHEDULE_TITLES.find((t: any) => t.value === data.title)
      if (!selectedStage) return Promise.reject(new Error("Invalid interview title selected")) // Return a rejected promise if selectedStage is null
      
      const payload_panelists = formData.panelist_ids.map((id, index) => ({
        user_id: id,
        role: index === 0 ? 'lead' : 'panelist'
      }))

      const payload = {
        candidate_id: formData.candidate_id, 
        title: formData.title,
        application_id: '', 
        interview_type: (selectedStage?.type || 'video') as InterviewType,
        scheduled_at: scheduledIso, duration_minutes: formData.duration_minutes,
        notes: formData.notes,
        panelist_ids: payload_panelists,
      }
      return interviewsApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['candidates-for-schedule'] })
      onSuccess('Interview scheduled!')
      reset({ duration_minutes: 60, scheduled_at: '', interview_type: 'video', panelist_ids: [] })
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Controller
        name="title"
        control={control}
        render={({ field }) => (
          <Select
            label="Interview Stage / Title *"
            error={errors.title?.message}
            options={[
              { value: '', label: 'Select stage...' },
              ...SCHEDULE_TITLES.map((t) => ({
                value: t.value,
                label: t.value,
              })),
            ]}
            {...field}
          />
        )}
      />

      <Controller
        name="candidate_id"
        control={control}
        render={({ field }) => (
          <Select
            label="Candidate *"
            error={errors.candidate_id?.message}
            options={[
              { value: '', label: 'Select candidate...' },
              ...candidatesList.map((c: any) => ({
                value: c.id,
                label: c.full_name,
              })),
            ]}
            {...field}
          />
        )}
      />

      <Controller
        name="panelist_ids"
        control={control}
        render={({ field }) => (
          <MultiSelectPanelists
            value={field.value || []}
            onChange={field.onChange}
            options={interviewers.map((u: any) => ({ value: u.id, label: u.full_name }))}
            error={errors.panelist_ids?.message}
          />
        )}
      />

      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <button
          type="submit"
          disabled={isSubmitting || mutation.isPending}
          style={{
            flex: 1, 
            padding: '14px 24px', 
            borderRadius: 14, 
            border: 'none',
            background: isSubmitting || mutation.isPending 
              ? 'var(--color-text-muted)' 
              : 'linear-gradient(135deg, var(--violet) 0%, var(--pink, #ff6bc6) 100%)',
            color: '#fff', 
            fontSize: 14, 
            fontWeight: 800, 
            cursor: isSubmitting || mutation.isPending ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 30px var(--color-bg-sidebar)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 10, 
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseEnter={(e) => {
            if (!(isSubmitting || mutation.isPending)) {
               e.currentTarget.style.transform = 'translateY(-2px)'
               e.currentTarget.style.boxShadow = '0 12px 40px var(--color-bg-sidebar)'
            }
          }}
          onMouseLeave={(e) => {
            if (!(isSubmitting || mutation.isPending)) {
               e.currentTarget.style.transform = 'translateY(0)'
               e.currentTarget.style.boxShadow = '0 8px 30px var(--color-bg-sidebar)'
            }
          }}
        >
          <Zap size={18} fill="currentColor" />
          <span>
            {isSubmitting || mutation.isPending
              ? 'Scheduling...'
              : 'Schedule Interview'}
          </span>
        </button>
      </div>
    </form>
  )
}

// ─── Interview Card ────────────────────────────────────────────────────────────

function InterviewCard({
  interview, expandedScorecard,
  onCancel, onStatusUpdate, onToggleScorecard,
}: {
  interview: Interview
  expandedScorecard: boolean
  onCancel: () => void
  onStatusUpdate: (status: InterviewStatus) => void
  onToggleScorecard: () => void
}) {
  const cfg = STATUS_CONFIG[interview.status] ?? STATUS_CONFIG.scheduled
  const d = parseISO(interview.scheduled_at)
  const typeIcon = TYPE_ICONS[interview.interview_type] ?? <ClipboardList size={14} />
  const queryClient = useQueryClient()

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      layout
      className="glass-card"
      style={{
        padding: '18px 20px',
        borderRadius: 20,
        border: '1px solid var(--sidebar-border)',
        background: 'var(--sidebar-bg)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        position: 'relative',
        overflow: 'visible',
        flexShrink: 0
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: cfg.color, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 }} />
      
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        {/* Time Column */}
        <div className="shrink-0 w-auto sm:w-[70px] flex sm:block items-baseline gap-2 text-left sm:text-center">
          <p className="text-[18px] font-black text-[var(--violet)] mb-0 sm:mb-[2px]">
            {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).split(' ')[0]}
          </p>
          <p className="text-[10px] font-extrabold text-[var(--text-mid)] opacity-60 uppercase tracking-[0.5px]">
            {d.getHours() >= 12 ? 'PM' : 'AM'}
          </p>
        </div>

        {/* Info Column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Avatar name={interview.candidate_name || 'C'} size="sm" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {interview.candidate_name || 'Unnamed Candidate'}
                </h4>
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>{interview.title}</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>
              {typeIcon} {interview.interview_type.replace(/_/g, ' ')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-light)', opacity: 0.4 }}>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>
              <Clock size={12} /> {interview.duration_minutes}m
            </span>
            {interview.meeting_link && (
              <>
                 <span style={{ fontSize: 11, color: 'var(--text-light)', opacity: 0.4 }}>•</span>
                 <a 
                   href={interview.meeting_link} 
                   target="_blank" 
                   rel="noreferrer"
                   style={{ fontSize: 11, fontWeight: 800, color: 'var(--violet)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                 >
                   <LinkIcon size={12} /> Meet Link
                 </a>
              </>
            )}
          </div>

          {/* Panelists */}
          {interview.panelists && interview.panelists.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>Interviewers:</span>
              {interview.panelists.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(108,71,255,0.05)', padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(108,71,255,0.1)' }}>
                  <Avatar name={p.user_name || 'P'} size="xs" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6c47ff' }}>{p.user_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions Column */}
        <div className="flex sm:flex-col gap-2 justify-end sm:justify-center mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-[var(--sidebar-border)] sm:border-none items-center">
          {interview.status === 'scheduled' && (
            <>
              <AddToCalendarDropdown interview={interview} />
              <button 
                onClick={() => onStatusUpdate('completed')}
                style={{ padding: '6px 14px', borderRadius: 10, background: 'var(--teal-10)', color: 'var(--teal, #10b981)', border: '1px solid var(--teal-25)', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Complete
              </button>
              <button 
                onClick={onCancel}
                style={{ padding: '6px 14px', borderRadius: 10, background: 'var(--danger-10)', color: 'var(--danger, #ef4444)', border: '1px solid var(--danger-25)', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Cancel
              </button>
            </>
          )}
           {interview.status === 'completed' && (
              <>
                {interview.application_id && (
                  <button 
                    onClick={onToggleScorecard}
                    style={{ 
                      padding: '6px 14px', 
                      borderRadius: 10, 
                      background: expandedScorecard ? 'var(--violet-25)' : 'var(--kpi-bg)', 
                      color: expandedScorecard ? 'var(--violet)' : 'var(--text-mid)', 
                      border: `1px solid ${expandedScorecard ? 'var(--violet)' : 'var(--card-border)'}`, 
                      fontSize: 11, 
                      fontWeight: 800, 
                      cursor: 'pointer', 
                      transition: 'all 0.2s' 
                    }}
                  >
                    {expandedScorecard ? 'Close' : 'Scores'}
                  </button>
                )}
              </>
           )}
        </div>
      </div>

      <AnimatePresence>
        {expandedScorecard && interview.application_id && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: 16 }}>
              <ScorecardAccordion applicationId={interview.application_id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InterviewsListPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const preselectedCandidateId = searchParams.get('candidateId')
  
  const [selectedDate, setSelectedDate]           = useState<Date | null>(new Date())
  const [selectedTime, setSelectedTime]           = useState<string>('')

  const [cancelTarget, setCancelTarget]           = useState<Interview | null>(null)
  const [cancelReason, setCancelReason]           = useState<string>('')
  const [expandedScorecard, setExpandedScorecard] = useState<string | null>(null)
  const [statusFilter, setStatusFilter]           = useState<InterviewStatus | 'all'>('all')
  const [activeTab, setActiveTab]                 = useState<'schedule' | 'interviews'>('schedule')
  const [currentPage, setCurrentPage]             = useState(1)
  const ITEMS_PER_PAGE = 5

  const { data: interviews, isLoading, isError } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => interviewsApi.list().then((r: any) => r.data),
  })


  const filteredInterviews = useMemo(() => {
    if (!interviews) return []
    return interviews.filter((iv: Interview) => {
      if (statusFilter !== 'all' && iv.status !== statusFilter) return false
      if (selectedDate) {
        const d = parseISO(iv.scheduled_at)
        if (d.getFullYear() !== selectedDate.getFullYear() ||
            d.getMonth() !== selectedDate.getMonth() ||
            d.getDate() !== selectedDate.getDate()) return false
      }
      return true
    })
  }, [interviews, statusFilter, selectedDate])

  const { paginatedInterviews, totalPages } = useMemo(() => {
    const total = filteredInterviews.length
    const pages = Math.ceil(total / ITEMS_PER_PAGE)
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return {
      paginatedInterviews: filteredInterviews.slice(start, start + ITEMS_PER_PAGE),
      totalPages: pages
    }
  }, [filteredInterviews, currentPage])

  // Reset to page 1 when filter or date changes
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, selectedDate])

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string, reason?: string }) => interviewsApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      toast.success('Interview cancelled')
      setCancelTarget(null)
      setCancelReason('')
    },
    onError: () => toast.error('Failed to cancel interview'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: InterviewStatus }) => 
      interviewsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      toast.success('Interview status updated')
    },
    onError: () => toast.error('Failed to update interview status'),
  })

  return (
    <div className="flex flex-col gap-6 h-auto lg:h-[calc(100vh-120px)] lg:overflow-hidden min-h-[calc(100vh-120px)]">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <header className="page-header !mb-0">
          <h1 className="page-title">
            Schedule
          </h1>
          <p className="page-subtitle">
            Auto-conflict-free scheduling with instant Meet links.
          </p>
        </header>
        <div style={{ display: 'flex', gap: 10 }}>
           {user && !user.is_calendar_connected && (
            <button
              onClick={async () => {
                try { const res = await authApi.connectCalendar(); window.location.href = res.data.auth_url }
                catch { toast.error('Could not connect calendar') }
              }}
              className="glass-card"
              style={{ 
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, 
                fontSize: 13, fontWeight: 700, cursor: 'pointer', 
                background: 'var(--violet)/10', color: 'var(--violet)', 
                border: '1px solid var(--violet)/20',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.background = 'var(--violet)/15'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.background = 'var(--violet)/10'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <CalendarIcon size={18} /> Connect Google Calendar
            </button>
          )}
          {user?.is_calendar_connected && (
             <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: 'rgba(0,212,200,0.1)', color: '#00b5aa', border: '1px solid rgba(0,212,200,0.2)', fontSize: 13, fontWeight: 700 }}>
                <span className="dot-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d4c8' }} />
                AI Sync Active
             </div>
          )}
        </div>
      </div>

      {/* Mobile Tab Switcher — only shown below lg breakpoint */}
      <div className="flex lg:hidden items-center gap-2 p-1 rounded-xl border border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] shrink-0">
        {(['schedule', 'interviews'] as const).map((tab: 'schedule' | 'interviews') => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] text-[13px] font-bold transition-all duration-200"
            style={{
              background: activeTab === tab ? 'var(--violet)/10' : 'transparent',
              color: activeTab === tab ? 'var(--violet)' : 'var(--text-mid)',
              border: activeTab === tab ? '1px solid var(--violet)/20' : '1px solid transparent',
            }}
          >
            <span>{tab === 'schedule' ? <CalendarIcon size={14} /> : <ListIcon size={14} />}</span>
            {tab === 'schedule' ? 'Schedule' : 'Interviews'}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-[360px_1fr] gap-6 lg:gap-8 flex-1 min-h-0">
        
        {/* Left Column: Calendar & Form — always visible on desktop, only when tab='schedule' on mobile */}
        <div className={`flex-col gap-5 overflow-visible lg:overflow-y-auto lg:pr-1 ${activeTab === 'schedule' ? 'flex' : 'hidden'} lg:flex`}>
          
          {/* Calendar Card */}
          <div className="glass-card" style={{ padding: 24, borderRadius: 24, border: '1px solid var(--sidebar-border)', background: 'var(--sidebar-bg)' }}>
            <Calendar
              interviews={interviews ?? []}
              selectedDate={selectedDate}
              onSelectDate={(d) => d && setSelectedDate(d)}
            />
          </div>

          {/* Quick Schedule Form Card */}
          <div className="glass-card" style={{ padding: 24, borderRadius: 24, border: '1px solid var(--sidebar-border)', background: 'var(--sidebar-bg)' }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>Quick Schedule</h3>
              <p style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 500 }}>Book a slot for {selectedDate?.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</p>
            </div>
            
            <TimeSlotPicker 
              selected={selectedTime} 
              onSelect={setSelectedTime} 
              interviews={interviews || []} 
              selectedDate={selectedDate}
            />
            
            <div style={{ marginTop: 24 }}>
              <ScheduleForm
                preselectedCandidateId={preselectedCandidateId}
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                duration={60}
                onSuccess={(msg) => {
                  queryClient.invalidateQueries({ queryKey: ['interviews'] })
                  queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
                  toast.success(msg)
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming Interviews — always visible on desktop, only when tab='interviews' on mobile */}
        <div className={`flex-col gap-5 min-h-0 ${activeTab === 'interviews' ? 'flex' : 'hidden'} lg:flex`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
             <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>Upcoming Interviews</h3>
             <div style={{ display: 'flex', gap: 8 }}>
                {(['all', 'scheduled', 'completed'] as const).map((f: InterviewStatus | 'all') => (
                  <button 
                    key={f} 
                    onClick={() => setStatusFilter(f)}
                    style={{ 
                      padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer',
                      background: statusFilter === f ? 'var(--violet)/15' : 'transparent',
                      color: statusFilter === f ? 'var(--violet)' : 'var(--text-mid)',
                      border: `1px solid ${statusFilter === f ? 'var(--violet)/30' : 'var(--card-border)'}`,
                      transition: 'all 0.2s'
                    }}
                  >
                    {f}
                  </button>
                ))}
             </div>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-3.5 lg:pr-2.5 pb-10">
            {isLoading ? (
               Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 120, borderRadius: 20, background: 'var(--sidebar-bg)', border: '1px solid var(--sidebar-border)', opacity: 0.5 }} className="animate-pulse" />
              ))
            ) : filteredInterviews.length === 0 ? (
               <EmptyState 
                  title="No interviews found"
                  description="Use the calendar to pick a different date or schedule a new one."
               />
            ) : (
                <>
                  {paginatedInterviews.map((iv: Interview) => (
                    <InterviewCard
                        key={iv.id}
                        interview={iv}
                        expandedScorecard={expandedScorecard === iv.id}
                        onCancel={() => setCancelTarget(iv)}
                        onStatusUpdate={(status) => statusMutation.mutate({ id: iv.id, status })}
                        onToggleScorecard={() => setExpandedScorecard(expandedScorecard === iv.id ? null : iv.id)}
                    />
                  ))}
                  
                  <div style={{ marginTop: 'auto', paddingTop: 20 }}>
                    <Pagination
                      page={currentPage}
                      pages={totalPages}
                      total={filteredInterviews.length}
                      limit={ITEMS_PER_PAGE}
                      onPage={setCurrentPage}
                    />
                  </div>
                </>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!cancelTarget}
        onClose={() => { setCancelTarget(null); setCancelReason(''); }}
        onConfirm={() => {
          if (cancelTarget) cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason })
        }}
        title="Cancel Interview"
        message={`Are you sure you want to cancel the interview for ${cancelTarget?.candidate_name}? This will notify the candidate and interviewers.`}
        confirmText="Cancel Interview"
        danger
        loading={cancelMutation.isPending}
      >
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', display: 'block', marginBottom: 8 }}>Reason for Cancellation (Optional)</label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g., Candidate withdrew, re-scheduling needed, etc."
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--table-border)',
              background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13, minHeight: 80, resize: 'none'
            }}
          />
        </div>
      </ConfirmModal>

    </div>
  )
}
