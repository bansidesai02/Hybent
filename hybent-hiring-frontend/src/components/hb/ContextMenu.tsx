import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { useOverlay } from './useOverlay'

/**
 * A menu that opens at a point — right-click, or a long-press.
 *
 * Portalled, so it is never clipped by the scroll container of whatever was
 * right-clicked, and flipped back inside the viewport when it would overflow.
 * The version this replaces was a `position:fixed` div with the raw mouse
 * coordinates written straight into a style object, no Escape handler, no focus
 * management, and a sibling full-screen div to catch the dismissing click.
 *
 * `useOverlay` supplies Escape, the focus trap and focus restore. The backdrop
 * here is transparent and exists only to catch a dismissing click — a context
 * menu should not dim the page it is acting on.
 */

export type ContextMenuItem = {
  label: string
  icon?: ReactNode
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
}

const MENU_WIDTH = 184
const EDGE = 8

export function ContextMenu({
  at,
  onClose,
  items,
  'aria-label': ariaLabel = 'Context menu',
}: {
  /** Viewport coordinates, or null when closed. */
  at: { x: number; y: number } | null
  onClose: () => void
  items: ContextMenuItem[]
  'aria-label'?: string
}) {
  const panelRef = useOverlay({ open: !!at, onClose })
  const measureRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  /* Measured after paint, before the browser shows it: a menu opened near the
     bottom or right edge flips back rather than being cut off. */
  useLayoutEffect(() => {
    if (!at) {
      setPos(null)
      return
    }
    const height = measureRef.current?.offsetHeight ?? items.length * 38 + 8
    setPos({
      top: Math.max(EDGE, Math.min(at.y, window.innerHeight - height - EDGE)),
      left: Math.max(EDGE, Math.min(at.x, window.innerWidth - MENU_WIDTH - EDGE)),
    })
  }, [at, items.length])

  if (!at) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[999]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />

      <div
        ref={(node) => {
          measureRef.current = node
          ;(panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        role="menu"
        aria-label={ariaLabel}
        tabIndex={-1}
        /* The only thing here that cannot be a class: a point on the screen. */
        style={{
          top: pos?.top ?? at.y,
          left: pos?.left ?? at.x,
          width: MENU_WIDTH,
          visibility: pos ? 'visible' : 'hidden',
        }}
        className={clsx(
          'fixed z-[1000] overflow-hidden rounded-hb-sm p-1',
          'border border-hb-border bg-hb-elevated shadow-hb-3',
          'focus:outline-none'
        )}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect()
              onClose()
            }}
            className={clsx(
              'flex w-full items-center gap-2.5 rounded-hb-sm px-3 py-2 text-left text-hb-sm',
              'transition-colors duration-hb',
              'focus-visible:outline-none focus-visible:shadow-hb-ring',
              'disabled:opacity-45 disabled:pointer-events-none',
              item.destructive
                ? 'text-hb-error hover:bg-hb-error/8'
                : 'text-hb-text hover:bg-hb-surface-2'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </>,
    document.body
  )
}
