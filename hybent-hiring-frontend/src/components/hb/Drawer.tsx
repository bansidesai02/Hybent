import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useOverlay } from './useOverlay'

/**
 * Side panel for detail-beside-list work.
 *
 * The pattern the recruiter screens actually need and do not have: opening a
 * candidate currently either navigates away from a filtered, scrolled list or
 * pushes the detail into a modal that cannot show enough. A drawer keeps the
 * list in place and its scroll position intact.
 *
 * Full width below `sm` — a 520px panel on a phone is a worse modal.
 */

type Size = 'sm' | 'md' | 'lg'

const SIZE: Record<Size, string> = {
  sm: 'sm:max-w-[400px]',
  md: 'sm:max-w-[520px]',
  lg: 'sm:max-w-[720px]',
}

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: Size
  side?: 'right' | 'left'
  className?: string
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  side = 'right',
  className,
}: DrawerProps) {
  const panelRef = useOverlay({ open, onClose })
  const titleId = useId()
  const descId = useId()
  const offscreen = side === 'right' ? '100%' : '-100%'

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1000]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-[rgb(5_6_11_/_0.5)]"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.3, 1] }}
            className={clsx(
              'absolute inset-y-0 w-full flex flex-col bg-hb-surface shadow-hb-3 focus:outline-none',
              side === 'right'
                ? 'right-0 border-l border-hb-border'
                : 'left-0 border-r border-hb-border',
              SIZE[size],
              className
            )}
          >
            <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-hb-border">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-hb-h3 text-hb-text truncate">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-hb-sm text-hb-muted">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="shrink-0 grid place-items-center w-8 h-8 rounded-hb-full text-hb-muted hover:text-hb-text hover:bg-hb-muted/10 transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring"
              >
                <X size={17} aria-hidden />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5 text-hb-body text-hb-text">
              {children}
            </div>

            {footer && (
              <footer className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-hb-border">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
