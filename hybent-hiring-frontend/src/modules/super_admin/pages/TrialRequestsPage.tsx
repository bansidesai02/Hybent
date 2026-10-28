import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { AlertTriangle, CalendarPlus, Check, ExternalLink, FlaskConical, Mail, X } from 'lucide-react'

import { trialsApi, type TrialReplyKind, type TrialRequest, type TrialRequestStatus } from '@/api/superAdmin'
import { TrialReplyDialog } from '../components/TrialReplyDialog'
import { useDebounce } from '@/components/chatbot/useDebounce'
import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  type Column,
  ConfirmDialog,
  DataTable,
  Dialog,
  Drawer,
  PageHeader,
  Pagination,
  Select,
  Tabs,
  Textarea,
  Toolbar,
  ToolbarSearch,
} from '@/components/hb'
import { formatDate, formatDateTime, timeAgo } from '@/utils/formatters'

/**
 * Free trial requests from hybent.com/free-trial.
 *
 * Nothing is granted until a super admin approves here. Approving creates the
 * company's workspace on the 7-day Trial plan and emails the applicant a
 * set-password link. The tabs follow each trial to its end: active, expired
 * (access paused, data kept 30 days), converted (paid) or purged.
 */

const PAGE_SIZE = 20

const TABS: Array<{ value: TrialRequestStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'purged', label: 'Purged' },
]

const STATUS_TONE: Record<TrialRequestStatus, BadgeTone> = {
  pending: 'warning',
  active: 'info',
  expired: 'error',
  converted: 'success',
  rejected: 'neutral',
  purged: 'neutral',
}

const EXTEND_OPTIONS = [1, 2, 3, 5, 7].map((d) => ({ value: String(d), label: `${d} day${d > 1 ? 's' : ''}` }))

