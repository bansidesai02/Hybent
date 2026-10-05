import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { SCREENING_QUEUE_KEY, screeningApi } from '@/api/screening'
import type { ScreeningNav } from '@/components/layout/shell/navConfig'
import type { UserRole } from '@/types'

/**
 * Whether to show "To review" (the Candidate Screening Agent's list) in the
 * nav, and how many candidates are waiting there. Recruiters and admins only;
 * the decide call invalidates SCREENING_QUEUE_KEY, so the count updates at once.
 */
export function useScreeningNav(role: UserRole | undefined): ScreeningNav | undefined {
  const allowed = role === 'recruiter' || role === 'admin'
  const { data } = useQuery({
    queryKey: [...SCREENING_QUEUE_KEY, 'nav'],
    queryFn: () => screeningApi.getQueue('pending', 1).then((r) => r.data),
    enabled: allowed,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  })
  const enabled = data?.enabled
  const pending = data?.pending_total
  // Stable identity, so the nav (memoised on it) only rebuilds on a real change.
  return useMemo(
    () => (allowed && enabled !== undefined ? { enabled, pending: pending ?? 0 } : undefined),
    [allowed, enabled, pending],
  )
}
