/**
 * useStickToBottom
 * Keeps a scrolling chat thread pinned to its newest content while anything
 * inside it grows — streamed text, live "Working…" steps, the approval card —
 * not only when a new message is added. If the recruiter scrolls up to read,
 * it stops following until they come back near the bottom.
 *
 * Scrolls the element itself (never scrollIntoView), so the app shell's
 * overflow-hidden ancestors don't move.
 */
import { useEffect, type RefObject } from 'react'

const NEAR_BOTTOM_PX = 120

export function useStickToBottom(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    let following = true
    let frame = 0

    const nearBottom = () => el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    const onScroll = () => {
      following = nearBottom()
    }
    const follow = () => {
      if (!following) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }))
    }

    // Any change inside the thread: new nodes, streamed text, a card expanding.
    const observer = new MutationObserver(follow)
    observer.observe(el, { childList: true, subtree: true, characterData: true })
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [ref, enabled])
}
