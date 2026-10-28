import { useQuery } from '@tanstack/react-query'

import api from '@/api/axios'
import { useAuthStore } from '@/store/authStore'

/** The switches a super admin sets per client (Super Admin → Feature flags). */
export interface OrgFeatures {
  ai: boolean
  bulk: boolean
  analytics: boolean
  copilot: boolean
  ai_calls: boolean
  /** The consumption history log on the AI Credits page. */
  usage_logs?: boolean
}

/**
 * The signed-in user's organization features. Undefined while loading, so
 * callers treat a feature as available until the API says it's off; the API
 * refuses switched-off features on its own either way.
 */
export function useFeatures(): OrgFeatures | undefined {
  const user = useAuthStore((s) => s.user)
  const enabled = !!user && user.role !== 'super_admin'
  const { data } = useQuery({
    queryKey: ['org-features', user?.id],
    queryFn: () => api.get<OrgFeatures>('/v1/auth/features', { skipLoader: true }).then((r) => r.data),
    enabled,
    // A super admin can switch features at any time: re-check whenever the
    // tab regains focus, and the websocket pushes "features_updated" too.
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
  return enabled ? data : undefined
}
