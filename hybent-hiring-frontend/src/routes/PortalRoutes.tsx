import { Routes, Route } from 'react-router-dom'
import { lazy } from 'react'

/* Phase 10: the Hybent shell is the only shell. */
const Shell = lazy(() => import('@/components/layout/shell/PortalShell').then(m => ({ default: m.PortalShell })))
const PortalDashboard = lazy(() => import('@/modules/portal/pages/PortalDashboard'))
const PortalApplicationsPage = lazy(() => import('@/modules/portal/pages/PortalApplicationsPage'))
const PortalInterviewsPage = lazy(() => import('@/modules/portal/pages/PortalInterviewsPage'))
const PortalOffersPage = lazy(() => import('@/modules/portal/pages/PortalOffersPage'))
const PortalProfilePage = lazy(() => import('@/modules/portal/pages/PortalProfilePage'))
const PortalPrepHub = lazy(() => import('@/modules/portal/pages/PortalPrepHub'))
const PortalOpenings = lazy(() => import('@/modules/portal/pages/PortalOpenings'))
const PortalNotifications = lazy(() => import('@/modules/portal/pages/PortalNotifications'))
const PortalSettingsPage = lazy(() => import('@/modules/portal/pages/PortalSettingsPage'))

export default function PortalRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<PortalDashboard />} />
        <Route path="applications" element={<PortalApplicationsPage />} />
        <Route path="interviews" element={<PortalInterviewsPage />} />
        <Route path="offers" element={<PortalOffersPage />} />
        <Route path="profile" element={<PortalProfilePage />} />
        <Route path="prep" element={<PortalPrepHub />} />
        <Route path="openings" element={<PortalOpenings />} />
        <Route path="notifications" element={<PortalNotifications />} />
        <Route path="settings" element={<PortalSettingsPage />} />
      </Route>
    </Routes>
  )
}
