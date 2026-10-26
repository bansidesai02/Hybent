import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

import { authApi } from '@/api/auth'
import { useAuth } from '@/hooks/useAuth'

const LAST_ACTIVE_KEY = 'hybent_last_active_at'
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
 * "Auto session timeout" from the super admin Configuration page: signs out
 * after the platform's idle window with no input in any open tab.
 *
 * The server refuses to resume an idle session too (refresh is rejected), so
 * this is the visible half: it clears credentials on screen instead of
 * waiting for the next request to fail. Activity is shared across tabs via
 * localStorage, so working in one tab keeps the others signed in.
 */
export function useIdleSignOut() {
  const { logout, user } = useAuth()

  const { data: policy } = useQuery({
    queryKey: ['session-policy'],
    queryFn: () => authApi.sessionPolicy().then((r) => r.data),
    staleTime: 5 * 60_000,
    enabled: !!user,
  })
  const minutes = policy?.idle_timeout_minutes ?? null

  useEffect(() => {
    if (!minutes || !user) return

    const markActive = () => {
      try {
        localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
      } catch {
        /* storage unavailable: this tab's own timer still applies */
      }
      lastLocal = Date.now()
    }
    let lastLocal = Date.now()
    markActive()

    const lastActive = () => {
      try {
        return Math.max(lastLocal, Number(localStorage.getItem(LAST_ACTIVE_KEY)) || 0)
      } catch {
        return lastLocal
      }
    }

    let throttled = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - throttled > 15_000) {
        throttled = now
        markActive()
      }
    }
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    const timer = window.setInterval(() => {
      if (Date.now() - lastActive() > minutes * 60_000) {
        window.clearInterval(timer)
        toast(`Signed out after ${minutes} minutes of inactivity.`)
        logout()
      }
    }, 30_000)

    return () => {
      window.clearInterval(timer)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
    }
    // logout changes identity each render; the timer only needs the latest at fire time.
  }, [minutes, user?.id])
}
