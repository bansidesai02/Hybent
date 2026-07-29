import { Routes, Route } from 'react-router-dom'
import React, { lazy } from 'react'

const PortalLayout = lazy(() => import('@/components/layout/PortalLayout').then(m => ({ default: m.PortalLayout })))
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
      <Route element={<PortalLayout />}>
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
