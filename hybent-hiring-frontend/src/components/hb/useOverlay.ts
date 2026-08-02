import { useEffect, useRef } from 'react'

/**
 * Shared behaviour for anything that floats above the page.
 *
 * The product currently has 13 hand-rolled `fixed inset-0` overlays alongside
 * the shared modal, and between them they implement Escape, scroll lock and
 * focus handling inconsistently — most implement none of the three. A dialog
 * that does not trap focus lets Tab walk into the page behind it, which for a
 * screen reader user means the dialog effectively does not exist.
 *
 * Everything here is what an overlay must do to be usable, not decoration:
 *
 *   · Escape closes
 *   · focus moves in on open and returns to the trigger on close
 *   · Tab and Shift+Tab cycle within the overlay
 *   · the page behind cannot scroll, and does not shift when its bar is hidden
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useOverlay({
  open,
  onClose,
  closeOnEscape = true,
}: {
  open: boolean
  onClose: () => void
  closeOnEscape?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  /* Lock the page. Padding compensates for the scrollbar's width so the layout
     behind does not jump sideways as it disappears. */
  useEffect(() => {
    if (!open) return
    const { body, documentElement } = document
    const gap = window.innerWidth - documentElement.clientWidth
    const prevOverflow = body.style.overflow
    const prevPad = body.style.paddingRight

    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`

    return () => {
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPad
    }
  }, [open])

  /* Remember the trigger, focus the panel, hand focus back on close. */
  useEffect(() => {
    if (!open) return
    restoreTo.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    /* Prefer the first control; fall back to the panel so focus is never left
       on the page behind. */
    ;(first ?? panel)?.focus({ preventScroll: true })

    return () => {
      restoreTo.current?.focus?.({ preventScroll: true })
    }
  }, [open])

  /* Escape to close, Tab to cycle. */
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )
      if (!items.length) {
        e.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose, closeOnEscape])

  return panelRef
}
