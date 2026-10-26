import { LogIn } from 'lucide-react'

import type { LoginEvent } from '@/api/superAdmin'
import { Badge, type Column, DataTable } from '@/components/hb'
import { formatDateTime } from '@/utils/formatters'

/**
 * Recorded sign-in attempts. Recording began when the login_events table
 * was added; anything earlier was never captured, and the empty state says so
 * rather than implying nobody signed in.
 */

const REASONS: Record<string, string> = {
  bad_credentials: 'Wrong email or password',
  user_suspended: 'Account suspended',
  org_suspended: 'Organization suspended',
  ip_not_allowed: 'IP not on allow-list',
  mfa_required: 'Code sent (2FA)',
  bad_otp: 'Wrong 2FA code',
  no_account: 'No such account',
}

const METHODS: Record<string, string> = { password: 'Password', google: 'Google', otp: '2FA code' }

function loginReason(reason: string | null) {
  return reason ? REASONS[reason] ?? reason : null
}

export default function LoginEventsTable({
  events,
  loading,
  showEmail = true,
  showOrganization = false,
  caption,
}: {
  events: Array<LoginEvent & { organization?: string | null }>
  loading?: boolean
  showEmail?: boolean
  showOrganization?: boolean
  caption: string
}) {
  const columns: Array<Column<LoginEvent & { organization?: string | null }>> = [
    {
      key: 'outcome',
      header: 'Outcome',
      width: '200px',
      cardTitle: !showEmail,
      cell: (e) =>
        e.success ? (
          <Badge tone="success">Signed in</Badge>
        ) : e.reason === 'mfa_required' ? (
          <Badge tone="info">{loginReason(e.reason)}</Badge>
        ) : (
          <Badge tone="error">{loginReason(e.reason) ?? 'Failed'}</Badge>
        ),
    },
    ...(showEmail
      ? [{
          key: 'email',
          header: 'Account',
          cardTitle: true,
          cell: (e: LoginEvent) => <span className="truncate text-hb-sm text-hb-text">{e.email}</span>,
        }]
      : []),
    ...(showOrganization
      ? [{
          key: 'organization',
          header: 'Organization',
          width: '170px',
          cell: (e: LoginEvent & { organization?: string | null }) => (
            <span className="text-hb-muted">{e.organization ?? '—'}</span>
          ),
        }]
      : []),
    {
      key: 'method',
      header: 'Method',
      width: '110px',
      cell: (e) => <span className="text-hb-muted">{METHODS[e.method] ?? e.method}</span>,
    },
    {
      key: 'ip',
      header: 'IP address',
      width: '140px',
      cell: (e) => <span className="font-mono text-hb-xs text-hb-muted">{e.ip_address ?? '—'}</span>,
    },
    {
      key: 'when',
      header: 'When',
      width: '190px',
      cell: (e) => <span className="font-mono text-hb-xs text-hb-muted">{formatDateTime(e.created_at)}</span>,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={events}
      rowKey={(e) => e.id}
      loading={loading}
      caption={caption}
      empty={{
        icon: <LogIn />,
        title: 'No sign-ins recorded',
        description: 'Sign-in history is recorded from the moment tracking was switched on; earlier sign-ins were never captured.',
      }}
    />
  )
}
