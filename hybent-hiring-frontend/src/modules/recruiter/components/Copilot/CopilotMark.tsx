import { clsx } from 'clsx'
import { CopilotSparkle } from './CopilotSparkle'

/**
 * The Copilot's mark: the brand gradient with the Copilot sparkle — the same
 * badge the floating Copilot button uses, so the full page and the popup read
 * as one assistant.
 */
const SIZES = {
  sm: { box: 'h-8 w-8', main: 18 },
  md: { box: 'h-10 w-10', main: 22 },
  lg: { box: 'h-14 w-14', main: 30 },
} as const

export function CopilotMark({ size = 'md', className }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size]
  return (
    <span
      aria-hidden
      className={clsx(
        'grid shrink-0 place-items-center rounded-full bg-hb-grad text-hb-on-brand shadow-hb-1',
        s.box,
        className,
      )}
    >
      <CopilotSparkle size={s.main} />
    </span>
  )
}
