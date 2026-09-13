import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { Inbox as InboxIcon, RefreshCw } from 'lucide-react'

import { inboxApi } from '@/api/inbox'
import { useAuth } from '@/hooks/useAuth'
import type { EmailMessage } from '@/types'
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, Skeleton } from '@/components/hb'

/**
 * A resolved inbox for whoever is looking: admins/super admins see their
 * organization's primary (shared) mailbox; a recruiter sees their own single
 * personal one. Reading is Gmail-only for now — SMTP has no read protocol.
 */

export default function InboxPage() {
  const { isAdmin } = useAuth()
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
            title="No messages yet"
            description="Click Sync now to pull in recent mail, or wait — this inbox syncs automatically every few minutes."
            action={{ label: 'Sync now', onClick: () => syncMutation.mutate() }}
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
                  {!message.is_read && <Badge tone="info">New</Badge>}
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
        description={openMessage?.from_name || openMessage?.from_address || undefined}
        size="lg"
      >
        {detailQuery.isLoading ? (
          <Skeleton className="h-40 w-full" rounded="md" />
        ) : detailQuery.data?.body_html ? (
          // Email HTML is attacker-controlled (anyone can email this inbox), so
          // it's never inserted into this page's own DOM via innerHTML — that
          // would let an `onerror`/`javascript:` payload run with this app's
          // cookies and access. A sandboxed iframe with no `allow-scripts` and
          // no `allow-same-origin` fully isolates it instead.
          <iframe
            title="Message content"
            sandbox=""
            srcDoc={detailQuery.data.body_html}
            className="h-[420px] w-full rounded-hb-sm border border-hb-border bg-white"
          />
        ) : (
          <p className="whitespace-pre-wrap text-hb-sm text-hb-text">
            {detailQuery.data?.body_text || 'No content'}
          </p>
        )}
      </Dialog>
    </div>
  )
}
