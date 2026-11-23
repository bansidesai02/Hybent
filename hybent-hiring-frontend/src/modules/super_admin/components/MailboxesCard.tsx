import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, Mail, TriangleAlert } from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import { Badge, Button, Card, CardHeader } from '@/components/hb'
import { formatDateTime, timeAgo } from '@/utils/formatters'

const PROVIDER: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook', smtp: 'SMTP' }
const SHOW = 5

/** Which organizations connected a mailbox, and whose stopped syncing. */
export default function MailboxesCard() {
  const [all, setAll] = useState(false)
  const { data } = useQuery({
    queryKey: ['super-admin', 'mailboxes'],
    queryFn: superAdminApi.getMailboxes,
    refetchInterval: 5 * 60_000,
  })
  if (!data) return null

  // Broken ones first: they need a call.
  const sorted = [...data.mailboxes].sort((a, b) => Number(b.needs_login) - Number(a.needs_login))
  const rows = all ? sorted : sorted.slice(0, SHOW)
  const providers = Object.entries(data.providers)
    .map(([p, n]) => `${PROVIDER[p] ?? p} ${n}`)
    .join(' · ')

  return (
    <Card>
      <CardHeader
        title="Connected mailboxes"
        subtitle={
          data.total === 0
            ? 'No organization has connected a mailbox yet.'
            : `${data.total} connected across ${data.organizations} organization${data.organizations === 1 ? '' : 's'}${providers ? ` · ${providers}` : ''}`
        }
      />
      {data.needs_login > 0 && (
        <p className="mb-hb-3 flex items-center gap-2 rounded-hb-md bg-hb-warning/10 px-3 py-2 text-hb-sm text-hb-text">
          <TriangleAlert size={15} aria-hidden className="shrink-0 text-hb-warning" />
          {data.needs_login} mailbox{data.needs_login === 1 ? '' : 'es'} stopped syncing and need{data.needs_login === 1 ? 's' : ''} a fresh sign-in. Resumes aren't coming in for them.
        </p>
      )}
      {data.total === 0 ? (
        <p className="flex items-center gap-2 text-hb-sm text-hb-muted">
          <Mail size={16} aria-hidden /> Mailboxes appear here when a client connects Gmail or Outlook.
        </p>
      ) : (
        <ul className="-mx-2 divide-y divide-hb-border">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-2 py-2.5" title={m.last_error ?? undefined}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-hb-sm font-semibold text-hb-text">{m.organization}</span>
                <span className="block truncate text-hb-xs text-hb-muted">
                  {m.email_address} · {PROVIDER[m.provider] ?? m.provider}
                  {m.owner ? ` · by ${m.owner}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {m.needs_login ? (
                  <Badge tone="warning">Needs sign-in</Badge>
                ) : (
                  <Badge tone="success">
                    <CircleCheck size={12} aria-hidden className="mr-1 inline" />
                    Live
                  </Badge>
                )}
                <span className="mt-0.5 block text-hb-xs text-hb-dim" title={m.last_synced_at ? formatDateTime(m.last_synced_at) : undefined}>
                  {m.last_synced_at ? `synced ${timeAgo(m.last_synced_at)}` : 'never synced'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {sorted.length > SHOW && (
        <Button variant="ghost" size="sm" className="mt-hb-2" onClick={() => setAll((v) => !v)}>
          {all ? 'Show less' : `See all ${sorted.length}`}
        </Button>
      )}
    </Card>
  )
}
