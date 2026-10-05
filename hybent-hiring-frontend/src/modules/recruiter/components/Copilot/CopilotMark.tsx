import { clsx } from 'clsx'

/**
 * The Copilot's mark: the brand gradient with a four-point sparkle and a small
 * companion sparkle — the same ✦ the floating Copilot button uses, so the
 * full page and the popup read as one assistant.
 */
const SIZES = {
  sm: { box: 'h-8 w-8', main: 15, small: 6 },
  md: { box: 'h-10 w-10', main: 18, small: 7 },
  lg: { box: 'h-14 w-14', main: 26, small: 10 },
} as const

function Sparkle({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M12 1.5c.4 4.9 2.6 7.6 7.6 9.4.5.2.5.9 0 1.1-5 1.8-7.2 4.5-7.6 9.4 0 .6-.9.6-.9 0-.4-4.9-2.6-7.6-7.6-9.4-.5-.2-.5-.9 0-1.1 5-1.8 7.2-4.5 7.6-9.4 0-.6.9-.6.9 0Z"
      />
    </svg>
  )
}

export function CopilotMark({ size = 'md', className }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size]
  return (
    <span
      aria-hidden
      className={clsx(
        'relative grid shrink-0 place-items-center rounded-full bg-hb-grad text-hb-on-brand shadow-hb-1',
        s.box,
        className,
      )}
    >
      <Sparkle size={s.main} />
      <Sparkle size={s.small} className="absolute right-[18%] top-[16%] opacity-90" />
    </span>
  )
}
