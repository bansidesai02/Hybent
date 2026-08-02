import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { ChevronRight } from 'lucide-react'

import { Reveal } from './Reveal'

/**
 * The header every page opens with.
 *
 * Only 18 of 77 pages used the old `.page-header` class, so titles drifted
 * across four sizes and three fonts. This is the one shape: Sora display title,
 * optional lead, optional breadcrumb, actions right-aligned and wrapping under
 * the title on narrow screens rather than squeezing it.
 */

export interface Crumb {
  label: string
  to?: string
}

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Trailing item is the current page and renders unlinked. */
  breadcrumbs?: Crumb[]
  actions?: ReactNode
  /** Mono uppercase kicker above the title, like the site's `.eyebrow`. */
  eyebrow?: string
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <header className={clsx('mb-hb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1.5 text-hb-xs text-hb-muted">
            {breadcrumbs.map((crumb, i) => {
              const last = i === breadcrumbs.length - 1
              return (
                <Fragment key={`${crumb.label}-${i}`}>
                  <li>
                    {crumb.to && !last ? (
                      <Link
                        to={crumb.to}
                        className="hover:text-hb-text transition-colors duration-hb"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current={last ? 'page' : undefined} className={clsx(last && 'text-hb-text')}>
                        {crumb.label}
                      </span>
                    )}
                  </li>
                  {!last && <ChevronRight size={13} aria-hidden className="text-hb-dim" />}
                </Fragment>
              )
            })}
          </ol>
        </nav>
      )}

      {/* The title block arrives rather than snaps — the site opens every page
          this way, and it sets the tempo for everything that follows. */}
      <Reveal as="div" className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            /* The site's `.eyebrow`: 11.5px mono at .22em, not the 10px/.16em
               of `text-hb-label`. The wider tracking is what makes it read as
               a Hybent kicker rather than a generic caption. */
            <p className="mb-3 font-mono text-hb-eyebrow uppercase text-hb-muted">{eyebrow}</p>
          )}
          <h1 className="font-display text-hb-display text-hb-text">{title}</h1>
          {description && (
            /* The site's `.lead`, at 62ch — the measure it sets for the same
               role. It was `hb-body` at 14px, which put the page's opening
               sentence at table-cell size. */
            <p className="mt-3 max-w-[62ch] text-hb-lead text-hb-muted">{description}</p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </Reveal>
    </header>
  )
}
