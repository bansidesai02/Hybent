import { useEffect, useState, type RefObject } from 'react'

const THRESHOLD = 80 // px of pull that triggers a reload
const MAX_PULL = 120

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true

/**
 * Pull down at the top of the page to reload, in the installed app only.
 *
 * A browser tab has its own pull-to-refresh; the installed app (opened from
 * the home screen) has none, so new data and new deploys only arrived after
 * closing it. Returns how far the user has pulled (0 when idle), for the
 * indicator.
 */
export function usePullToRefresh(scrollRef: RefObject<HTMLElement>): { pull: number; refreshing: boolean } {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isStandalone()) return

    let startY: number | null = null
    let distance = 0

    const onStart = (e: TouchEvent) => {
      startY = el.scrollTop <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null
      distance = 0
    }
    const onMove = (e: TouchEvent) => {
      if (startY === null) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || el.scrollTop > 0) {
        distance = 0
        setPull(0)
        return
      }
      // Resist a little, like the native gesture.
      distance = Math.min(MAX_PULL, dy * 0.5)
      setPull(distance)
    }
    const onEnd = () => {
      if (startY !== null && distance >= THRESHOLD) {
        setRefreshing(true)
        window.location.reload()
        return
      }
      startY = null
      distance = 0
      setPull(0)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [scrollRef])

  return { pull, refreshing }
}

export const PULL_THRESHOLD = THRESHOLD
