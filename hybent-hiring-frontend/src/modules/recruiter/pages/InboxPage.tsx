import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { format, formatDistanceToNow } from 'date-fns'
import { AlertTriangle, Download, FileText, Paperclip, PenSquare, RefreshCw, Reply, RotateCcw, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'

import { inboxApi, type InboxView } from '@/api/inbox'
import { useAuth } from '@/hooks/useAuth'
import type { EmailAttachment, EmailMessage, EmailMessageDetail } from '@/types'
import { Badge, Button, Card, Dialog, EmptyState, Input, PageHeader, Select, Skeleton, Tabs, Textarea } from '@/components/hb'

/**
 * Resume email from a connected Gmail. Only emails with a PDF/DOC/DOCX
 * attached are brought in: every one the mailbox ever received, then new ones
 * every few minutes. Each shows what became of it (candidate created, already
 * in the system, processing, or needs review), and the mailbox can send and
 * reply from here through Gmail.
 *
 * Personal mailboxes are private to their owner; the company mailboxes an
 * admin connected are shared with admins and recruiters.
 */

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function errMsg(err: any, fallback: string) {
  return err?.response?.data?.detail || err?.response?.data?.message || fallback
}

const VIEWS: { value: InboxView; label: string }[] = [
  { value: 'all', label: 'All resumes' },
  { value: 'candidates', label: 'Became candidates' },
  { value: 'review', label: 'Failed' },
  { value: 'processing', label: 'Processing' },
]

/** What became of an email's resumes, as a badge. */
function StatusBadge({ message }: { message: EmailMessage }) {
  const s = message.ingestion_status
  if (message.candidate_count) {
    return (
      <Badge tone="success">
        {s === 'matched_existing' ? 'Already a candidate' : plural(message.candidate_count, 'candidate')}
      </Badge>
    )
  }
  if (s === 'skipped_not_resume') return <Badge tone="warning">Not a resume?</Badge>
  if (s === 'failed') return <Badge tone="error">Failed</Badge>
  if (s === 'retry_pending') return <Badge tone="warning">Retrying</Badge>
  return <Badge tone="info">Processing</Badge>
}

type ComposeState = { replyTo?: EmailMessageDetail } | null

export default function InboxPage() {
  const { basePath } = useAuth()
  const queryClient = useQueryClient()
  const [openMessage, setOpenMessage] = useState<EmailMessage | null>(null)
  const [accountId, setAccountId] = useState<string | undefined>(undefined)
  const [view, setView] = useState<InboxView>('all')
  const [compose, setCompose] = useState<ComposeState>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['inbox', accountId ?? 'primary', view],
    queryFn: () => inboxApi.list({ account_id: accountId, view }).then((r) => r.data),
    refetchInterval: 60_000,
  })

  const detailQuery = useQuery({
    queryKey: ['inbox', 'message', openMessage?.id, accountId],
    queryFn: () => inboxApi.get(openMessage!.id, accountId).then((r) => r.data),
    enabled: !!openMessage,
  })

  const syncMutation = useMutation({
    mutationFn: () => inboxApi.sync(accountId),
    onSuccess: (res) => {
      const n = res.data.new_count
      toast.success(n > 0 ? `${plural(n, 'new resume email')} found` : 'Inbox is up to date')
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
    onError: (err: any) => toast.error(errMsg(err, 'Sync failed')),
  })

  const retryMutation = useMutation({
    mutationFn: (id: string) => inboxApi.retry(id, accountId),
    onSuccess: () => {
      toast.success('Queued. It will be processed again in a few minutes.')
      setOpenMessage(null)
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
    onError: (err: any) => toast.error(errMsg(err, 'Could not retry')),
  })

  const account = data?.account
  const messages = data?.messages ?? []
  const counts = data?.counts ?? {}
  const isGmail = account?.provider === 'gmail'
  const needsReconnect = !!account && !!account.status && account.status !== 'connected'
  const mailboxes = data?.mailboxes ?? []
  const canUse = isGmail && !needsReconnect

  const subtitle = account
    ? [
        account.email_address,
        account.shared ? 'company mailbox' : 'only you can see this mailbox',
        account.last_synced_at
          ? `synced ${formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Connect a Gmail in Settings to see the resumes it receives here.'

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Mail"
        title="Inbox"
        description={subtitle}
        actions={
          account && isGmail ? (
            <div className="flex flex-wrap items-center gap-2">
              {mailboxes.length > 1 && (
                <Select
                  aria-label="Mailbox"
                  value={account.id}
                  onChange={(e) => {
                    setOpenMessage(null)
                    setAccountId(e.target.value)
                  }}
                  options={mailboxes.map((m) => ({
                    value: m.id,
                    label: `${m.email_address}${m.shared ? ' (company)' : m.is_default ? ' (primary)' : ''}`,
                  }))}
                  fieldClassName="min-w-[220px]"
                />
              )}
              <Button
                size="sm"
                variant="ghost"
                icon={<RefreshCw size={15} />}
                onClick={() => syncMutation.mutate()}
                loading={syncMutation.isPending}
                disabled={!canUse}
              >
                Sync now
              </Button>
              <Button size="sm" icon={<PenSquare size={15} />} onClick={() => setCompose({})} disabled={!canUse}>
                Compose
              </Button>
            </div>
          ) : undefined
        }
      />

      {needsReconnect && isGmail && (
        <Card className="mb-hb-4 border-hb-warning/40">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle size={18} className="text-hb-warning" aria-hidden />
            <p className="min-w-0 flex-1 text-hb-sm text-hb-text">
              Google access for <b>{account?.email_address}</b> has expired, so new resumes are not coming in.
              Reconnect it to continue.
            </p>
            <Button size="sm" to={`${basePath}/settings`}>
              Reconnect in Settings
            </Button>
          </div>
        </Card>
      )}

      {account && isGmail && (
        <Tabs<InboxView>
          aria-label="Filter resume emails"
          value={view}
          onChange={(v) => {
            setOpenMessage(null)
            setView(v)
          }}
          className="mb-hb-4"
          items={VIEWS.map((v) => ({ ...v, count: counts[v.value] }))}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" rounded="md" />
          <Skeleton className="h-16 w-full" rounded="md" />
          <Skeleton className="h-16 w-full" rounded="md" />
        </div>
      ) : !account ? (
        <Card>
          <EmptyState
            title="No mailbox connected"
            description="Connect a Gmail in Settings. Resumes it receives after connecting come in here every few minutes."
          />
        </Card>
      ) : !isGmail ? (
        <Card>
          <EmptyState
            title="Inbox not available for this provider"
            description="Reading incoming mail currently only works for Gmail-connected accounts. Custom SMTP accounts can send, but have no way to read mail back."
          />
        </Card>
      ) : messages.length === 0 ? (
        <Card>
          <EmptyState
            title={view === 'all' ? 'No resume emails yet' : 'Nothing here'}
            description={
              view === 'all'
                ? 'Resumes emailed to this Gmail after it was connected show up here within a few minutes.'
                : 'No emails in this tab right now.'
            }
            action={
              view === 'all' && canUse
                ? {
                    label: 'Sync now',
                    onClick: () => {
                      if (!syncMutation.isPending) syncMutation.mutate()
                    },
                  }
                : undefined
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-hb-border">
            {messages.map((message) => (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => setOpenMessage(message)}
                  className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors duration-hb hover:bg-hb-surface-2"
                >
                  <span
                    aria-hidden
                    className={`mt-2 h-2 w-2 shrink-0 rounded-full ${message.is_read ? 'bg-transparent' : 'bg-hb-blue'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className={`truncate text-hb-sm ${message.is_read ? 'text-hb-muted' : 'font-semibold text-hb-text'}`}>
                        {message.from_name || message.from_address || 'Unknown sender'}
                      </p>
                      {message.received_at && (
                        <span className="shrink-0 text-hb-xs text-hb-dim">
                          {format(new Date(message.received_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                    <p className={`truncate text-hb-sm ${message.is_read ? 'text-hb-muted' : 'text-hb-text'}`}>
                      <Paperclip size={12} className="mr-1 inline text-hb-dim" aria-hidden />
                      {message.subject || '(no subject)'}
                    </p>
                    <p className="truncate text-hb-xs text-hb-dim">{message.snippet}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge message={message} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog
        open={!!openMessage}
        onClose={() => setOpenMessage(null)}
        title={openMessage?.subject || '(no subject)'}
        size="xl"
      >
        {detailQuery.isLoading || !detailQuery.data ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" rounded="md" />
            <Skeleton className="h-40 w-full" rounded="md" />
          </div>
        ) : (
          <>
            <div className="mb-hb-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<Reply size={15} />}
                disabled={!canUse}
                onClick={() => setCompose({ replyTo: detailQuery.data })}
              >
                Reply
              </Button>
              {!detailQuery.data.candidates.length &&
                ['skipped_not_resume', 'failed'].includes(detailQuery.data.ingestion_status || '') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<RotateCcw size={15} />}
                    loading={retryMutation.isPending}
                    onClick={() => retryMutation.mutate(detailQuery.data!.id)}
                  >
                    Try again
                  </Button>
                )}
            </div>
            <MessageDetail detail={detailQuery.data} candidatesPath={`${basePath}/candidates`} accountId={accountId} />
          </>
        )}
      </Dialog>

      <ComposeDialog
        state={compose}
        fromAddress={account?.email_address}
        accountId={accountId}
        onClose={() => setCompose(null)}
      />
    </div>
  )
}

const splitAddresses = (v: string) =>
  v
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)

/** New email or reply, sent through the connected Gmail. */
function ComposeDialog({
  state,
  fromAddress,
  accountId,
  onClose,
}: {
  state: ComposeState
  fromAddress?: string
  accountId?: string
  onClose: () => void
}) {
  const reply = state?.replyTo
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [openedFor, setOpenedFor] = useState<ComposeState>(null)

  // Fill the form each time the dialog opens (fresh, or for a reply).
  if (state && state !== openedFor) {
    setOpenedFor(state)
    setTo(reply ? reply.reply_to || reply.from_address || '' : '')
    setCc('')
    const s = reply?.subject || ''
    setSubject(reply ? (/^re:/i.test(s) ? s : `Re: ${s}`) : '')
    setBody('')
  }
  if (!state && openedFor) setOpenedFor(null)

  const send = useMutation({
    mutationFn: () =>
      inboxApi.send(
        {
          to: splitAddresses(to),
          cc: splitAddresses(cc),
          subject: subject.trim(),
          body,
          reply_to_message_id: reply?.id,
        },
        accountId
      ),
    onSuccess: () => {
      toast.success(`Sent from ${fromAddress}`)
      onClose()
    },
    onError: (err: any) => toast.error(errMsg(err, 'Could not send')),
  })

  const ready = splitAddresses(to).length > 0 && !!subject.trim() && !!body.trim()

  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      title={reply ? 'Reply' : 'New email'}
      description={fromAddress ? `From ${fromAddress}. It also appears in this Gmail's Sent folder.` : undefined}
      size="lg"
    >
      <div className="space-y-hb-3">
        <Input
          label="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="name@company.com, another@company.com"
        />
        <Input label="Cc" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional" />
        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Textarea
          label="Message"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={reply ? 'Write your reply…' : 'Write your email…'}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!ready}>
            Send
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function MessageDetail({
  detail,
  candidatesPath,
  accountId,
}: {
  detail: EmailMessageDetail
  candidatesPath: string
  accountId?: string
}) {
  const sender = detail.from_name
    ? `${detail.from_name} <${detail.from_address}>`
    : detail.from_address || 'Unknown sender'
  const sentAt = detail.received_at
    ? format(new Date(detail.received_at), "EEE, d MMM yyyy 'at' h:mm a")
    : detail.date

  const headers: { label: string; value: string | null | undefined }[] = [
    { label: 'From', value: sender },
    { label: 'To', value: detail.to },
    { label: 'Cc', value: detail.cc },
    { label: 'Reply-To', value: detail.reply_to },
    { label: 'Date', value: sentAt },
  ]

  return (
    <div className="space-y-hb-5">
      {/* ── Headers ─────────────────────────────────────────────────── */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-hb-sm border border-hb-border bg-hb-surface-2 px-4 py-3 text-hb-sm">
        {headers
          .filter((h) => h.value)
          .map((h) => (
            <div key={h.label} className="contents">
              <dt className="font-mono text-hb-label uppercase text-hb-dim">{h.label}</dt>
              <dd className="min-w-0 break-words text-hb-text">{h.value}</dd>
            </div>
          ))}
      </dl>

      {/* ── Candidates ──────────────────────────────────────────────── */}
      {detail.candidates.length > 0 && (
        <section>
          <h3 className="mb-2 font-mono text-hb-label uppercase text-hb-dim">
            {plural(detail.candidates.length, 'candidate')} from this email
          </h3>
          <div className="flex flex-wrap gap-2">
            {detail.candidates.map((c) => (
              <Link
                key={c.id}
                to={`${candidatesPath}?openId=${c.id}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-hb-full border border-hb-border bg-hb-surface px-3 text-hb-sm font-semibold text-hb-text transition-colors duration-hb hover:border-hb-blue/40 hover:text-hb-blue"
              >
                <UserRound size={13} aria-hidden />
                {c.full_name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Attachments ─────────────────────────────────────────────── */}
      {detail.attachments.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-hb-label uppercase text-hb-dim">
            <Paperclip size={12} aria-hidden />
            {plural(detail.attachments.length, 'attachment')}
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {detail.attachments.map((a) => (
              <AttachmentRow
                key={a.index}
                messageId={detail.id}
                accountId={accountId}
                attachment={a}
                candidatesPath={candidatesPath}
              />
            ))}
          </ul>
        </section>
      )}

      {/* ── Body ────────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-2 font-mono text-hb-label uppercase text-hb-dim">Message</h3>
        {detail.body_html ? (
          // Email HTML is attacker-controlled (anyone can email this inbox), so
          // it's never inserted into this page's own DOM via innerHTML — that
          // would let an `onerror`/`javascript:` payload run with this app's
          // cookies and access. A sandboxed iframe with no `allow-scripts` and
          // no `allow-same-origin` fully isolates it instead.
          <iframe
            title="Message content"
            sandbox=""
            srcDoc={detail.body_html}
            className="h-[420px] w-full rounded-hb-sm border border-hb-border bg-white"
          />
        ) : (
          <p className="whitespace-pre-wrap rounded-hb-sm border border-hb-border px-4 py-3 text-hb-sm text-hb-text">
            {detail.body_text?.trim() || 'No message text'}
          </p>
        )}
      </section>
    </div>
  )
}

function AttachmentRow({
  messageId,
  accountId,
  attachment,
  candidatesPath,
}: {
  messageId: string
  accountId?: string
  attachment: EmailAttachment
  candidatesPath: string
}) {
  const [downloading, setDownloading] = useState(false)

  const download = async () => {
    setDownloading(true)
    try {
      const res = await inboxApi.downloadAttachment(messageId, attachment.index, accountId)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not download this attachment')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-hb-sm border border-hb-border bg-hb-surface px-3 py-2.5">
      <FileText size={18} className="flex-none text-hb-dim" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-hb-sm font-semibold text-hb-text" title={attachment.filename}>
          {attachment.filename}
        </p>
        <p className="truncate text-hb-xs text-hb-dim">
          {formatSize(attachment.size)}
          {attachment.candidate_id ? (
            <>
              {' · '}
              <Link to={`${candidatesPath}?openId=${attachment.candidate_id}`} className="text-hb-blue hover:underline">
                {attachment.candidate_name || 'View candidate'}
              </Link>
            </>
          ) : attachment.outcome ? (
            <>
              {' · '}
              <span className={attachment.outcome.startsWith('Waiting') ? 'text-hb-warning' : undefined}>
                {attachment.outcome}
              </span>
            </>
          ) : null}
        </p>
      </div>
      <Button
        size="sm"
        variant="quiet"
        icon={<Download size={15} />}
        onClick={download}
        loading={downloading}
        aria-label={`Download ${attachment.filename}`}
      />
    </li>
  )
}
