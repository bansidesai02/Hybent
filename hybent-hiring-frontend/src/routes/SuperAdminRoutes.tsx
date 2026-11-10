import { Navigate, Routes, Route } from 'react-router-dom'
import { lazy } from 'react'

import HubPage from '@/modules/super_admin/components/HubPage'
import { useSuperAdminTodo } from '@/hooks/useSuperAdminTodo'

/* Phase 10: the Hybent shell is the only shell. */
const Shell = lazy(() => import('@/components/layout/shell/AppShell').then(m => ({ default: m.SuperAdminShell })))
const SuperAdminDashboard = lazy(() => import('@/modules/super_admin/pages/DashboardPage'))
const SuperAdminAnalytics = lazy(() => import('@/modules/super_admin/pages/AnalyticsPage'))
const SuperAdminClients = lazy(() => import('@/modules/super_admin/pages/ClientsPage'))
const SuperAdminClientDetail = lazy(() => import('@/modules/super_admin/pages/ClientDetailPage'))
const SuperAdminBilling = lazy(() => import('@/modules/super_admin/pages/BillingPage'))
const SuperAdminAICredits = lazy(() => import('@/modules/super_admin/pages/AICreditsPage'))
const SuperAdminTrials = lazy(() => import('@/modules/super_admin/pages/TrialRequestsPage'))
const SuperAdminUsers = lazy(() => import('@/modules/super_admin/pages/UsersPage'))
const SuperAdminFlags = lazy(() => import('@/modules/super_admin/pages/FeatureFlagsPage'))
const SuperAdminAudit = lazy(() => import('@/modules/super_admin/pages/AuditLogsPage'))
const SuperAdminHealth = lazy(() => import('@/modules/super_admin/pages/HealthPage'))
const SuperAdminDemoRequests = lazy(() => import('@/modules/super_admin/pages/DemoRequestsPage'))
const SuperAdminDemoBookings = lazy(() => import('@/modules/super_admin/pages/DemoBookingsPage'))
const SuperAdminOperations = lazy(() => import('@/modules/super_admin/pages/OperationsPage'))
const SuperAdminContactMessages = lazy(() => import('@/modules/super_admin/pages/ContactMessagesPage'))
const SuperAdminAnnouncements = lazy(() => import('@/modules/super_admin/pages/AnnouncementsPage'))
const SuperAdminSupportSessions = lazy(() => import('@/modules/super_admin/pages/SupportSessionsPage'))
const SuperAdminSettings = lazy(() => import('@/modules/super_admin/pages/SettingsPage'))
const AdminProfilePage = lazy(() => import('@/modules/admin/pages/AdminProfilePage'))
const InboxPage = lazy(() => import('@/modules/recruiter/pages/InboxPage'))

const SA = '/hiring/super-admin'

/** Old page addresses (notifications, emails, bookmarks) land on their tab. */
const MOVED: Array<[string, string]> = [
  ['analytics', '?tab=analytics'],
  ['trials', 'leads'],
  ['demos', 'leads?tab=demos'],
  ['demo-requests', 'leads?tab=demo-requests'],
  ['contact-messages', 'leads?tab=contact'],
  ['ai-credits', 'billing?tab=credits'],
  ['support-sessions', 'users?tab=sessions'],
  ['operations', 'system'],
  ['health', 'system?tab=health'],
  ['audit', 'system?tab=audit'],
  ['flags', 'settings?tab=flags'],
  ['announcements', 'settings?tab=announcements'],
]

function Hubs() {
  const { data: t } = useSuperAdminTodo()
  return {
    dashboard: (
      <HubPage
        label="Dashboard"
        tabs={[
          { value: 'overview', label: 'Overview', element: <SuperAdminDashboard /> },
          { value: 'analytics', label: 'Analytics', element: <SuperAdminAnalytics /> },
        ]}
      />
    ),
    leads: (
      <HubPage
        label="Leads"
        tabs={[
          { value: 'trials', label: 'Free trials', count: t?.trials_pending, element: <SuperAdminTrials /> },
          { value: 'demos', label: 'Demo bookings', count: t?.demos_upcoming, element: <SuperAdminDemoBookings /> },
          { value: 'demo-requests', label: 'Demo requests', count: t?.demo_requests_new, element: <SuperAdminDemoRequests /> },
          { value: 'contact', label: 'Contact messages', count: t?.contact_new, element: <SuperAdminContactMessages /> },
        ]}
      />
    ),
    billing: (
      <HubPage
        label="Billing"
        tabs={[
          { value: 'plans', label: 'Plans & payments', element: <SuperAdminBilling /> },
          { value: 'credits', label: 'AI credits', element: <SuperAdminAICredits /> },
        ]}
      />
    ),
    users: (
      <HubPage
        label="Users"
        tabs={[
          { value: 'all', label: 'All users', element: <SuperAdminUsers /> },
          { value: 'sessions', label: 'Support sessions', count: t?.sessions_active, element: <SuperAdminSupportSessions /> },
        ]}
      />
    ),
    system: (
      <HubPage
        label="System"
        tabs={[
          { value: 'problems', label: 'Problems', count: t?.system, element: <SuperAdminOperations /> },
          { value: 'health', label: 'Health', element: <SuperAdminHealth /> },
          { value: 'audit', label: 'Audit logs', element: <SuperAdminAudit /> },
        ]}
      />
    ),
    settings: (
      <HubPage
        label="Settings"
        tabs={[
          { value: 'general', label: 'General', element: <SuperAdminSettings /> },
          { value: 'flags', label: 'Feature flags', element: <SuperAdminFlags /> },
          { value: 'announcements', label: 'Announcements', element: <SuperAdminAnnouncements /> },
        ]}
      />
    ),
  }
}

export default function SuperAdminRoutes() {
  const hubs = Hubs()
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={hubs.dashboard} />
        <Route path="leads" element={hubs.leads} />
        <Route path="clients" element={<SuperAdminClients />} />
        <Route path="clients/:id" element={<SuperAdminClientDetail />} />
        <Route path="billing" element={hubs.billing} />
        <Route path="users" element={hubs.users} />
        <Route path="system" element={hubs.system} />
        <Route path="settings" element={hubs.settings} />
        <Route path="profile" element={<AdminProfilePage />} />
        <Route path="inbox" element={<InboxPage />} />
        {MOVED.map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={`${SA}/${to}`} replace />} />
        ))}
      </Route>
    </Routes>
  )
}
