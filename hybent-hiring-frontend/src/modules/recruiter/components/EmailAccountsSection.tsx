import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  Mail,
  MoreHorizontal,
  Plug,
  Plus,
  SendHorizonal,
  Star,
  Unplug,
} from 'lucide-react'

import { emailAccountsApi, type ConnectSmtpPayload } from '@/api/emailAccounts'
import { useAuth } from '@/hooks/useAuth'
import type { EmailAccount } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardDivider,
  CardHeader,
  ConfirmDialog,
  ContextMenu,
  Dialog,
  EmptyState,
  IconTile,
  Input,
  Switch,
  type ContextMenuItem,
} from '@/components/hb'

/**
 * Connected mailboxes for the organization ("recruiting@acme.com", say),
 * used to send candidate/recruiter email instead of the platform's shared
 * default sender. Admin-only to manage; the API also allows any org member
 * to list them read-only, but there is nothing useful for a non-admin to do
 * here, so the whole section stays behind `isAdmin` in the parent page.
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

function statusTone(status: EmailAccount['status']) {
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

function statusLabel(status: EmailAccount['status']) {
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

function providerLabel(provider: EmailAccount['provider']) {
  return { gmail: 'Gmail', outlook: 'Outlook', smtp: 'Custom SMTP' }[provider]
}

export function EmailAccountsSection() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const { isAdmin, isSuperAdmin } = useAuth()
  const canManage = isAdmin || isSuperAdmin

  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [reconnectMode, setReconnectMode] = useState(false)
  const [smtpForm, setSmtpForm] = useState<ConnectSmtpPayload>(EMPTY_SMTP_FORM)
  const [smtpError, setSmtpError] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; account: EmailAccount } | null>(null)
  const [disconnectTarget, setDisconnectTarget] = useState<EmailAccount | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['email-accounts'] })

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => emailAccountsApi.list().then((r) => r.data),
  })

  // Gmail OAuth lands back here via `${FRONTEND_URL}/hiring/admin/settings?...`
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === 'email_account_connected') {
      toast.success('Gmail account connected')
      invalidate()
    } else if (error === 'email_account_auth_failed') {
      toast.error('Could not connect the Gmail account. Please try again.')
    } else {
      return
    }
    searchParams.delete('success')
    searchParams.delete('error')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const connectSmtpMutation = useMutation({
    mutationFn: (data: ConnectSmtpPayload) => emailAccountsApi.connectSmtp(data),
    onSuccess: () => {
      toast.success(reconnectMode ? 'Mailbox reconnected' : 'Mailbox connected')
      closeConnectDialog()
      invalidate()
    },
    onError: (err: any) => {
      setSmtpError(err?.response?.data?.detail || 'Could not verify these SMTP credentials.')
    },
  })

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => emailAccountsApi.setDefault(id),
    onSuccess: () => {
      toast.success('Default sender updated')
      invalidate()
    },
    onError: () => toast.error('Failed to set default account'),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => emailAccountsApi.disconnect(id),
    onSuccess: () => {
      toast.success('Account disconnected')
      setDisconnectTarget(null)
      invalidate()
    },
    onError: () => toast.error('Failed to disconnect account'),
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

  const handleSmtpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSmtpError(null)
    connectSmtpMutation.mutate(smtpForm)
  }

  const closeConnectDialog = () => {
    setConnectDialogOpen(false)
    setReconnectMode(false)
    setSmtpError(null)
    setSmtpForm(EMPTY_SMTP_FORM)
  }

  /** Skips the "choose a provider" step — reconnects the same account directly. */
  const handleReconnect = (account: EmailAccount) => {
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

  const needsReconnect = (account: EmailAccount) =>
    account.status === 'disconnected' || account.status === 'reauth_required'

  const menuItems: ContextMenuItem[] = contextMenu
    ? [
        ...(needsReconnect(contextMenu.account)
          ? [
              {
                label: 'Reconnect',
                icon: <Plug size={14} aria-hidden />,
                onSelect: () => handleReconnect(contextMenu.account),
              },
            ]
          : []),
        ...(!contextMenu.account.is_default && !needsReconnect(contextMenu.account)
          ? [
              {
                label: 'Set as default',
                icon: <Star size={14} aria-hidden />,
                onSelect: () => setDefaultMutation.mutate(contextMenu.account.id),
              },
            ]
          : []),
        {
          label: 'Send test email',
          icon: <SendHorizonal size={14} aria-hidden />,
          onSelect: () => testSendMutation.mutate(contextMenu.account.id),
          disabled: contextMenu.account.status === 'disconnected',
        },
        {
          label: 'Disconnect',
          icon: <Unplug size={14} aria-hidden />,
          destructive: true,
          onSelect: () => setDisconnectTarget(contextMenu.account),
          disabled: contextMenu.account.status === 'disconnected',
        },
      ]
    : []

  return (
    <Card as="section">
      <CardHeader
        title="Email accounts"
        subtitle={
          canManage
            ? 'Connect mailboxes to send candidate and recruiter email from your own address instead of the platform default.'
            : "Your organization's connected sender mailboxes. Ask an admin to add or manage one."
        }
        icon={
          <IconTile size="sm">
            <Mail />
          </IconTile>
        }
        action={
          canManage ? (
            <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => setConnectDialogOpen(true)}>
              Connect account
            </Button>
          ) : undefined
        }
      />

      {isLoading ? null : !accounts || accounts.length === 0 ? (
        <EmptyState
          title="No mailboxes connected"
          description={
            canManage
              ? "Emails currently send from the platform's default address. Connect Gmail or a custom SMTP mailbox to send as your own team instead."
              : "Emails currently send from the platform's default address. No organization mailbox has been connected yet."
          }
          action={canManage ? { label: 'Connect account', onClick: () => setConnectDialogOpen(true) } : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {accounts.map((account, i) => (
            <li key={account.id}>
              {i > 0 && <CardDivider className="mb-3 mt-0" />}
              <div className="flex items-center gap-3">
                <IconTile size="sm">
                  <Mail />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-hb-sm font-semibold text-hb-text">
                      {account.display_name || account.email_address}
                    </p>
                    {account.is_default && <Badge tone="brand">Default</Badge>}
                    <Badge tone={statusTone(account.status)} dot>
                      {statusLabel(account.status)}
                    </Badge>
                  </div>
                  <p className="truncate text-hb-xs text-hb-muted">
                    {providerLabel(account.provider)} · {account.email_address}
                  </p>
                  {account.last_error && (
                    <p className="mt-0.5 truncate text-hb-xs text-hb-error">{account.last_error}</p>
                  )}
                </div>
                {canManage && needsReconnect(account) && (
                  <Button size="sm" variant="ghost" icon={<Plug size={14} />} onClick={() => handleReconnect(account)}>
                    Reconnect
                  </Button>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={(e) => setContextMenu({ x: e.clientX, y: e.clientY, account })}
                    aria-label={`More actions for ${account.email_address}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-hb-full border border-hb-border bg-hb-surface-2/80 text-hb-muted transition-all duration-hb hover:border-hb-blue/40 hover:bg-hb-blue/10 hover:text-hb-blue focus-visible:outline-none focus-visible:shadow-hb-ring"
                  >
                    <MoreHorizontal size={15} aria-hidden />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ContextMenu
        at={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={() => setContextMenu(null)}
        aria-label={contextMenu ? `Actions for ${contextMenu.account.email_address}` : undefined}
        items={menuItems}
      />

      {/* ── Connect / reconnect account ──────────────────────────────────────── */}
      <Dialog
        open={connectDialogOpen}
        onClose={closeConnectDialog}
        title={reconnectMode ? 'Reconnect mailbox' : 'Connect an email account'}
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
                label="From address"
                type="email"
                required
                disabled={reconnectMode}
                placeholder="recruiting@acme.com"
                value={smtpForm.email_address}
                onChange={(e) => setSmtpForm((f) => ({ ...f, email_address: e.target.value }))}
              />
              <Input
                label="Display name"
                placeholder="Acme Recruiting"
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
        open={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={() => disconnectTarget && disconnectMutation.mutate(disconnectTarget.id)}
        title="Disconnect this mailbox?"
        description={
          disconnectTarget
            ? `${disconnectTarget.email_address} will stop being used to send email. You can reconnect it later.`
            : undefined
        }
        confirmLabel="Disconnect"
        destructive
        loading={disconnectMutation.isPending}
      />
    </Card>
  )
}
