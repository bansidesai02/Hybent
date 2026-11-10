import { Link } from 'react-router-dom'
import { CalendarCheck, ChevronRight, CircleCheck, FlaskConical, Headset, MailWarning, MessageSquare, TriangleAlert, UserPlus } from 'lucide-react'

import { Card, CardHeader } from '@/components/hb'
import { useSuperAdminTodo, type SuperAdminTodo } from '@/hooks/useSuperAdminTodo'

const SA = '/hiring/super-admin'

/** Only what needs a person, each line opening the right tab. */
const ROWS: Array<{ key: keyof SuperAdminTodo; text: (n: number) => string; to: string; icon: typeof FlaskConical; tone: string }> = [
  { key: 'trials_pending', text: (n) => `${n} free trial request${n === 1 ? '' : 's'} to approve`, to: `${SA}/leads`, icon: FlaskConical, tone: 'text-hb-warning' },
  { key: 'demos_upcoming', text: (n) => `${n} demo${n === 1 ? '' : 's'} in the next 24 hours`, to: `${SA}/leads?tab=demos`, icon: CalendarCheck, tone: 'text-hb-blue' },
  { key: 'demo_requests_new', text: (n) => `${n} new demo request${n === 1 ? '' : 's'}`, to: `${SA}/leads?tab=demo-requests`, icon: UserPlus, tone: 'text-hb-blue' },
  { key: 'contact_new', text: (n) => `${n} new contact message${n === 1 ? '' : 's'}`, to: `${SA}/leads?tab=contact`, icon: MessageSquare, tone: 'text-hb-blue' },
  { key: 'emails_failed', text: (n) => `${n} email${n === 1 ? '' : 's'} failed this week`, to: `${SA}/system`, icon: MailWarning, tone: 'text-hb-error' },
  { key: 'errors_open', text: (n) => `${n} open error${n === 1 ? '' : 's'}`, to: `${SA}/system`, icon: TriangleAlert, tone: 'text-hb-error' },
  { key: 'sessions_active', text: (n) => `${n} support session${n === 1 ? '' : 's'} running`, to: `${SA}/users?tab=sessions`, icon: Headset, tone: 'text-hb-violet' },
]

export default function TodayCard() {
  const { data } = useSuperAdminTodo()
  if (!data) return null
  const rows = ROWS.filter((r) => (data[r.key] ?? 0) > 0)

  return (
    <Card>
      <CardHeader title="Today" subtitle="What needs you right now." />
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 text-hb-sm text-hb-muted">
          <CircleCheck size={16} aria-hidden className="text-hb-success" /> All clear. Nothing is waiting for you.
        </p>
      ) : (
        <ul className="-mx-2 divide-y divide-hb-border">
          {rows.map(({ key, text, to, icon: Icon, tone }) => (
            <li key={key}>
              <Link to={to} className="flex items-center gap-3 rounded-hb-md px-2 py-2.5 text-hb-sm text-hb-text hover:bg-hb-surface-2">
                <Icon size={16} aria-hidden className={`shrink-0 ${tone}`} />
                <span className="flex-1">{text(data[key])}</span>
                <ChevronRight size={15} aria-hidden className="text-hb-dim" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
