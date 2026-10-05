import { clsx } from 'clsx'

/**
 * The Copilot's icon: the ✦ glyph the floating Copilot button shows. Every
 * place that stands for the Copilot (sidebar, phone tab bar, the full page's
 * mark) renders this, so they all read as the same assistant.
 *
 * Takes the same `size` / `className` props as a lucide icon, so it can sit in
 * the nav config next to them.
 */
export function CopilotSparkle({ size = 24, className }: { size?: number | string; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx('inline-grid shrink-0 place-items-center leading-none', className)}
      style={{ width: size, height: size, fontSize: size }}
    >
      ✦
    </span>
  )
}
