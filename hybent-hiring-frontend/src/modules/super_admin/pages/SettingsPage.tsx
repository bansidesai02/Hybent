import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Mail, Palette, Save, Shield } from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import { EmailAccountsSection } from '@/modules/recruiter/components/EmailAccountsSection'
import {
  Button,
  Card,
  CardHeader,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  Textarea,
} from '@/components/hb'

/**
 * Global platform configuration: mail delivery, session rules, white-labelling.
 *
 * Rebuilt on the design system in phase 9. Beyond appearance:
 *
 * - The three security switches were `<button>`s wrapping a translated `<div>`
 *   with no accessible name and no state — on the settings that decide whether
 *   tenant admins need 2FA and whether super-admin logins are IP-restricted.
 * - The security switches are enforced by the API (app/services/
 *   platform_security.py) once saved. Before that, nothing enforced them and
 *   the page wrote 2FA = on as a default on first view; the API now reports
 *   the switches as actually enforced, so an unsaved default shows as off.
 * - Every text input was a bare `<input>` with a `<label>` that had no `for`,
 *   so clicking a label did nothing and screen readers announced eight
 *   unlabelled fields. They are the design system's `Input`/`Select`, which
 *   associate the two.
 */

const SMTP_PROVIDERS = ['SendGrid', 'Amazon SES', 'SMTP relay'].map((v) => ({
  value: v,
  label: v,
}))

const SECURITY = [
  {
    key: 'require_2fa',
    title: 'Require 2FA for tenant admins',
    desc: 'Organization admins confirm a 6-digit code emailed to them at every sign-in (password or Google).',
  },
  {
    key: 'session_timeout',
    title: 'Auto session timeout (30 min)',
    desc: 'Signs everyone out after 30 minutes without activity; the server also refuses to resume an idle session.',
  },
  {
    key: 'ip_whitelist',
    title: 'Restrict super admin by IP',
    desc: 'Super admin sign-in and every super admin request must come from an address in the allow-list below.',
  },
] as const

