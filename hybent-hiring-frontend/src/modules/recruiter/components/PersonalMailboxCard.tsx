import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Mail, Plug, SendHorizonal, Unplug } from 'lucide-react'

import { emailAccountsApi, type ConnectSmtpPayload } from '@/api/emailAccounts'
import { useMailboxOAuthResult } from './useMailboxOAuthResult'
import {
  Badge,
  Button,
  Card,
  CardDivider,
  CardHeader,
  ConfirmDialog,
  Dialog,
  EmptyState,
  IconTile,
  Input,
  Switch,
} from '@/components/hb'

/**
 * A recruiter's one mailbox. Exactly one may be connected; it is their
 * sender for every email they trigger, and only they can see it or its
 * inbox. Connecting a different address replaces it.
 */

const EMPTY_SMTP_FORM: ConnectSmtpPayload = {
  email_address: '',
  display_name: '',
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  use_tls: true,
}

function statusTone(status: string) {
  switch (status) {
    case 'connected':
      return 'success' as const
    case 'reauth_required':
      return 'warning' as const
    case 'error':
      return 'error' as const
    default:
      return 'neutral' as const
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'connected':
      return 'Connected'
    case 'reauth_required':
      return 'Needs reconnect'
    case 'error':
      return 'Error'
    default:
      return 'Disconnected'
  }
}