function timeLeft(iso: string | null): string {
  if (!iso) return '—'
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'ended'
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`
  return hours >= 1 ? `${hours}h left` : `${Math.max(1, Math.floor(ms / 60_000))}m left`
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-hb-border py-2 text-hb-sm last:border-0">
      <dt className="text-hb-muted">{label}</dt>
      <dd className="min-w-0 break-words text-hb-text">{children || <span className="text-hb-dim">—</span>}</dd>
    </div>
  )
}

function LinkOut({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-hb-brand hover:underline">
      <span className="truncate">{href.replace(/^https?:\/\/(www\.)?/, '')}</span>
      <ExternalLink size={12} aria-hidden />
    </a>
  )
}

export default function TrialRequestsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<TrialRequestStatus>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(searchParams.get('id'))
  const [replying, setReplying] = useState<{ request: TrialRequest; kind: TrialReplyKind } | null>(null)
  const [extending, setExtending] = useState<TrialRequest | null>(null)
  const [extendDays, setExtendDays] = useState('3')
  const [notes, setNotes] = useState('')

  const search = useDebounce(searchQuery.trim(), 300)
  useEffect(() => setPage(1), [tab, search])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['super-admin', 'trials', tab, search, page],
    queryFn: () => trialsApi.list({ status: tab, search: search || undefined, page, page_size: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  })

  const { data: detail } = useQuery({
    queryKey: ['super-admin', 'trials', 'detail', openId],
    queryFn: () => trialsApi.get(openId as string),
    enabled: !!openId,
  })
  useEffect(() => setNotes(detail?.admin_notes ?? ''), [detail?.id, detail?.admin_notes])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'trials'] })
  const onError = (err: any) => toast.error(err?.response?.data?.message || 'Something went wrong.')

  const extend = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) => trialsApi.extend(id, days),
    onSuccess: (res) => {
      toast.success(res.status === 'active' ? 'Trial extended.' : 'Data retention extended.')
      setExtending(null)
      refresh()
    },
    onError,
  })
  const saveNotes = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => trialsApi.saveNotes(id, text),
    onSuccess: () => {
      toast.success('Notes saved.')
      refresh()
    },
    onError,
  })

  const counts = data?.counts
  const rows = data?.items ?? []
  const total = data?.total ?? 0

  const openRow = (id: string | null) => {
    setOpenId(id)
    const next = new URLSearchParams(searchParams)
    if (id) next.set('id', id)
    else next.delete('id')
    setSearchParams(next, { replace: true })
  }

  const columns: Array<Column<TrialRequest>> = [
    {
      key: 'company',
      header: 'Company',
      cardTitle: true,
      cell: (r) => (
        <span className="min-w-0">
          <span className="block truncate text-hb-sm font-semibold text-hb-text">{r.company_name}</span>
          <span className="block truncate text-hb-xs text-hb-muted">{r.company_domain} · {r.company_size} · {r.industry}</span>
          <span className="mt-1 inline-block"><Badge tone={r.plan_interest === 'pro' ? 'brand' : 'neutral'}>{r.plan_interest === 'pro' ? 'Pro trial' : 'Standard trial'}</Badge></span>
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      width: '220px',
      cell: (r) => (
        <span className="min-w-0">
          <span className="block truncate text-hb-sm text-hb-text">{r.contact_name}</span>
          <span className="block truncate text-hb-xs text-hb-muted">{r.contact_email}</span>
        </span>
      ),
    },
    {
      key: 'checks',
      header: 'Checks',
      width: '120px',
      cell: (r) =>
        r.risk_flags.length ? (
          <Badge tone="warning" title={r.risk_flags.join('\n')}>
            <AlertTriangle size={12} aria-hidden /> {r.risk_flags.length} flag{r.risk_flags.length > 1 ? 's' : ''}
          </Badge>
        ) : (
          <Badge tone="success">Domain OK</Badge>
        ),
    },
    {
      key: 'when',
      header: tab === 'pending' || tab === 'rejected' ? 'Requested' : 'Trial ends',
      width: '160px',
      cell: (r) =>
        tab === 'pending' || tab === 'rejected' ? (
          <span className="text-hb-sm text-hb-muted" title={formatDateTime(r.created_at)}>{timeAgo(r.created_at)}</span>
        ) : tab === 'active' ? (
          <span className="text-hb-sm text-hb-text" title={formatDateTime(r.trial_end)}>{timeLeft(r.trial_end)}</span>
        ) : tab === 'expired' ? (
          <span className="text-hb-sm text-hb-muted">Purge {formatDate(r.data_purge_at)}</span>
        ) : (
          <span className="text-hb-sm text-hb-muted">{formatDate(r.converted_at ?? r.purged_at ?? r.trial_end)}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '200px',
      align: 'right',
      hideOnCard: true,
      cell: (r) =>
        r.status === 'pending' ? (
          <span className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => setReplying({ request: r, kind: 'reject' })}>Reject</Button>
            <Button size="sm" icon={<Check size={14} />} onClick={() => setReplying({ request: r, kind: 'approve' })}>Reply</Button>
          </span>
        ) : r.status === 'active' || r.status === 'expired' ? (
          <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={<CalendarPlus size={14} />} onClick={() => setExtending(r)}>Extend</Button>
          </span>
        ) : null,
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Clients"
        title="Free trials"
        description="Review 7-day trial requests, approve verified companies, and follow each trial to conversion or expiry."
        actions={counts?.pending ? <Badge tone="warning">{counts.pending} awaiting review</Badge> : undefined}
      />

      <Tabs
        aria-label="Trial status"
        value={tab}
        onChange={setTab}
        items={TABS.map((t) => ({ ...t, count: counts?.[t.value] }))}
        className="mb-hb-4"
      />

      <Toolbar>
        <ToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search company, domain, name or email…"
          aria-label="Search trial requests"
        />
      </Toolbar>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={isLoading}
          onRowClick={(r) => openRow(r.id)}
          caption="Free trial requests"
          empty={
            isError
              ? {
                  icon: <FlaskConical />,
                  title: 'Could not load trial requests',
                  description: 'The server did not respond as expected.',
                  size: 'page',
                  action: { label: 'Retry', onClick: () => refetch() },
                }
              : {
                  icon: <FlaskConical />,
                  title: tab === 'pending' ? 'No requests waiting' : `No ${tab} trials`,
                  description: tab === 'pending' ? 'New requests from hybent.com/free-trial appear here.' : 'Nothing in this list yet.',
                  size: 'page',
                }
          }
        />
        <Pagination
          page={page}
          pages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          total={total}
          limit={PAGE_SIZE}
          onPage={setPage}
          noun="requests"
          asCardFooter
        />
      </Card>

      <Drawer
        open={!!openId}
        onClose={() => openRow(null)}
        title={detail?.company_name ?? 'Trial request'}
        description={detail ? <Badge tone={STATUS_TONE[detail.status]}>{detail.status}</Badge> : undefined}
        size="lg"
        footer={
          detail?.status === 'pending' ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" icon={<X size={14} />} onClick={() => setReplying({ request: detail, kind: 'reject' })}>Reject</Button>
              <Button icon={<Check size={14} />} onClick={() => setReplying({ request: detail, kind: 'approve' })}>Reply & approve</Button>
            </div>
          ) : detail && (detail.status === 'active' || detail.status === 'expired') ? (
            <div className="flex justify-end">
              <Button variant="ghost" icon={<CalendarPlus size={14} />} onClick={() => setExtending(detail)}>
                {detail.status === 'active' ? 'Extend trial' : 'Extend data retention'}
              </Button>
            </div>
          ) : undefined
        }
      >
        {detail && (
          <div className="space-y-hb-6">
            {detail.risk_flags.length > 0 && (
              <div className="rounded-hb-md border border-hb-warning/40 bg-hb-warning/8 p-hb-3 text-hb-sm text-hb-text">
                <p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={14} aria-hidden /> Check before approving</p>
                <ul className="list-disc pl-5">{detail.risk_flags.map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
            )}

            <section>
              <h3 className="mb-2 text-hb-xs font-semibold uppercase tracking-wide text-hb-muted">Company</h3>
              <dl>
                <Detail label="Plan to try">{detail.plan_interest === 'pro' ? 'Pro' : 'Standard'}</Detail>
                <Detail label="Name">{detail.company_name}</Detail>
                <Detail label="Website"><LinkOut href={detail.company_website} /></Detail>
                <Detail label="LinkedIn page"><LinkOut href={detail.company_linkedin_url} /></Detail>
                <Detail label="Email domain">{detail.company_domain}</Detail>
                <Detail label="Size">{detail.company_size} employees</Detail>
                <Detail label="Industry">{detail.industry}</Detail>
                <Detail label="Country">{detail.country}</Detail>
                <Detail label="Hires per year">{detail.hires_per_year}</Detail>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-hb-xs font-semibold uppercase tracking-wide text-hb-muted">Contact</h3>
              <dl>
                <Detail label="Name">{detail.contact_name}</Detail>
                <Detail label="Title">{detail.contact_title}</Detail>
                <Detail label="Email">
                  <a className="text-hb-brand hover:underline" href={`mailto:${detail.contact_email}`}>{detail.contact_email}</a>
                  {detail.email_verified_at && <span className="ml-2"><Badge tone="success">Verified</Badge></span>}
                </Detail>
                <Detail label="Phone">{detail.contact_phone}</Detail>
                <Detail label="LinkedIn"><LinkOut href={detail.contact_linkedin_url} /></Detail>
                <Detail label="Wants to try">{detail.hiring_needs && <span className="whitespace-pre-wrap">{detail.hiring_needs}</span>}</Detail>
                <Detail label="Requested">{formatDateTime(detail.created_at)} {detail.ip_address && <span className="text-hb-dim">· {detail.ip_address}</span>}</Detail>
              </dl>
            </section>

            {detail.status !== 'pending' && (
              <section>
                <h3 className="mb-2 text-hb-xs font-semibold uppercase tracking-wide text-hb-muted">Trial</h3>
                <dl>
                  {detail.status === 'rejected' ? (
                    <Detail label="Rejected">{formatDateTime(detail.reviewed_at)} · {detail.rejection_reason}</Detail>
                  ) : (
                    <>
                      <Detail label="Started">{formatDateTime(detail.trial_start)}</Detail>
                      <Detail label="Setup">
                        {detail.setup_completed_at ? `Completed ${formatDateTime(detail.setup_completed_at)}` : 'Waiting for the company to set up'}
                      </Detail>
                      <Detail label="Ends">{formatDateTime(detail.trial_end)} {detail.status === 'active' && <span className="text-hb-dim">· {timeLeft(detail.trial_end)}</span>}</Detail>
                      <Detail label="Reminders">
                        {[detail.reminder_1d_sent_at && '1 day', detail.reminder_1h_sent_at && '1 hour'].filter(Boolean).join(', ') || 'None sent yet'}
                      </Detail>
                      {detail.data_purge_at && <Detail label="Data deleted on">{formatDateTime(detail.data_purge_at)}</Detail>}
                      {detail.converted_at && <Detail label="Converted">{formatDateTime(detail.converted_at)}</Detail>}
                      {detail.purged_at && <Detail label="Purged">{formatDateTime(detail.purged_at)}</Detail>}
                      {detail.usage && (
                        <Detail label="Usage">{detail.usage.users} users · {detail.usage.jobs} jobs · {detail.usage.candidates} candidates</Detail>
                      )}
                      {detail.organization_id && (
                        <Detail label="Workspace">
                          <Button size="sm" variant="ghost" to={`/hiring/super-admin/clients/${detail.organization_id}`}>Open client</Button>
                        </Detail>
                      )}
                    </>
                  )}
                </dl>
              </section>
            )}

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-hb-xs font-semibold uppercase tracking-wide text-hb-muted">Emails sent</h3>
                {detail.status === 'pending' && (
                  <Button size="sm" variant="ghost" icon={<Mail size={14} />} onClick={() => setReplying({ request: detail, kind: 'info' })}>
                    Ask for info
                  </Button>
                )}
              </div>
              {detail.messages && detail.messages.length > 0 ? (
                <ul className="space-y-2">
                  {detail.messages.map((m) => (
                    <li key={m.id} className="rounded-hb-md border border-hb-border p-hb-3">
                      <details>
                        <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-hb-sm">
                          <Badge tone={m.kind === 'approve' ? 'success' : m.kind === 'reject' ? 'error' : 'info'}>{m.kind}</Badge>
                          <span className="min-w-0 flex-1 truncate font-semibold text-hb-text">{m.subject}</span>
                          {!m.delivered && <Badge tone="warning">Not delivered</Badge>}
                          <span className="text-hb-xs text-hb-muted">{formatDateTime(m.created_at)}</span>
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap text-hb-sm text-hb-muted">{m.body}</p>
                        <p className="mt-2 text-hb-xs text-hb-dim">
                          By {m.sent_by_email ?? 'unknown'}{m.ai_generated ? ' · AI draft' : ''}
                        </p>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-hb-sm text-hb-dim">No emails yet.</p>
              )}
            </section>

            <section>
              <Textarea
                label="Internal notes"
                description="Only super admins see these."
                rows={3}
                maxLength={5000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  loading={saveNotes.isPending}
                  disabled={notes === (detail.admin_notes ?? '')}
                  onClick={() => saveNotes.mutate({ id: detail.id, text: notes })}
                >
                  Save notes
                </Button>
              </div>
            </section>
          </div>
        )}
      </Drawer>



      <Dialog
        open={!!extending}
        onClose={() => setExtending(null)}
        title={extending?.status === 'active' ? 'Extend trial' : 'Extend data retention'}
        description={
          extending?.status === 'active'
            ? `Adds time to ${extending?.company_name}'s trial. The 1-day and 1-hour reminders are sent again before the new end.`
            : `Keeps ${extending?.company_name}'s data longer before it's deleted. Access stays paused until they upgrade.`
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setExtending(null)}>Cancel</Button>
            <Button loading={extend.isPending} onClick={() => extending && extend.mutate({ id: extending.id, days: Number(extendDays) })}>
              Extend
            </Button>
          </div>
        }
      >
        <Select label="Extend by" options={EXTEND_OPTIONS} value={extendDays} onChange={(e) => setExtendDays(e.target.value)} />
      </Dialog>

      <TrialReplyDialog
        request={replying?.request ?? null}
        initialKind={replying?.kind ?? 'approve'}
        onClose={() => setReplying(null)}
      />
    </div>
  )
}
