import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { adminApi } from '@/api/admin'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { formatDateTime } from '@/utils/formatters'
import { GlassIcon } from '@/components/common/GlassIcon'

// ─── Action styling ───────────────────────────────────────────────────────────
const ACTION_STYLE: Record<string, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
  CREATE:       { bg: 'rgba(16,185,129,0.10)',  color: '#059669', icon: <GlassIcon icon="Plus" variant="emerald" size={20} iconSize={10} glow={false} />, label: 'Created' },
  UPDATE:       { bg: 'rgba(59,130,246,0.10)',  color: '#2563eb', icon: <GlassIcon icon="Edit2" variant="blue" size={20} iconSize={10} glow={false} />, label: 'Edited' },
  UPDATE_STAGE: { bg: 'rgba(108,71,255,0.10)',  color: '#6c47ff', icon: <GlassIcon icon="RefreshCw" variant="violet" size={20} iconSize={10} glow={false} />, label: 'Stage Change' },
  SCHEDULE:     { bg: 'rgba(108,71,255,0.10)',  color: '#6c47ff', icon: <GlassIcon icon="Calendar" variant="violet" size={20} iconSize={10} glow={false} />, label: 'Scheduled' },
  RESCHEDULE:   { bg: 'rgba(245,158,11,0.12)',  color: '#d97706', icon: <GlassIcon icon="Clock" variant="amber" size={20} iconSize={10} glow={false} />, label: 'Rescheduled' },
  CANCEL:       { bg: 'rgba(239,68,68,0.10)',   color: '#dc2626', icon: <GlassIcon icon="X" variant="rose" size={20} iconSize={10} glow={false} />, label: 'Cancelled' },
  DELETE:       { bg: 'rgba(239,68,68,0.12)',   color: '#b91c1c', icon: <GlassIcon icon="Trash2" variant="rose" size={20} iconSize={10} glow={false} />, label: 'Deleted' },
  INVITE:       { bg: 'rgba(255,107,198,0.10)', color: '#db2777', icon: <GlassIcon icon="Mail" variant="pink" size={20} iconSize={10} glow={false} />, label: 'Invited' },
  ADD_COMMENT:  { bg: 'rgba(20,184,166,0.10)',  color: '#0d9488', icon: <GlassIcon icon="MessageSquare" variant="teal" size={20} iconSize={10} glow={false} />, label: 'Comment Added' },
  LOGIN:        { bg: 'rgba(16,185,129,0.10)',  color: '#059669', icon: <GlassIcon icon="LogIn" variant="emerald" size={20} iconSize={10} glow={false} />, label: 'Login' },
  LOGOUT:       { bg: 'rgba(107,114,128,0.10)', color: '#6b7280', icon: <GlassIcon icon="LogOut" variant="gray" size={20} iconSize={10} glow={false} />, label: 'Logout' },
  OFFER_SENT:   { bg: 'rgba(251,191,36,0.10)',  color: '#d97706', icon: <GlassIcon icon="Send" variant="amber" size={20} iconSize={10} glow={false} />, label: 'Offer Sent' },
  OFFER_RESPONDED: { bg: 'rgba(59,130,246,0.10)', color: '#2563eb', icon: <GlassIcon icon="Check" variant="blue" size={20} iconSize={10} glow={false} />, label: 'Offer Response' },
}

const RESOURCE_ICON: Record<string, React.ReactNode> = {
  job: <GlassIcon icon="Briefcase" variant="violet" size={18} iconSize={10} glow={false} />, 
  candidate: <GlassIcon icon="User" variant="violet" size={18} iconSize={10} glow={false} />, 
  interview: <GlassIcon icon="Calendar" variant="violet" size={18} iconSize={10} glow={false} />, 
  offer: <GlassIcon icon="FileText" variant="violet" size={18} iconSize={10} glow={false} />,
  user: <GlassIcon icon="Users" variant="violet" size={18} iconSize={10} glow={false} />, 
  organization: <GlassIcon icon="Building2" variant="violet" size={18} iconSize={10} glow={false} />, 
  application: <GlassIcon icon="ClipboardList" variant="violet" size={18} iconSize={10} glow={false} />,
  hr_note: <GlassIcon icon="Lock" variant="violet" size={18} iconSize={10} glow={false} />, 
  comment: <GlassIcon icon="MessageSquare" variant="violet" size={18} iconSize={10} glow={false} />,
}

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  admin:       { bg: 'rgba(239,68,68,0.10)',   color: '#dc2626' },
  recruiter:   { bg: 'rgba(108,71,255,0.10)', color: '#6c47ff' },
  interviewer: { bg: 'rgba(59,130,246,0.10)', color: '#2563eb' },
  candidate:   { bg: 'rgba(16,185,129,0.10)', color: '#059669' },
}

