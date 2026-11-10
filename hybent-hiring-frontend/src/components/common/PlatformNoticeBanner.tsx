import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Megaphone, Wrench, X } from 'lucide-react'

import api from '@/api/axios'
import { Button } from '@/components/hb'
import { useAuth } from '@/hooks/useAuth'

/**
 * The announcement and maintenance mode set from Super admin → Announcements.
 *
 * Announcement: a slim banner above the page (dismissable per message).
 * Maintenance: a screen in place of the app for organization users; the
 * server refuses their requests with 503 meanwhile. Super admins and support
 * sessions keep working and see a reminder that maintenance is on.
 */

export interface PlatformNotice {
  announcement: { active: boolean; message: string; tone: 'info' | 'warning' | 'success' }
  maintenance: { enabled: boolean; message: string }
  updated_at: string | null
}

const TONE = {
  info: 'border-hb-blue/20 bg-hb-blue/8 text-hb-blue',
  warning: 'border-hb-warning/30 bg-hb-warning/10 text-hb-warning',
  success: 'border-hb-success/30 bg-hb-success/10 text-hb-success',
}

const DISMISS_KEY = 'hb-dismissed-announcement'

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

export function PlatformNoticeBanner() {
  const { user, logout } = useAuth()
  const [dismissed, setDismissed] = useState(readDismissed)
  const { data } = useQuery({
    queryKey: ['platform-notice'],
    queryFn: () => api.get<PlatformNotice>('/v1/platform/status', { skipLoader: true }).then((r) => r.data),
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  if (!user || !data) return null

  const exempt = user.role === 'super_admin' || !!user.is_impersonating
  const { announcement: a, maintenance: m } = data

  if (m.enabled && !exempt) {
    return (
      <div role="alert" className="fixed inset-0 z-[90] flex items-center justify-center bg-hb-bg p-4">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-hb-4 flex h-12 w-12 items-center justify-center rounded-full bg-hb-warning/10 text-hb-warning">
            <Wrench size={22} aria-hidden />
          </span>
          <h1 className="text-hb-xl font-bold text-hb-text">We'll be right back</h1>
          <p className="mt-hb-2 text-hb-sm text-hb-muted">{m.message}</p>
          <div className="mt-hb-6 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Try again</Button>
            <Button variant="ghost" onClick={() => logout()}>Sign out</Button>
          </div>
        </div>
      </div>
    )
  }

  const key = `${data.updated_at ?? ''}|${a.message}`
  return (
    <>
      {m.enabled && exempt && (
        <div role="status" className="flex w-full items-center gap-2 border-b border-hb-warning/30 bg-hb-warning/10 px-4 py-2 text-hb-sm text-hb-text">
          <Wrench size={15} aria-hidden className="text-hb-warning" />
          <span><b>Maintenance mode is on.</b> Organization users can't use the app until you turn it off.</span>
        </div>
      )}
      {a.active && dismissed !== key && (
        <div role="status" className={`flex w-full items-center justify-between gap-3 border-b px-4 py-2 text-hb-sm ${TONE[a.tone]}`}>
          <span className="flex min-w-0 items-center gap-2 text-hb-text">
            <Megaphone size={15} aria-hidden className="shrink-0" />
            <span>{a.message}</span>
          </span>
          <button
            type="button"
            aria-label="Dismiss announcement"
            className="shrink-0 rounded p-1 text-hb-muted hover:text-hb-text"
            onClick={() => {
              setDismissed(key)
              try {
                localStorage.setItem(DISMISS_KEY, key)
              } catch {
                /* private mode: hidden for this visit only */
              }
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  )
}
