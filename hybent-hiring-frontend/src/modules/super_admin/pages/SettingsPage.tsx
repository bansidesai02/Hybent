import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superAdmin'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'react-hot-toast'
import { Mail, Shield, Save, Palette } from 'lucide-react'

export default function SettingsPage() {
  const queryClient = useQueryClient()

  // State
  const [settings, setSettings] = React.useState({
    smtp_provider: 'SendGrid',
    smtp_sender_name: 'Hirreon',
    smtp_sender_email: 'no-reply@hirreon.com',
    require_2fa: false,
    session_timeout: true,
    ip_whitelist: false,
    platform_name: 'Hirreon',
    logo_url: '',
    primary_color: '#534AB7'
  })

  // Queries
  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ['super-admin', 'settings'],
    queryFn: () => superAdminApi.getSettings()
  })

  // Sync state when data loads
  React.useEffect(() => {
    if (dbSettings) {
      setSettings(dbSettings)
    }
  }, [dbSettings])

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: (payload: any) => superAdminApi.updateSettings(payload),
    onSuccess: (data) => {
      toast.success('Global platform configurations saved successfully!')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'settings'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save settings changes.')
    }
  })

  const handleChange = (key: string, val: any) => {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    updateSettingsMutation.mutate(settings)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 pt-6">
        <Skeleton className="h-[200px] w-full rounded-2xl" />
        <Skeleton className="h-[200px] w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 pb-10 pt-6">
      {/* Header */}
      <header className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-[28px] font-black leading-tight text-[var(--text)]">Platform Configurations</h1>
          <p className="page-subtitle text-[13px] text-[var(--text-light)]">Modify global email delivery services, system branding, platform themes, and session timeout options.</p>
        </div>
        <button
          type="submit"
          disabled={updateSettingsMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-white transition-all hover:scale-[1.02] active:scale-95 shadow-md self-start md:self-auto"
          style={{
            background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))',
            boxShadow: '0 4px 14px rgba(108, 71, 255, 0.35)',
            opacity: updateSettingsMutation.isPending ? 0.75 : 1
          }}
        >
          <Save size={16} />
          {updateSettingsMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email configurations */}
        <div className="rounded-[24px] border p-6 space-y-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h3 className="text-[15px] font-black text-[var(--text)] flex items-center gap-2">
            <Mail className="text-[var(--violet)]" size={17} />
            Email configurations (SMTP)
          </h3>
          <p className="text-[11px] text-[var(--text-light)]">Configures SMTP relays details for outbound verification, scorecards, and magic links.</p>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[var(--text-mid)]">SMTP Provider</label>
            <select
              value={settings.smtp_provider}
              onChange={(e) => handleChange('smtp_provider', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none"
            >
              <option>SendGrid</option>
              <option>Amazon SES</option>
              <option>SMTP relay</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--text-mid)]">Sender Name</label>
              <input
                type="text"
                value={settings.smtp_sender_name}
                onChange={(e) => handleChange('smtp_sender_name', e.target.value)}
                placeholder="Hirreon"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--text-mid)]">Sender Email Address</label>
              <input
                type="email"
                value={settings.smtp_sender_email}
                onChange={(e) => handleChange('smtp_sender_email', e.target.value)}
                placeholder="no-reply@hirreon.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Security Options */}
        <div className="rounded-[24px] border p-6 space-y-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h3 className="text-[15px] font-black text-[var(--text)] flex items-center gap-2">
            <Shield className="text-[var(--violet)]" size={17} />
            Security & Session Rules
          </h3>
          <p className="text-[11px] text-[var(--text-light)]">Platform-wide login rules and administrator security constraints.</p>

          <div className="divide-y" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
            {[
              { key: 'require_2fa', title: 'Require 2FA for Tenant Admins', desc: 'Enforces authenticator registration logins.' },
              { key: 'session_timeout', title: 'Auto Session Timeout (30 min)', desc: 'Clears credentials tokens on 30m idle.' },
              { key: 'ip_whitelist', title: 'Restrict Super Admin by IP', desc: 'Enforces whitelist checking on admin logins.' }
            ].map(sec => (
              <div key={sec.key} className="flex items-center justify-between py-3">
                <div className="max-w-[75%]">
                  <p className="text-[12.5px] font-bold text-[var(--text)]">{sec.title}</p>
                  <p className="text-[11px] text-[var(--text-light)] mt-0.5">{sec.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange(sec.key, !settings[sec.key as keyof typeof settings])}
                  className={`w-9 h-[20px] rounded-full relative p-0.5 transition-colors duration-200 focus:outline-none ${settings[sec.key as keyof typeof settings] ? 'bg-[var(--violet)]' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <div 
                    className={`w-[16px] h-[16px] bg-white rounded-full transition-transform duration-200 ${settings[sec.key as keyof typeof settings] ? 'translate-x-[16px]' : 'translate-x-0'}`} 
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Brand details */}
        <div className="rounded-[24px] border p-6 space-y-4 lg:col-span-2" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h3 className="text-[15px] font-black text-[var(--text)] flex items-center gap-2">
            <Palette className="text-[var(--violet)]" size={17} />
            Platform Custom Branding
          </h3>
          <p className="text-[11px] text-[var(--text-light)]">Modify global SaaS white-label title assets and theme configurations.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--text-mid)]">Platform Name</label>
              <input
                type="text"
                value={settings.platform_name}
                onChange={(e) => handleChange('platform_name', e.target.value)}
                placeholder="Hirreon"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--text-mid)]">Platform Primary Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
                />
                <input
                  type="text"
                  value={settings.primary_color}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--text-mid)]">White-Label Logo URL</label>
              <input
                type="text"
                value={settings.logo_url}
                onChange={(e) => handleChange('logo_url', e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
