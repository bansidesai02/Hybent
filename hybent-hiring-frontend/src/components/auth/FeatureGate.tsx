import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import { useFeatures, type OrgFeatures } from '@/hooks/useFeatures'

/**
 * A page that only exists while a super admin has the feature on for the
 * organization. Switched off (even while the page is open: the websocket's
 * "features_updated" refreshes the features), it sends the user to their
 * workspace home. The API refuses the feature on its own either way.
 */
export function FeatureGate({ feature, children }: { feature: keyof OrgFeatures; children: ReactNode }) {
  const features = useFeatures()
  const { basePath } = useAuth()
  if (features && features[feature] === false) return <Navigate to={basePath} replace />
  return <>{children}</>
}
