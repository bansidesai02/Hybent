import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { Download, FileText, Paperclip, RefreshCw, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'

import { inboxApi } from '@/api/inbox'
import { useAuth } from '@/hooks/useAuth'
import type { EmailAttachment, EmailMessage, EmailMessageDetail } from '@/types'
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, Skeleton } from '@/components/hb'

/**
 * A resolved inbox for whoever is looking: admins/super admins see their
 * organization's primary (shared) mailbox; a recruiter sees their own single
 * personal one. Reading is Gmail-only for now — SMTP has no read protocol.
 *
 * Only applications are listed — mail that email ingestion turned into (or
 * matched to) a candidate. The rest of a mailbox is alerts and newsletters.
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

export default function InboxPage() {
  const { isAdmin, basePath } = useAuth()
  const queryClient = useQueryClient()
  const [openMessage, setOpenMessage] = useState<EmailMessage | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => inboxApi.list().then((r) => r.data),
  })

  const detailQuery = useQuery({
    queryKey: ['inbox', 'message', openMessage?.id],
    queryFn: () => inboxApi.get(openMessage!.id).then((r) => r.data),
    enabled: !!openMessage,
  })

  const syncMutation = useMutation({
    mutationFn: () => inboxApi.sync(),
    onSuccess: (res) => {
      toast.success(
        res.data.new_count > 0 ? `${res.data.new_count} new message(s)` : 'Inbox is up to date'
      )
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Sync failed'),
  })

  const account = data?.account
  const messages = data?.messages ?? []
  const isGmail = account?.provider === 'gmail'

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Mail"
        title="Inbox"
        description={
          account
            ? `${account.email_address}${isAdmin ? " — your organization's primary mailbox" : ' — your mailbox'}`
            : 'Connect a mailbox in Settings to see your inbox here.'
        }
        actions={
          account && isGmail ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw size={15} />}
              onClick={() => syncMutation.mutate()}
              loading={syncMutation.isPending}
            >
              Sync now
            </Button>
          ) : undefined
        }
      />

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
            description={
              isAdmin
                ? "Connect an email account in Settings and mark it as your organization's default sender to see its inbox here."
                : 'Connect your own mailbox in Settings to see your inbox here.'
            }
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
            title="No applications yet"
            description="Emails with resumes attached show up here once they've been turned into candidates. The mailbox is checked automatically every few minutes."
            action={{
              label: 'Sync now',
              onClick: () => {
                if (!syncMutation.isPending) syncMutation.mutate()
              },
            }}
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
                          {format(new Date(message.received_at), 'MMM d, h:mm a')}
                        </span>
                      )}
                    </div>
                    <p className={`truncate text-hb-sm ${message.is_read ? 'text-hb-muted' : 'text-hb-text'}`}>
                      {message.subject || '(no subject)'}
                    </p>
                    <p className="truncate text-hb-xs text-hb-dim">{message.snippet}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {!!message.candidate_count && (
                      <Badge tone="success">{plural(message.candidate_count, 'candidate')}</Badge>
                    )}
                    {!message.is_read && <Badge tone="info">New</Badge>}
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
          <MessageDetail detail={detailQuery.data} candidatesPath={`${basePath}/candidates`} />
        )}
      </Dialog>
    </div>
  )
}


function MessageDetail({ detail, candidatesPath }: { detail: EmailMessageDetail; candidatesPath: string }) {
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
              <AttachmentRow key={a.index} messageId={detail.id} attachment={a} candidatesPath={candidatesPath} />
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
  attachment,
  candidatesPath,
}: {
  messageId: string
  attachment: EmailAttachment
  candidatesPath: string
}) {
  const [downloading, setDownloading] = useState(false)

  const download = async () => {
    setDownloading(true)
    try {
      const res = await inboxApi.downloadAttachment(messageId, attachment.index)
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
