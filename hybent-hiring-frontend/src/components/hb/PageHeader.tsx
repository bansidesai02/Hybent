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
    <header className={clsx('mb-5 md:mb-hb-6', className)}>
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
      <Reveal as="div" className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0">
          {eyebrow && (
            /* The site's `.eyebrow`: 11.5px mono at .22em, not the 10px/.16em
               of `text-hb-label`. The wider tracking is what makes it read as
               a Hybent kicker rather than a generic caption. */
            /* Phones drop the kicker: the top bar already says where you are. */
            <p className="mb-3 hidden font-mono text-hb-eyebrow uppercase text-hb-muted md:block">{eyebrow}</p>
          )}
          {/* Phones get an app-sized large title (26px), not the desktop hero. */}
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-hb-text md:text-hb-display">{title}</h1>
          {description && (
            /* The site's `.lead`, at 62ch — the measure it sets for the same
               role. It was `hb-body` at 14px, which put the page's opening
               sentence at table-cell size. */
            <p className="mt-1.5 line-clamp-2 max-w-[62ch] text-hb-sm text-hb-muted md:mt-3 md:line-clamp-none md:text-hb-lead">{description}</p>
          )}
        </div>

        {actions && (
          /* Phones: actions sit in one row under the title, sharing the width. */
          <div className="flex shrink-0 flex-wrap items-center gap-2 max-md:[&>*]:flex-1 max-md:[&>*]:justify-center">{actions}</div>
        )}
      </Reveal>
    </header>
  )
}