const ACTION_FILTERS = ['', 'CREATE', 'UPDATE', 'UPDATE_STAGE', 'SCHEDULE', 'RESCHEDULE', 'CANCEL', 'DELETE', 'ADD_COMMENT', 'INVITE', 'OFFER_SENT']
const RESOURCE_FILTERS = ['', 'job', 'candidate', 'interview', 'offer', 'hr_note', 'comment', 'user']

// ─── Human-readable description builder ──────────────────────────────────────
function buildDescription(log: any): string {
  const d = log.details || {}
  const rt = log.resource_type || ''
  const action = log.action || ''

  const name = d.candidate || d.name || d.title || d.position || ''
  const fields = Array.isArray(d.fields) ? d.fields.join(', ') : ''

  switch (action) {
    case 'CREATE':
      if (rt === 'candidate') return `Added candidate — ${name}`
      if (rt === 'job') return `Created job — ${name}`
      if (rt === 'offer') return `Created offer — ${name}`
      return `Created ${rt}${name ? ` — ${name}` : ''}`

    case 'UPDATE':
      if (rt === 'candidate') return `Edited candidate — ${name}${fields ? ` (${fields})` : ''}`
      if (rt === 'job') return `Updated job — ${name}${fields ? ` (${fields})` : ''}`
      if (rt === 'interview') return `Updated interview — ${d.title || ''}${name ? ` with ${name}` : ''}`
      if (rt === 'offer') return `Updated offer — ${name}${fields ? ` (${fields})` : ''}`
      return `Updated ${rt}${name ? ` — ${name}` : ''}`

    case 'UPDATE_STAGE':
      return `Moved ${d.name || 'candidate'} from ${d.from || '?'} to ${d.to || '?'}`

    case 'SCHEDULE':
      return `Scheduled interview — ${d.title || ''}${name ? ` with ${name}` : ''}`

    case 'RESCHEDULE':
      return `Rescheduled interview — ${d.title || ''}${name ? ` with ${name}` : ''}`

    case 'CANCEL':
      return `Cancelled interview — ${d.title || ''}${name ? ` with ${name}` : ''}${d.reason ? ` (${d.reason})` : ''}`

    case 'DELETE':
      if (rt === 'candidate') return `Deleted candidate — ${d.name || d.email || ''}`
      if (rt === 'job') return `Deleted job — ${d.title || ''}`
      if (rt === 'offer') return `Revoked offer — ${d.position || ''}`
      return `Deleted ${rt}${name ? ` — ${name}` : ''}`

    case 'ADD_COMMENT':
      if (rt === 'hr_note') return `Updated HR confidential note for ${d.candidate || 'candidate'}`
      if (rt === 'comment') return `Added comment for ${d.candidate || 'candidate'}`
      return `Comment added`

    case 'INVITE':
      return `Invited candidate — ${d.name || d.email || ''}`

    case 'OFFER_SENT':
      return `Offer sent — ${d.position || ''}`

    case 'OFFER_RESPONDED':
      return `Offer ${d.status || 'responded'} — ${d.position || ''}`

    case 'LOGIN': return 'Logged in'
    case 'LOGOUT': return 'Logged out'

    default:
      if (name) return `${action} on ${rt} — ${name}`
      return `${action} on ${rt}`
  }
}

// ─── User initial avatar ──────────────────────────────────────────────────────
function UserAvatar({ name, role }: { name: string; role?: string }) {
  const initials = (name || 'S').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const rs = ROLE_STYLE[role || ''] ?? { bg: 'rgba(107,114,128,0.15)', color: '#6b7280' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: '50%', fontSize: 11, fontWeight: 800,
      flexShrink: 0, background: rs.bg, color: rs.color,
    }}>
      {initials}
    </span>
  )
}

