import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Eye, LogOut, PencilLine, ShieldAlert, Timer } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { getSupportSession, leaveSupportSession, takeSupportSessionNotice } from '@/utils/impersonation'

/**
 * Shown across the workspace while a super admin is in a support session:
 * whose account it is, whether changes are allowed, and how long is left.
 * When the time runs out the session ends here, before the API starts
 * refusing its token.
 */

const formatLeft = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ImpersonationBanner() {
  const { user, isImpersonating, exitImpersonation } = useAuth()
  const session = useMemo(() => (isImpersonating ? getSupportSession() : null), [isImpersonating])
  const [now, setNow] = useState(() => Date.now())
  const [leaving, setLeaving] = useState(false)

  // A session that ended away from the page (time limit, refused token) leaves a note.
  useEffect(() => {
    const notice = takeSupportSessionNotice()
    if (notice) toast(notice)
  }, [])

  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session])

  const left = session ? new Date(session.expiresAt).getTime() - now : null
  const timeUp = left !== null && left <= 0

  useEffect(() => {
    if (timeUp) void leaveSupportSession('expired', 'Your support session reached its time limit.')
  }, [timeUp])

  if (!isImpersonating || !user) return null

  const exit = async () => {
    setLeaving(true)
    try {
      await exitImpersonation()
    } finally {
      setLeaving(false)
    }
  }

  return (
    <div
      role="status"
      className="z-[9999] flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hb-warning/30 bg-hb-warning/10 px-4 py-2.5 backdrop-blur-md"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <ShieldAlert size={16} aria-hidden className="shrink-0 text-hb-warning" />
        <p className="text-hb-sm font-semibold text-hb-text">
          Support session as <strong className="font-bold">{user.full_name}</strong> ({user.role})
          {user.organization_name ? <> · {user.organization_name}</> : null}
        </p>
        {session && (
          <span className="inline-flex items-center gap-1 rounded-hb-sm border border-hb-border bg-hb-surface px-2 py-0.5 text-hb-xs font-semibold text-hb-text">
            {session.allowChanges ? (
              <>
                <PencilLine size={12} aria-hidden /> Changes allowed · recorded under your name
              </>
            ) : (
              <>
                <Eye size={12} aria-hidden /> View only
              </>
            )}
          </span>
        )}
        {left !== null && (
          <span
            className={`inline-flex items-center gap-1 font-mono text-hb-xs font-semibold ${
              left < 5 * 60_000 ? 'text-hb-error' : 'text-hb-muted'
            }`}
            aria-label={`${formatLeft(left)} left in this support session`}
          >
            <Timer size={12} aria-hidden /> {formatLeft(left)} left
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={exit}
        disabled={leaving}
        className="flex items-center gap-1.5 rounded-hb-sm bg-hb-grad px-3 py-1 text-hb-xs font-bold text-white shadow-hb-1 transition-all duration-hb hover:scale-[1.02] hover:shadow-hb-2 active:scale-95 disabled:opacity-60"
      >
        <LogOut size={13} aria-hidden />
        {leaving ? 'Ending…' : 'End session'}
      </button>
    </div>
  )
}
