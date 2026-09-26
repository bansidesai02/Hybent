import { Routes, Route } from 'react-router-dom'
import { lazy } from 'react'

/* Phase 10: the Hybent shell is the only shell. */
const Shell = lazy(() => import('@/components/layout/shell/AppShell').then(m => ({ default: m.SuperAdminShell })))
const SuperAdminDashboard = lazy(() => import('@/modules/super_admin/pages/DashboardPage'))
const SuperAdminAnalytics = lazy(() => import('@/modules/super_admin/pages/AnalyticsPage'))
const SuperAdminClients = lazy(() => import('@/modules/super_admin/pages/ClientsPage'))
const SuperAdminClientDetail = lazy(() => import('@/modules/super_admin/pages/ClientDetailPage'))
const SuperAdminBilling = lazy(() => import('@/modules/super_admin/pages/BillingPage'))
const SuperAdminAICredits = lazy(() => import('@/modules/super_admin/pages/AICreditsPage'))
const SuperAdminUsers = lazy(() => import('@/modules/super_admin/pages/UsersPage'))
const SuperAdminFlags = lazy(() => import('@/modules/super_admin/pages/FeatureFlagsPage'))
const SuperAdminAudit = lazy(() => import('@/modules/super_admin/pages/AuditLogsPage'))
const SuperAdminHealth = lazy(() => import('@/modules/super_admin/pages/HealthPage'))
const SuperAdminSettings = lazy(() => import('@/modules/super_admin/pages/SettingsPage'))
const AdminProfilePage = lazy(() => import('@/modules/admin/pages/AdminProfilePage'))
const InboxPage = lazy(() => import('@/modules/recruiter/pages/InboxPage'))

export default function SuperAdminRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<SuperAdminDashboard />} />
        <Route path="analytics" element={<SuperAdminAnalytics />} />
        <Route path="clients" element={<SuperAdminClients />} />
        <Route path="clients/:id" element={<SuperAdminClientDetail />} />
        <Route path="billing" element={<SuperAdminBilling />} />
        <Route path="ai-credits" element={<SuperAdminAICredits />} />
        <Route path="users" element={<SuperAdminUsers />} />
        <Route path="flags" element={<SuperAdminFlags />} />
        <Route path="audit" element={<SuperAdminAudit />} />
        <Route path="health" element={<SuperAdminHealth />} />
        <Route path="settings" element={<SuperAdminSettings />} />
        <Route path="profile" element={<AdminProfilePage />} />
        <Route path="inbox" element={<InboxPage />} />
      </Route>
    </Routes>
  )
}