// ─── Filter pill helper ───────────────────────────────────────────────────────
function Pill({ active, onClick, children, activeColor = '#6c47ff', activeBg = 'rgba(108,71,255,0.10)' }: any) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: 20, border: '1px solid',
      fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
      background: active ? activeBg : 'var(--kpi-bg)',
      color: active ? activeColor : 'var(--text-mid)',
      borderColor: active ? activeColor + '55' : 'var(--table-border)',
    }}>
      {children}
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs', page, action, resourceType, search, dateFrom, dateTo],
    queryFn: () =>
      adminApi.auditLogs({
        page, limit: 20,
        action: action || undefined,
        resource_type: resourceType || undefined,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }).then(r => r.data),
  })

  const handleSearch = useCallback(() => {
    setSearch(searchInput)
    setPage(1)
  }, [searchInput])

  const handleClearFilters = () => {
    setAction(''); setResourceType(''); setSearch(''); setSearchInput(''); setDateFrom(''); setDateTo(''); setPage(1)
  }

  const hasActiveFilters = action || resourceType || search || dateFrom || dateTo

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(22px,3vw,30px)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 4 }}>
            Audit Logs
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
            Complete history of all actions taken in your organisation
            {data && <span style={{ marginLeft: 8, fontWeight: 700, color: 'var(--violet)' }}>· {data.total} total</span>}
          </p>
        </div>
        {hasActiveFilters && (
          <button onClick={handleClearFilters} style={{
            padding: '6px 16px', borderRadius: 20, border: '1px solid rgba(239,68,68,0.3)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#dc2626',
            background: 'rgba(239,68,68,0.07)',
          }}>
            ✕ Clear Filters
          </button>
        )}
      </div>

      {/* ── Search + Date Range ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search input */}
        <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--table-border)', background: 'var(--kpi-bg)', flex: '1 1 200px', maxWidth: 300, alignItems: 'center' }}>
          <div style={{ paddingLeft: 12, color: 'var(--violet)' }}>
            <GlassIcon icon="Search" variant="violet" size={24} iconSize={12} glow={false} />
          </div>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by user name…"
            style={{ flex: 1, padding: '8px 12px', border: 'none', background: 'transparent', fontSize: 12, color: 'var(--text)', outline: 'none' }}
          />
          <button onClick={handleSearch} style={{ padding: '8px 14px', background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Go</button>
        </div>

        {/* Date from */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>From</span>
          <input type="date" value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--table-border)', background: 'var(--kpi-bg)', color: 'var(--text)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>To</span>
          <input type="date" value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1) }}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--table-border)', background: 'var(--kpi-bg)', color: 'var(--text)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* ── Action filter pills ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ACTION_FILTERS.map(a => {
            const as = ACTION_STYLE[a]
            return (
              <Pill key={a || 'all-actions'} active={action === a}
                activeColor={as?.color ?? '#6c47ff'}
                activeBg={as?.bg ?? 'rgba(108,71,255,0.10)'}
                onClick={() => { setAction(a); setPage(1) }}
              >
                {a ? <div className="flex items-center gap-1.5">{as?.icon}{as?.label ?? a}</div> : 'All Actions'}
              </Pill>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RESOURCE_FILTERS.map(r => (
            <Pill key={r || 'all-resources'} active={resourceType === r}
              activeColor="#059669" activeBg="rgba(16,185,129,0.08)"
              onClick={() => { setResourceType(r); setPage(1) }}
            >
              {r ? <div className="flex items-center gap-1.5">{RESOURCE_ICON[r] ?? ''} {r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' ')}</div> : 'All Resources'}
            </Pill>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 20px', borderRadius: 12, background: 'var(--kpi-bg)', border: '1px solid var(--table-border)', alignItems: 'center' }}>
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ borderRadius: 12, padding: 16, fontSize: 13, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444' }}>
          Failed to load audit logs.
        </div>
      ) : !data?.items.length ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="flex justify-center mb-4">
            <GlassIcon icon="ClipboardList" variant="violet" size={60} iconSize={28} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 12 }}>No audit logs found</p>
          <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
            {hasActiveFilters ? 'Try adjusting your filters' : 'Actions will be logged here automatically'}
          </p>
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '130px 100px 1fr 210px 150px', gap: 12, padding: '0 20px', fontSize: 10, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            <span>Action</span>
            <span>Resource</span>
            <span>Description</span>
            <span>Edited By</span>
            <span>When</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.items.map((log: any, i: number) => {
              const as = ACTION_STYLE[log.action] ?? { bg: 'rgba(107,114,128,0.10)', color: '#6b7280', icon: '•', label: log.action }
              const rs = ROLE_STYLE[log.user_role] ?? { bg: 'rgba(107,114,128,0.10)', color: '#6b7280' }
              const description = buildDescription(log)

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  style={{
                    display: 'grid', gridTemplateColumns: '130px 100px 1fr 210px 150px',
                    gap: 12, alignItems: 'center', padding: '12px 20px',
                    borderRadius: 12, background: 'var(--kpi-bg)', border: '1px solid var(--table-border)',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = as.color + '44'
                    el.style.boxShadow = `0 2px 12px ${as.color}18`
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'var(--table-border)'
                    el.style.boxShadow = 'none'
                  }}
                >
                  {/* Action badge */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: as.bg, color: as.color, width: 'fit-content' }}>
                    {as.icon}
                    {as.label}
                  </span>

                  {/* Resource */}
                  <span className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mid)' }}>
                    {RESOURCE_ICON[log.resource_type] ?? null}
                    {log.resource_type
                      ? (log.resource_type.charAt(0).toUpperCase() + log.resource_type.slice(1)).replace('_', ' ')
                      : '—'}
                  </span>

                  {/* Human-readable description */}
                  <span style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={description}>
                    {description}
                  </span>

                  {/* Edited By — avatar + name + role pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    {log.user_name ? (
                      <>
                        <UserAvatar name={log.user_name} role={log.user_role} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {log.user_name}
                        </span>
                        {log.user_role && (
                          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: rs.bg, color: rs.color, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
                            {log.user_role}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-light)', fontStyle: 'italic' }}>system</span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span style={{ fontSize: 11, color: 'var(--text-light)' }}>
                    {formatDateTime(log.created_at)}
                  </span>
                </motion.div>
              )
            })}
          </div>

          <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}
    </div>
  )
}
