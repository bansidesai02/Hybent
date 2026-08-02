import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Mail, Palette, Save, Shield } from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import {
  Button,
  Card,
  CardHeader,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Switch,
} from '@/components/hb'

/**
 * Global platform configuration: mail delivery, session rules, white-labelling.
 *
 * Rebuilt on the design system in phase 9. Beyond appearance:
 *
 * - The three security switches were `<button>`s wrapping a translated `<div>`
 *   with no accessible name and no state — on the settings that decide whether
 *   tenant admins need 2FA and whether super-admin logins are IP-restricted.
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
    desc: 'Enforces authenticator registration at sign-in.',
  },
  {
    key: 'session_timeout',
    title: 'Auto session timeout (30 min)',
    desc: 'Clears credentials after 30 minutes idle.',
  },
  {
    key: 'ip_whitelist',
    title: 'Restrict super admin by IP',
    desc: 'Checks the allow-list on every super-admin sign-in.',
  },
] as const

const DEFAULTS = {
  smtp_provider: 'SendGrid',
  smtp_sender_name: 'Hirreon',
  smtp_sender_email: 'no-reply@hirreon.com',
  require_2fa: false,
  session_timeout: true,
  ip_whitelist: false,
  platform_name: 'Hirreon',
  logo_url: '',
  /* Not styling — this is the stored white-label value tenants configure.
     A hex is the data format the API expects. */
  // eslint-disable-next-line no-restricted-syntax
  primary_color: '#534AB7',
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState(DEFAULTS)

  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ['super-admin', 'settings'],
    queryFn: () => superAdminApi.getSettings(),
  })

  useEffect(() => {
    if (dbSettings) setSettings(dbSettings)
  }, [dbSettings])

  const updateSettingsMutation = useMutation({
    mutationFn: (payload: any) => superAdminApi.updateSettings(payload),
    onSuccess: () => {
      toast.success('Platform configuration saved')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'settings'] })
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save the configuration.'),
  })

  const set = (key: string, val: any) => setSettings((prev) => ({ ...prev, [key]: val }))

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    updateSettingsMutation.mutate(settings)
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
            subtitle="The SMTP relay used for verification, scorecards and magic links."
          />
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
                placeholder="Hirreon"
              />
              <Input
                label="Sender email"
                type="email"
                value={settings.smtp_sender_email}
                onChange={(e) => set('smtp_sender_email', e.target.value)}
                placeholder="no-reply@hirreon.com"
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
            subtitle="Login rules that apply across every tenant."
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
        </Card>

        <Card padding="loose" className="lg:col-span-2">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Palette size={17} aria-hidden className="text-hb-cyan" />
                Branding
              </span>
            }
            subtitle="White-label title, colour and logo for the platform."
          />
          <div className="grid gap-hb-4 sm:grid-cols-3">
            <Input
              label="Platform name"
              value={settings.platform_name}
              onChange={(e) => set('platform_name', e.target.value)}
              placeholder="Hirreon"
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