export function PersonalMailboxCard() {
  const queryClient = useQueryClient()
  useMailboxOAuthResult()
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [reconnectMode, setReconnectMode] = useState(false)
  const [smtpForm, setSmtpForm] = useState<ConnectSmtpPayload>(EMPTY_SMTP_FORM)
  const [smtpError, setSmtpError] = useState<string | null>(null)
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['email-accounts'] })

  // The API returns only the caller's own mailboxes — for a recruiter, one.
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => emailAccountsApi.list().then((r) => r.data),
  })
  const account = accounts?.[0] ?? null
  const needsReconnect = account && (account.status === 'disconnected' || account.status === 'reauth_required')

  const closeConnectDialog = () => {
    setConnectDialogOpen(false)
    setReconnectMode(false)
    setSmtpError(null)
    setSmtpForm(EMPTY_SMTP_FORM)
  }

  const connectSmtpMutation = useMutation({
    mutationFn: (data: ConnectSmtpPayload) => emailAccountsApi.connectSmtp(data),
    onSuccess: () => {
      toast.success(reconnectMode ? 'Mailbox reconnected' : 'Mailbox connected')
      closeConnectDialog()
      invalidate()
    },
    onError: (err: any) => {
      setSmtpError(err?.response?.data?.message || 'Could not verify these SMTP credentials.')
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => emailAccountsApi.disconnect(id),
    onSuccess: () => {
      toast.success('Mailbox disconnected')
      setDisconnectConfirmOpen(false)
      invalidate()
    },
    onError: () => toast.error('Failed to disconnect'),
  })

  const testSendMutation = useMutation({
    mutationFn: (id: string) => emailAccountsApi.testSend(id),
    onSuccess: (res) => {
      if (res.data.success) toast.success('Test email sent — check your inbox')
      else toast.error(res.data.detail || 'Test send failed')
    },
    onError: () => toast.error('Test send failed'),
  })

  const handleGmailConnect = async () => {
    try {
      const res = await emailAccountsApi.gmailAuthorize()
      window.location.href = res.data.auth_url
    } catch {
      toast.error('Could not start Gmail connection')
    }
  }

  const handleReconnect = () => {
    if (!account) return
    if (account.provider === 'gmail') {
      handleGmailConnect()
      return
    }
    setSmtpError(null)
    setReconnectMode(true)
    setSmtpForm({
      email_address: account.email_address,
      display_name: account.display_name ?? '',
      smtp_host: account.smtp_host ?? '',
      smtp_port: account.smtp_port ?? 587,
      smtp_username: account.smtp_username ?? '',
      smtp_password: '',
      use_tls: true,
    })
    setConnectDialogOpen(true)
  }

  const handleSmtpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSmtpError(null)
    connectSmtpMutation.mutate(smtpForm)
  }

  if (isLoading) return null

  return (
    <Card as="section">
      <CardHeader
        title="Your email"
        subtitle="Email you send to candidates goes out from this mailbox, and its applications show in your Gmail Inbox. Only you can see it."
        icon={
          <IconTile size="sm">
            <Mail />
          </IconTile>
        }
      />

      {!account ? (
        <EmptyState
          title="No mailbox connected"
          description="Until you connect one, your emails go out from the platform's default address. You can connect one mailbox — connecting a different one later replaces it."
          action={{ label: 'Connect account', onClick: () => setConnectDialogOpen(true) }}
        />
      ) : (
        <div className="flex items-center gap-3">
          <IconTile size="sm">
            <Mail />
          </IconTile>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-hb-sm font-semibold text-hb-text">
                {account.display_name || account.email_address}
              </p>
              <Badge tone={statusTone(account.status)} dot>
                {statusLabel(account.status)}
              </Badge>
            </div>
            <p className="truncate text-hb-xs text-hb-muted">{account.email_address}</p>
            {account.last_error && (
              <p className="mt-0.5 truncate text-hb-xs text-hb-error">{account.last_error}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {needsReconnect ? (
              <Button size="sm" variant="ghost" icon={<Plug size={14} />} onClick={handleReconnect}>
                Reconnect
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="quiet"
                  icon={<SendHorizonal size={14} />}
                  onClick={() => testSendMutation.mutate(account.id)}
                  loading={testSendMutation.isPending}
                >
                  Test
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  icon={<Unplug size={14} />}
                  onClick={() => setDisconnectConfirmOpen(true)}
                >
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Connect / reconnect ──────────────────────────────────────────────── */}
      <Dialog
        open={connectDialogOpen}
        onClose={closeConnectDialog}
        title={reconnectMode ? 'Reconnect your mailbox' : 'Connect your mailbox'}
        description={
          reconnectMode
            ? 'Enter the current password for this mailbox to restore the connection.'
            : 'Gmail is the fastest way to connect — one click, no passwords to manage. Use custom SMTP for any other provider.'
        }
        size="md"
      >
        <div className="space-y-5">
          {!reconnectMode && (
            <>
              <Button fullWidth variant="ghost" icon={<Mail size={16} />} onClick={handleGmailConnect}>
                Connect with Gmail
              </Button>
              <CardDivider className="!mx-0" />
            </>
          )}

          <form onSubmit={handleSmtpSubmit} className="space-y-4">
            {!reconnectMode && (
              <p className="font-mono text-hb-label uppercase text-hb-dim">Or use custom SMTP</p>
            )}

            {smtpError && (
              <p className="rounded-hb-sm border border-hb-error/30 bg-hb-error/8 px-3 py-2 text-hb-xs text-hb-error">
                {smtpError}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Your email address"
                type="email"
                required
                disabled={reconnectMode}
                placeholder="you@acme.com"
                value={smtpForm.email_address}
                onChange={(e) => setSmtpForm((f) => ({ ...f, email_address: e.target.value }))}
              />
              <Input
                label="Display name"
                placeholder="Your name"
                value={smtpForm.display_name}
                onChange={(e) => setSmtpForm((f) => ({ ...f, display_name: e.target.value }))}
              />
              <Input
                label="SMTP host"
                required
                placeholder="smtp.gmail.com"
                value={smtpForm.smtp_host}
                onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_host: e.target.value }))}
              />
              <Input
                label="SMTP port"
                type="number"
                required
                value={smtpForm.smtp_port}
                onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_port: Number(e.target.value) }))}
              />
              <Input
                label="Username"
                required
                value={smtpForm.smtp_username}
                onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_username: e.target.value }))}
              />
              <Input
                label="Password"
                type="password"
                required
                description="An app password, not your account password, for providers like Gmail."
                value={smtpForm.smtp_password}
                onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_password: e.target.value }))}
              />
            </div>

            <Switch
              label="Use TLS"
              checked={smtpForm.use_tls}
              onChange={(next) => setSmtpForm((f) => ({ ...f, use_tls: next }))}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="quiet" onClick={closeConnectDialog}>
                Cancel
              </Button>
              <Button type="submit" loading={connectSmtpMutation.isPending}>
                {reconnectMode ? 'Verify and reconnect' : 'Verify and connect'}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* ── Disconnect confirm ───────────────────────────────────────────────── */}
      <ConfirmDialog
        open={disconnectConfirmOpen}
        onClose={() => setDisconnectConfirmOpen(false)}
        onConfirm={() => account && disconnectMutation.mutate(account.id)}
        title="Disconnect your mailbox?"
        description="You'll stop sending and receiving candidate email from this address. You can reconnect it (or a different one) anytime."
        confirmLabel="Disconnect"
        destructive
        loading={disconnectMutation.isPending}
      />
    </Card>
  )
}