const DEFAULTS = {
  smtp_provider: 'SendGrid',
  smtp_sender_name: 'Hybent',
  smtp_sender_email: 'no-reply@hybent.com',
  require_2fa: false,
  session_timeout: false,
  ip_whitelist: false,
  ip_allowlist: [] as string[],
  current_ip: null as string | null,
  platform_name: 'Hybent',
  logo_url: '',
  /* Not styling — this is the stored white-label value tenants configure.
     A hex is the data format the API expects. */
  primary_color: '#534AB7',
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState(DEFAULTS)
  /** The allow-list as typed: one address or CIDR range per line. */
  const [allowlistText, setAllowlistText] = useState('')

  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ['super-admin', 'settings'],
    queryFn: () => superAdminApi.getSettings(),
  })

  useEffect(() => {
    if (dbSettings) {
      setSettings({ ...DEFAULTS, ...dbSettings })
      setAllowlistText((dbSettings.ip_allowlist ?? []).join('\n'))
    }
  }, [dbSettings])

  const updateSettingsMutation = useMutation({
    mutationFn: (payload: any) => superAdminApi.updateSettings(payload),
    onSuccess: () => {
      toast.success('Platform configuration saved')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'settings'] })
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || err.message || 'Failed to save the configuration.'),
  })

  const set = (key: string, val: any) => setSettings((prev) => ({ ...prev, [key]: val }))

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    const { current_ip: _ip, ...payload } = settings
    updateSettingsMutation.mutate({
      ...payload,
      ip_allowlist: allowlistText.split(/[\n,]/).map((v) => v.trim()).filter(Boolean),
    })
  }

  if (isLoading) {
    return (
      <div className="pb-hb-10">
        <Skeleton className="mb-hb-6 h-12 w-80" rounded="md" />
        <div className="grid gap-hb-5 lg:grid-cols-2">
          <Skeleton className="h-[260px] w-full" rounded="md" />
          <Skeleton className="h-[260px] w-full" rounded="md" />
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Configuration"
        description="Outbound mail, platform-wide session rules and white-label branding."
        actions={
          <Button type="submit" icon={<Save size={15} />} loading={updateSettingsMutation.isPending}>
            Save configuration
          </Button>
        }
      />

      <div className="grid gap-hb-5 lg:grid-cols-2">
        <Card padding="loose">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Mail size={17} aria-hidden className="text-hb-cyan" />
                Email delivery
              </span>
            }
            subtitle="Saved for reference only."
          />
          <p className="mb-hb-4 rounded-hb-md border border-hb-warning/25 bg-hb-warning/8 p-3 text-hb-xs text-hb-text">
            Not applied yet: email is sent with the server's own mail settings (SMTP / Resend environment
            variables). Changing these fields does not change how mail is delivered.
          </p>
          <div className="space-y-hb-4">
            <Select
              label="SMTP provider"
              options={SMTP_PROVIDERS}
              value={settings.smtp_provider}
              onChange={(e) => set('smtp_provider', e.target.value)}
            />
            <div className="grid gap-hb-4 sm:grid-cols-2">
              <Input
                label="Sender name"
                value={settings.smtp_sender_name}
                onChange={(e) => set('smtp_sender_name', e.target.value)}
                placeholder="Hybent"
              />
              <Input
                label="Sender email"
                type="email"
                value={settings.smtp_sender_email}
                onChange={(e) => set('smtp_sender_email', e.target.value)}
                placeholder="no-reply@hybent.com"
              />
            </div>
          </div>
        </Card>

        <Card padding="loose">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Shield size={17} aria-hidden className="text-hb-cyan" />
                Security & sessions
              </span>
            }
            subtitle="Sign-in rules that apply across every tenant. They take effect when you save."
          />
          <div className="divide-y divide-hb-border">
            {SECURITY.map((sec) => (
              <div key={sec.key} className="py-3.5 first:pt-0 last:pb-0">
                <Switch
                  label={sec.title}
                  description={sec.desc}
                  checked={Boolean((settings as any)[sec.key])}
                  onChange={(next) => set(sec.key, next)}
                />
              </div>
            ))}
          </div>
          <div className="mt-hb-4 space-y-2">
            <Textarea
              label="Super admin IP allow-list"
              description="One IP address or CIDR range per line, e.g. 203.0.113.7 or 203.0.113.0/24."
              rows={3}
              value={allowlistText}
              onChange={(e) => setAllowlistText(e.target.value)}
              placeholder="203.0.113.7"
            />
            {settings.current_ip && (
              <p className="text-hb-xs text-hb-muted">
                Your current IP is <code className="font-mono text-hb-text">{settings.current_ip}</code>. Saving
                the restriction without it is refused, so you can't lock yourself out.{' '}
                <button
                  type="button"
                  className="font-semibold text-hb-cyan underline-offset-2 hover:underline"
                  onClick={() =>
                    setAllowlistText((t) => (t.trim() ? `${t.trim()}\n${settings.current_ip}` : String(settings.current_ip)))
                  }
                >
                  Add it
                </button>
              </p>
            )}
          </div>
        </Card>

        {/* Lets a super admin connect/manage mailboxes for their own organization —
            e.g. for support/debugging a client-facing sender directly, without
            impersonating an org admin just to reach this same panel. */}
        <div className="lg:col-span-2">
          <EmailAccountsSection />
        </div>

        <Card padding="loose" className="lg:col-span-2">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Palette size={17} aria-hidden className="text-hb-cyan" />
                Branding
              </span>
            }
            subtitle="Saved for reference only."
          />
          <p className="mb-hb-4 rounded-hb-md border border-hb-warning/25 bg-hb-warning/8 p-3 text-hb-xs text-hb-text">
            Not applied yet: nothing in the product reads these values, so the platform name, colour and logo
            shown to users don't change.
          </p>
          <div className="grid gap-hb-4 sm:grid-cols-3">
            <Input
              label="Platform name"
              value={settings.platform_name}
              onChange={(e) => set('platform_name', e.target.value)}
              placeholder="Hybent"
            />
            <Input
              label="Primary colour"
              value={settings.primary_color}
              onChange={(e) => set('primary_color', e.target.value)}
              placeholder={DEFAULTS.primary_color}
              leadingIcon={
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => set('primary_color', e.target.value)}
                  aria-label="Pick the primary colour"
                  className="h-5 w-5 cursor-pointer rounded-hb-xs border-0 bg-transparent p-0"
                />
              }
            />
            <Input
              label="Logo URL"
              value={settings.logo_url}
              onChange={(e) => set('logo_url', e.target.value)}
              placeholder="https://…"
            />
          </div>
        </Card>
      </div>
    </form>
  )
}
