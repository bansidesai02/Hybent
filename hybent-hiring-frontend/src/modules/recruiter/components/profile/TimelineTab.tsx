import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'

import { activitiesApi } from '@/api/activities'
import { useAuth } from '@/hooks/useAuth'
import type { Candidate } from '@/types'
import { EmptyState, Skeleton } from '@/components/hb'

/**
 * The candidate's audit trail.
 *
 * The "View full audit log" link used to point at `/admin/audit`, which is not
 * a route — the audit page lives at `/hiring/admin/audit`, so the link resolved
 * to the catch-all and bounced the user to the marketing homepage. It is now
 * built from `basePath`, and only shown to roles that have an audit page.
 */
export function TimelineTab({ candidate }: { candidate: Candidate }) {
  const { user, basePath } = useAuth()
  const canSeeAuditLog = user?.role === 'admin' || user?.role === 'super_admin'

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['candidate-activities', candidate.id],
    queryFn: () => activitiesApi.list(50, candidate.id).then((r: any) => r.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" rounded="md" />
        ))}
      </div>
    )
  }

  if (!activities.length) {
    return (
      <EmptyState
        icon={<History />}
        title="No activity logged"
        description="Every stage change, interview and offer on this candidate will appear here."
      />
    )
  }

  return (
    <div className="space-y-hb-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-hb-label uppercase text-hb-dim">Audit trail</p>
        {canSeeAuditLog && (
          <Link
            to={`${basePath}/audit?resource_id=${candidate.id}`}
            className="text-hb-xs font-semibold text-hb-cyan transition-colors duration-hb hover:text-hb-text"
          >
            View full audit log
          </Link>
        )}
      </div>

      <ol className="space-y-2.5">
        {activities.map((a: any) => (
          <li key={a.id} className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-[13px] h-1.5 w-1.5 shrink-0 rounded-full bg-hb-grad"
            />
            <div className="min-w-0 flex-1 rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3.5 py-2.5">
              <p className="text-hb-sm font-semibold capitalize text-hb-text">
                {String(a.action).replace(/_/g, ' ').toLowerCase()}
              </p>
              <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-2 text-hb-xs text-hb-muted">
                <span>by {a.user_name || 'System'}</span>
                <time dateTime={a.created_at} className="font-mono text-hb-micro text-hb-dim">
                  {new Date(a.created_at).toLocaleString()}
                </time>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
