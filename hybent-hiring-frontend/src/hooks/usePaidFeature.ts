import { useQuery } from '@tanstack/react-query'
import { trialApi } from '@/api/trial'

export const PAID_PLAN_MESSAGE = 'To access this feature, you’ll need to upgrade to one of our paid plans.'

/** True while the organization is on a free trial: paid-only features
 * (SMS, connecting a mailbox) show PAID_PLAN_MESSAGE instead of running. */
export function useIsTrial(): boolean {
  const { data } = useQuery({
    queryKey: ['trial-status'],
    queryFn: () => trialApi.status(),
    staleTime: 60_000,
  })
  return !!data?.is_trial
}
