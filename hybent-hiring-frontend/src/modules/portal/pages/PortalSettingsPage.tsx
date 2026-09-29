import { type ReactNode, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Download,
  Eye,
  Globe,
  Lock,
  Mail,
  Trash2,
} from 'lucide-react'

import {
  Button,
  Card,
  IconTile,
  PageHeader,
  Switch,
} from '@/components/hb'

/**
 * Account preferences. Everything here is placeholder UI — every row toasts
 * "coming soon" and the two alert toggles are component state only, exactly
 * as before.
 *
 * Rebuilt on the design system in phase 7. The old page was raw Tailwind
 * greys (`bg-white`, `text-gray-900`, `#6c47ff` twice) plus a hand-rolled
 * toggle; alerts now toast instead of `window.alert`, and the toggles are the
 * design system's `Switch`.
 */

interface SettingItem {
  label: string
  sub: string
  icon: ReactNode
  destructive?: boolean
}

const SECTIONS: Array<{ title: string; items: SettingItem[] }> = [
  {
    title: 'General',
    items: [
      { label: 'Account email', sub: 'Change your login email address', icon: <Mail /> },
      { label: 'Security & password', sub: 'Manage your authentication methods', icon: <Lock /> },
      { label: 'Language', sub: 'English (US)', icon: <Globe /> },
    ],
  },
  {
    title: 'Privacy & data',
    items: [
      { label: 'Profile visibility', sub: 'Control who can view your resume', icon: <Eye /> },
      { label: 'Data export', sub: 'Download a copy of your application data', icon: <Download /> },
      {
        label: 'Delete account',
        sub: 'Permanently remove your account and data',
        icon: <Trash2 />,
        destructive: true,
      },
    ],
  },
]

export default function PortalSettingsPage() {
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [smsAlerts, setSmsAlerts] = useState(false)

  const handleAction = (label: string) => toast(`${label} coming soon!`)

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Candidate portal"
        title="Settings"
        description="Manage your account preferences and security."
      />

      <div className="grid max-w-5xl gap-hb-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-hb-5">
          {SECTIONS.map((section, idx) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card padding="none" className="overflow-hidden">
                <div className="border-b border-hb-border bg-hb-surface-2 px-6 py-3.5">
                  <h2 className="font-mono text-hb-label uppercase text-hb-dim">
                    {section.title}
                  </h2>
                </div>
                <div className="divide-y divide-hb-border">
                  {section.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleAction(item.label)}
                      className="group flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors duration-hb hover:bg-hb-surface-2 focus-visible:outline-none focus-visible:shadow-hb-ring"
                    >
                      <span className="flex min-w-0 items-center gap-4">
                        <IconTile size="sm">{item.icon}</IconTile>
                        <span className="min-w-0">
                          <span
                            className={`block text-hb-sm font-semibold ${
                              item.destructive ? 'text-hb-error' : 'text-hb-text'
                            }`}
                          >
                            {item.label}
                          </span>
                          <span className="block text-hb-xs text-hb-muted">{item.sub}</span>
                        </span>
                      </span>
                      <ArrowRight
                        size={16}
                        aria-hidden
                        className="shrink-0 text-hb-dim transition-all duration-hb group-hover:translate-x-1 group-hover:text-hb-cyan"
                      />
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="space-y-hb-4">
          <Card padding="default">
            <h3 className="mb-hb-4 font-display text-hb-h3 text-hb-text">
              Notification preferences
            </h3>
            <div className="space-y-hb-4">
              <Switch
                label="Email alerts"
                checked={emailAlerts}
                onChange={setEmailAlerts}
              />
              <Switch label="SMS alerts" checked={smsAlerts} onChange={setSmsAlerts} />
            </div>
          </Card>

          <Card padding="default" className="text-center">
            <p className="font-mono text-hb-label uppercase text-hb-dim">Need help?</p>
            <p className="mb-hb-4 mt-1 text-hb-xs text-hb-muted">Contact our support 24/7.</p>
            <Button variant="ghost" className="w-full" onClick={() => handleAction('Support')}>
              Contact support
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
