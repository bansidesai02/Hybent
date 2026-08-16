import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useOverlay } from './useOverlay'
import { Button } from './Button'

/**
 * The modal dialog.
 *
 * Replaces the shared `Modal` plus the 13 hand-rolled `fixed inset-0` overlays
 * that grew up beside it. Focus trapping, Escape and scroll lock come from
 * `useOverlay`; this file owns appearance and the header/body/footer shape.
 *
 * Rendered in a portal on `document.body` so a dialog opened from inside a
 * transformed or `overflow:hidden` ancestor — a card, a table cell — is never
 * clipped by it.
 */

type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZE: Record<Size, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: Size
  /** Off for destructive confirms, where a stray click should not dismiss. */
  closeOnOverlayClick?: boolean
  className?: string
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  className,
}: DialogProps) {
  const panelRef = useOverlay({ open, onClose })
  const titleId = useId()
  const descId = useId()

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeOnOverlayClick ? onClose : undefined}
            className="absolute inset-0 bg-[rgb(5_6_11_/_0.55)] backdrop-blur-[2px]"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.3, 1] }}
            className={clsx(
              'relative w-full max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col',
              'rounded-hb-lg border border-hb-border bg-hb-elevated shadow-hb-3',
              'focus:outline-none overflow-hidden',
              SIZE[size],
              className
            )}
          >
            <header className="flex items-start justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-hb-h2 text-hb-text">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1.5 text-hb-sm text-hb-muted">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="shrink-0 grid place-items-center w-8 h-8 rounded-hb-full text-hb-muted hover:text-hb-text hover:bg-hb-muted/10 transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring"
              >
                <X size={17} aria-hidden />
              </button>
            </header>

            {children && (
              <div className="px-4 sm:px-6 pb-2 overflow-y-auto flex-1 text-hb-body text-hb-text">
                {children}
              </div>
            )}

            {footer && (
              <footer className="flex flex-wrap items-center justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 mt-2 border-t border-hb-border">
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

/**
 * Confirmation dialog.
 *
 * Overlay click is disabled by default — a confirm exists precisely because the
 * action is worth a deliberate second input.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="quiet" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
