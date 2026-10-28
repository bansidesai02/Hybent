import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { VOICE_CALLS_KEY, voiceCallsApi } from '@/api/voiceCalls'
import type { AICallsNav } from '@/components/layout/shell/navConfig'
import type { UserRole } from '@/types'

/** AI calling for the user's org: `enabled`, and `known` once the server has answered. */
export function useAICallsStatus(): { enabled: boolean; known: boolean } {
  const { data, isFetched } = useQuery({
    queryKey: [...VOICE_CALLS_KEY, 'status'],
    queryFn: () => voiceCallsApi.status().then((r) => r.data.enabled),
    staleTime: 5 * 60_000,
    retry: false,
  })
  return { enabled: data === true, known: isFetched }
}

/** Whether AI calling is on for the user's org (cached; gates every AI Call button). */
export function useAICallsEnabled(): boolean {
  return useAICallsStatus().enabled
}

/**
 * "AI Calls" in the nav, with the number of calls a recruiter has to follow
 * up on. Recruiters and admins only, and only when the org has AI calls on.
 */
export function useAICallsNav(role: UserRole | undefined): AICallsNav | undefined {
  const allowed = role === 'recruiter' || role === 'admin'
  const enabled = useAICallsEnabled()
  const { data: needsAction } = useQuery({
    queryKey: [...VOICE_CALLS_KEY, 'list', 'needs_action', 'nav'],
    queryFn: () => voiceCallsApi.list('needs_action', 1).then((r) => r.data.counts.needs_action),
    enabled: allowed && enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  })
  return useMemo(
    () => (allowed && enabled ? { enabled: true, needsAction: needsAction ?? 0 } : undefined),
    [allowed, enabled, needsAction],
  )
}
