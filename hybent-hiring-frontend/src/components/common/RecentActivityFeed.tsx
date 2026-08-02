import type { ReactNode } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  Calendar,
  Eye,
  Handshake,
  Inbox,
  Mail,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react'

import { activitiesApi } from '@/api/activities'
import { useAuthStore } from '@/store/authStore'
import { EmptyState, IconTile, Skeleton } from '@/components/hb'

/**
 * The live activity feed, shared by the recruiter overview, the admin dashboard
 * and the candidate portal.
 *
 * The glyph identifies the kind of event; it is not colour-coded. The previous
 * version tinted each action a different hue — emerald, violet, amber, blue,
 * pink, indigo — which made a feed of eight rows read as eight severities.
 */

const ACTIVITY_ICON: Record<string, ReactNode> = {
  CREATE: <Plus />,
  UPDATE_STAGE: <RefreshCw />,
  SCHEDULE: <Calendar />,
  OFFER_SENT: <Send />,
  OFFER_RESPONDED: <Handshake />,
  INVITE: <Mail />,
  VIEW: <Eye />,
  default: <Bell />,
}

function buildLabel(
  act: { action: string; resource_type: string; details: any; user_name?: string | null },
  isCandidate: boolean
): { title: string; sub: string } {
  const { action, resource_type, details, user_name } = act
  const authorSuffix = user_name && !isCandidate ? ` • by ${user_name.split(' ')[0]}` : ''

  if (resource_type === 'candidate' && action === 'VIEW') {
    return {
      title: isCandidate ? 'Someone viewed your profile' : `Profile Viewed — ${details?.name ?? ''}`,
      sub: isCandidate ? 'A recruiter is reviewing your details.' : `Candidate profile was accessed${authorSuffix}`
    }
  }

  if (resource_type === 'job' && action === 'CREATE') {
    return { title: `New Job — ${details?.title ?? 'Untitled'}`, sub: `Position posted${authorSuffix}` }
  }
  if (resource_type === 'candidate' && action === 'CREATE') {
    return {
      title: isCandidate ? 'Application Registered' : `New Candidate — ${details?.name ?? ''}`,
      sub: isCandidate ? 'Your profile is now in the pipeline.' : `Added to pipeline${authorSuffix}`
    }
  }
  if (action === 'UPDATE_STAGE') {
    return {
      title: isCandidate ? 'Stage Updated' : `Pipeline Update — ${details?.name ?? ''}`,
      sub: isCandidate
        ? `Your status moved to ${details?.to ?? '—'}`
        : `${details?.from ?? '—'} to ${details?.to ?? '—'}${authorSuffix}`
    }
  }
  if (action === 'SCHEDULE') {
    return {
      title: isCandidate ? 'Interview Scheduled' : `Interview Scheduled — ${details?.candidate ?? ''}`,
      sub: isCandidate ? `Check your interviews for: ${details?.title ?? ''}` : `${details?.title ?? ''}${authorSuffix}`
    }
  }
  if (action === 'OFFER_SENT') {
    return {
      title: isCandidate ? 'New Offer Received!' : `Offer Sent — ${details?.position ?? ''}`,
      sub: isCandidate ? 'Check your offers section for details.' : `Awaiting response${authorSuffix}`
    }
  }
  if (action === 'OFFER_RESPONDED') {
    return {
      title: isCandidate ? 'Offer Response Recorded' : `Offer Response — ${details?.position ?? ''}`,
      sub: isCandidate ? `You ${details?.status ?? 'responded'} to the offer.` : `${details?.status ?? ''}${authorSuffix}`
    }
  }
  if (action === 'INVITE') {
    return { title: `Invite Sent — ${details?.name ?? ''}`, sub: `${details?.email ?? ''}${authorSuffix}` }
  }
  return { title: action.replace(/_/g, ' '), sub: `${resource_type}${authorSuffix}` }
}

export function RecentActivityFeed({ limit = 10 }: { limit?: number }) {
  const { user } = useAuthStore()
  const isCandidate = user?.role === 'candidate'

  const { data: activities = [], isLoading, isError } = useQuery({
    queryKey: ['recent-activities', limit],
    queryFn: () => activitiesApi.list(limit).then((r) => r.data),
    staleTime: 60_000, // 1 minute stale time since we use WebSockets for updates
  })

  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-hb-border py-3 last:border-0">
            <Skeleton className="h-10 w-10" rounded="md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        tone="error"
        title="Could not load activity"
        description="The activity feed is unavailable right now. It will reappear on the next refresh."
      />
    )
  }

  const rows = activities
    // Candidates do not see "Someone viewed your profile" in the Live Activity feed.
    // Recruiters continue to see "Profile Viewed" entries for internal audit.
    .filter((act) => !(isCandidate && act.action === 'VIEW' && act.resource_type === 'candidate'))

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="Nothing yet"
        description={
          isCandidate
            ? 'Updates on your applications will show up here.'
            : 'Activity across your jobs and candidates will show up here.'
        }
      />
    )
  }

  return (
    <ul className="-my-1">
      {rows.map((act) => {
        const { title, sub } = buildLabel(act, isCandidate)
        return (
          <li
            key={act.id}
            className="flex items-center gap-3 border-b border-hb-border py-3 last:border-0"
          >
            <IconTile>{ACTIVITY_ICON[act.action] ?? ACTIVITY_ICON.default}</IconTile>

            <div className="min-w-0 flex-1">
              <p className="truncate text-hb-sm font-semibold text-hb-text">{title}</p>
              {sub && <p className="truncate text-hb-xs text-hb-muted">{sub}</p>}
            </div>

            <time
              dateTime={act.created_at}
              className="shrink-0 font-mono text-hb-micro uppercase text-hb-dim"
            >
              {formatDistanceToNow(new Date(act.created_at), { addSuffix: true }).replace('about ', '')}
            </time>
          </li>
        )
      })}
    </ul>
  )
}
