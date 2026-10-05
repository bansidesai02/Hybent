import { useId } from 'react'

/**
 * The Copilot's icon: a four-point sparkle with a small companion sparkle.
 * Every place that stands for the Copilot (sidebar, phone tab bar, floating
 * button, popup, full page) renders this, so they all read as one assistant.
 *
 * Takes the same `size` / `className` props as a lucide icon, so it can sit in
 * the nav config next to them. Fills with currentColor, or with the brand
 * gradient when `gradient` is set (for use on a plain background).
 */
const SPARKLE =
  'M12 1.5c.4 4.9 2.6 7.6 7.6 9.4.5.2.5.9 0 1.1-5 1.8-7.2 4.5-7.6 9.4 0 .6-.9.6-.9 0-.4-4.9-2.6-7.6-7.6-9.4-.5-.2-.5-.9 0-1.1 5-1.8 7.2-4.5 7.6-9.4 0-.6.9-.6.9 0Z'

// The path is centred on (11.55, 11.5); place a copy at (x, y) scaled by k.
const at = (x: number, y: number, k: number) => `translate(${x} ${y}) scale(${k}) translate(-11.55 -11.5)`

export function CopilotSparkle({
  size = 24,
  className,
  gradient = false,
}: {
  size?: number | string
  className?: string
  gradient?: boolean
}) {
  // useId() output has characters (":", "«") that break inside url(#…).
  const id = `cs-grad${useId().replace(/[^\w-]/g, '')}`
  const fill = gradient ? `url(#${id})` : 'currentColor'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className} style={{ flexShrink: 0 }}>
      {gradient && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#22CFFF" />
            <stop offset="0.4" stopColor="#4C6FFF" />
            <stop offset="0.75" stopColor="#A855F7" />
            <stop offset="1" stopColor="#E85CFF" />
          </linearGradient>
        </defs>
      )}
      <path fill={fill} d={SPARKLE} transform={at(10.4, 13.2, 0.88)} />
      <path fill={fill} d={SPARKLE} transform={at(19.6, 4.6, 0.36)} opacity={0.9} />
    </svg>
  )
}
