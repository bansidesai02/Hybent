import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variants = {
  primary:
    'bg-gradient-to-br from-[var(--violet)] to-[var(--violet-mid)] text-white border-0 shadow-violet hover:shadow-violet-lg hover:-translate-y-0.5',
  secondary:
    'bg-white/80 dark:bg-[var(--sb-hover)] text-text-dark dark:text-[var(--text)] border border-white/60 dark:border-[var(--card-border)] backdrop-blur-sm hover:-translate-y-0.5 hover:bg-white dark:hover:bg-[var(--sb-active)]',
  ghost:
    'bg-[rgba(167,139,250,0.08)] text-[var(--violet)] border-0 hover:bg-[rgba(167,139,250,0.14)]',
  glass:
    'bg-[rgba(255,255,255,0.72)] dark:bg-[rgba(31,27,54,0.84)] text-text-dark dark:text-[var(--text)] border border-[rgba(255,255,255,0.6)] dark:border-[var(--card-border)] backdrop-blur-xl hover:bg-white dark:hover:bg-[var(--card-bg)] hover:-translate-y-0.5',
  danger:
    'bg-red-500 hover:bg-red-600 text-white border-0',
  outline:
    'bg-transparent text-[var(--violet)] border border-[rgba(167,139,250,0.30)] hover:bg-[rgba(167,139,250,0.07)]',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-[8px]',
  md: 'px-[18px] py-[9px] text-[13px] rounded-[10px]',
  lg: 'px-10 py-4 text-[15px] rounded-[10px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 font-semibold font-sora transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--violet)]/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
)
Button.displayName = 'Button'
