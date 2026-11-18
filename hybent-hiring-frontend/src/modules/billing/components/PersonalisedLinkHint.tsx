import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

const BILLING_PATH = '/hiring/admin/billing'

export const PERSONALISED_LINK_TEXT =
  'Get a personalised job application link with your company name and let candidates apply directly.'

/** Trial upsell for the company-branded apply link (shown beside "Copy apply link"). */
export function PersonalisedLinkHint({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-hb-sm border border-hb-border bg-hb-surface text-left shadow-sm ${
        compact ? 'w-72 p-hb-3' : 'p-hb-3'
      }`}
    >
      <Sparkles size={14} className="mt-0.5 shrink-0 text-hb-blue" aria-hidden />
      <p className="text-hb-xs leading-relaxed text-hb-muted">
        {PERSONALISED_LINK_TEXT}{' '}
        <Link to={BILLING_PATH} className="font-semibold text-hb-blue hover:underline">
          Upgrade now to unlock this feature!
        </Link>
      </p>
    </div>
  )
}
