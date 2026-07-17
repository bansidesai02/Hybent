import { Routes, Route, Navigate } from 'react-router-dom'
import React, { useState, useEffect, lazy, Suspense } from 'react'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types'
import { AlertTriangle } from 'lucide-react'

// Layouts (Lazy)
const RecruiterLayout = lazy(() => import('@/components/layout/RecruiterLayout').then(m => ({ default: m.RecruiterLayout })))
const InterviewerLayout = lazy(() => import('@/components/layout/InterviewerLayout').then(m => ({ default: m.InterviewerLayout })))
const PortalLayout = lazy(() => import('@/components/layout/PortalLayout').then(m => ({ default: m.PortalLayout })))

// Auth (Lazy)
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))

// Landing (Lazy)
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'))
const OnboardingPage = lazy(() => import('@/pages/candidate/OnboardingPage'))

// Recruiter pages (Lazy)
const OverviewPage = lazy(() => import('@/pages/recruiter/OverviewPage'))
const JobsListPage = lazy(() => import('@/pages/recruiter/JobsListPage'))
const AddJobPage = lazy(() => import('@/pages/recruiter/AddJobPage'))
const CandidatesPage = lazy(() => import('@/pages/recruiter/CandidatesPage'))
const PipelinePage = lazy(() => import('@/pages/recruiter/PipelinePage'))
const UploadResumePage = lazy(() => import('@/pages/recruiter/UploadResumePage'))
const InterviewsListPage = lazy(() => import('@/pages/recruiter/InterviewsListPage'))
const OffersPage = lazy(() => import('@/pages/recruiter/OffersPage'))
const AnalyticsPage = lazy(() => import('@/pages/recruiter/AnalyticsPage'))
const ReportsPage = lazy(() => import('@/pages/recruiter/ReportsPage'))
const TalentPoolPage = lazy(() => import('@/pages/recruiter/TalentPoolPage'))
const AllTalentListPage = lazy(() => import('@/pages/recruiter/AllTalentListPage'))
const RecruiterProfilePage = lazy(() => import('@/pages/recruiter/RecruiterProfilePage'))
const RecruiterSettingsPage = lazy(() => import('@/pages/recruiter/RecruiterSettingsPage'))
const PreScreeningReviewPage = lazy(() => import('@/pages/recruiter/PreScreeningReviewPage'))
const AICreditsPage = lazy(() => import('@/pages/recruiter/AICreditsPage'))

// Pre-screening (public — no auth)
const PreScreeningPage = lazy(() => import('@/pages/candidate/PreScreeningPage'))

// Interviewer pages (Lazy)
const InterviewerDashboard = lazy(() => import('@/pages/interviewer/InterviewerDashboard'))
const MyInterviewsPage = lazy(() => import('@/pages/interviewer/MyInterviewsPage'))
const ScorecardPage = lazy(() => import('@/pages/interviewer/ScorecardPage'))
const PrepKitPage = lazy(() => import('@/pages/interviewer/PrepKitPage'))
const LiveRoomPage = lazy(() => import('@/pages/interviewer/LiveRoomPage'))
const ScorecardHubPage = lazy(() => import('@/pages/interviewer/ScorecardHubPage'))
const PrepKitHubPage = lazy(() => import('@/pages/interviewer/PrepKitHubPage'))
const LiveRoomHubPage = lazy(() => import('@/pages/interviewer/LiveRoomHubPage'))
const InterviewerProfilePage = lazy(() => import('@/pages/interviewer/InterviewerProfilePage'))

// Portal pages (Lazy)
const PortalDashboard = lazy(() => import('@/pages/portal/PortalDashboard'))
const PortalApplicationsPage = lazy(() => import('@/pages/portal/PortalApplicationsPage'))
const PortalInterviewsPage = lazy(() => import('@/pages/portal/PortalInterviewsPage'))
const PortalOffersPage = lazy(() => import('@/pages/portal/PortalOffersPage'))
const PortalProfilePage = lazy(() => import('@/pages/portal/PortalProfilePage'))
const PortalPrepHub = lazy(() => import('@/pages/portal/PortalPrepHub'))
const PortalOpenings = lazy(() => import('@/pages/portal/PortalOpenings'))
const PortalNotifications = lazy(() => import('@/pages/portal/PortalNotifications'))
const PortalSettingsPage = lazy(() => import('@/pages/portal/PortalSettingsPage'))

// Admin pages (Lazy)
const TeamManagementPage = lazy(() => import('@/pages/admin/TeamManagementPage'))
const AuditLogsPage = lazy(() => import('@/pages/admin/AuditLogsPage'))
const AdminProfilePage = lazy(() => import('@/pages/admin/AdminProfilePage'))

// Super Admin pages (Lazy)
const SuperAdminLayout = lazy(() => import('@/components/layout/SuperAdminLayout').then(m => ({ default: m.SuperAdminLayout })))
const SuperAdminDashboard = lazy(() => import('@/pages/super_admin/DashboardPage'))
const SuperAdminAnalytics = lazy(() => import('@/pages/super_admin/AnalyticsPage'))
const SuperAdminClients = lazy(() => import('@/pages/super_admin/ClientsPage'))
const SuperAdminClientDetail = lazy(() => import('@/pages/super_admin/ClientDetailPage'))
const SuperAdminBilling = lazy(() => import('@/pages/super_admin/BillingPage'))
const SuperAdminUsers = lazy(() => import('@/pages/super_admin/UsersPage'))
const SuperAdminFlags = lazy(() => import('@/pages/super_admin/FeatureFlagsPage'))
const SuperAdminAudit = lazy(() => import('@/pages/super_admin/AuditLogsPage'))
const SuperAdminHealth = lazy(() => import('@/pages/super_admin/HealthPage'))
const SuperAdminSettings = lazy(() => import('@/pages/super_admin/SettingsPage'))

// ── Protected route wrapper ────────────────────────────────────────────────────
function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode
  roles?: UserRole[]
}) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && user && !roles.includes(user.role)) {
    // Redirect to appropriate home based on role
    if (user.role === 'super_admin') return <Navigate to="/super-admin" replace />
    if (user.role === 'candidate') return <Navigate to="/portal" replace />
    if (user.role === 'interviewer') return <Navigate to="/interviewer" replace />
    if (user.role === 'admin') return <Navigate to="/admin" replace />
    return <Navigate to="/recruiter" replace />
  }
  return <>{children}</>
}

import { Toaster } from 'react-hot-toast'

function RouteFallback() {
  return (
    <div className="p-4 md:p-6 lg:p-[28px_30px]">
      <div className="main-content-container space-y-4">
        <div className="h-8 w-48 rounded-xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-24 rounded-2xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
          <div className="h-24 rounded-2xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
          <div className="h-24 rounded-2xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
        </div>
        <div className="h-80 rounded-2xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
      </div>
    </div>
  )
}

function ForcedLogoutModal() {
  const { forcedLogoutReason, logout } = useAuthStore()

  if (!forcedLogoutReason) return null

  const handleDismiss = () => {
    logout()
    window.location.href = '/login'
  }

  const isDeleted = forcedLogoutReason === 'account_deleted'
  const title = isDeleted ? 'Account Removed' : 'Session Expired'
  const desc = isDeleted 
    ? 'You have been logged out because your account was deleted or deactivated by an administrator. Please contact your admin if this was a mistake.'
    : 'Your session has expired. Please sign in again.'
  const color = isDeleted ? '#ef4444' : '#f59e0b'
  const bgColor = isDeleted ? '#fee2e2' : '#fef3c7'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#fff', borderRadius: '24px', padding: '36px', width: '100%', maxWidth: '420px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.1)', textAlign: 'center', border: `1px solid ${color}`
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '32px', background: bgColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color
        }}>
          <AlertTriangle size={32} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1040', marginBottom: '12px' }}>
          {title}
        </h2>
        <p style={{ fontSize: '15px', color: '#6b6393', lineHeight: 1.6, marginBottom: '32px' }}>
          {desc}
        </p>
        <button
          onClick={handleDismiss}
          style={{
            background: color, color: '#fff', width: '100%', padding: '14px',
            borderRadius: '12px', fontWeight: 600, fontSize: '15px', cursor: 'pointer', border: 'none'
          }}
        >
          Sign In Again
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const coreRoutes = (
    <>
      <Route index element={<OverviewPage />} />
      <Route path="jobs" element={<JobsListPage />} />
      <Route path="jobs/new" element={<AddJobPage />} />
      <Route path="jobs/:id/edit" element={<AddJobPage />} />
      <Route path="candidates" element={<CandidatesPage />} />
      <Route path="pipeline" element={<PipelinePage />} />
      <Route path="upload" element={<UploadResumePage />} />
      <Route path="interviews" element={<InterviewsListPage />} />
      <Route path="offers" element={<OffersPage />} />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="talent-pool" element={<TalentPoolPage />} />
      <Route path="all-talent" element={<AllTalentListPage />} />
      <Route path="profile" element={<RecruiterProfilePage />} />
      <Route path="settings" element={<RecruiterSettingsPage />} />
      <Route path="teams" element={<TeamManagementPage />} />
      <Route path="pre-screening/:sessionId" element={<PreScreeningReviewPage />} />
      <Route path="ai-credits" element={<AICreditsPage />} />
    </>
  )

  return (
    <>
      <ForcedLogoutModal />
      <Toaster 
        position="top-right" 
        toastOptions={{ 
          duration: 4000,
          style: {
            background: '#ffffff',
            color: '#1a1040',
            borderRadius: '16px',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
            padding: '12px 24px',
            border: '1px solid #f1f0ff',
          },
          success: {
            iconTheme: {
              primary: '#6c47ff',
              secondary: '#ffffff',
            },
          },
        }} 
      />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/onboarding/:token" element={<OnboardingPage />} />
          <Route path="/pre-screening/:token" element={<PreScreeningPage />} />

          {/* Recruiter routes */}
          <Route
            path="/recruiter"
            element={
              <RequireAuth roles={['recruiter']}>
                <RecruiterLayout />
              </RequireAuth>
            }
          >
            {coreRoutes}
          </Route>

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <RequireAuth roles={['admin']}>
                <RecruiterLayout />
              </RequireAuth>
            }
          >
            {/* Admin-specific routes first - ensures /admin/profile hits AdminProfilePage */}
            <Route path="audit" element={<AuditLogsPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
            
            {/* Shared routes */}
            {coreRoutes}
          </Route>

          {/* Interviewer routes */}
          <Route
            path="/interviewer"
            element={
              <RequireAuth roles={['admin', 'recruiter', 'interviewer']}>
                <InterviewerLayout />
              </RequireAuth>
            }
          >
            <Route index element={<InterviewerDashboard />} />
            <Route path="interviews" element={<MyInterviewsPage />} />
            <Route path="scorecard-hub" element={<ScorecardHubPage />} />
            <Route path="prep-kit-hub" element={<PrepKitHubPage />} />
            <Route path="live-room-hub" element={<LiveRoomHubPage />} />
            <Route path="scorecard/:interviewId" element={<ScorecardPage />} />
            <Route path="prep-kit/:interviewId" element={<PrepKitPage />} />
            <Route path="live-room/:interviewId" element={<LiveRoomPage />} />
            <Route path="profile" element={<InterviewerProfilePage />} />
          </Route>

          {/* Candidate portal routes */}
          <Route
            path="/portal"
            element={
              <RequireAuth roles={['candidate']}>
                <PortalLayout />
              </RequireAuth>
            }
          >
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

          {/* Super Admin routes */}
          <Route
            path="/super-admin"
            element={
              <RequireAuth roles={['super_admin']}>
                <SuperAdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<SuperAdminDashboard />} />
            <Route path="analytics" element={<SuperAdminAnalytics />} />
            <Route path="clients" element={<SuperAdminClients />} />
            <Route path="clients/:id" element={<SuperAdminClientDetail />} />
            <Route path="billing" element={<SuperAdminBilling />} />
            <Route path="users" element={<SuperAdminUsers />} />
            <Route path="flags" element={<SuperAdminFlags />} />
            <Route path="audit" element={<SuperAdminAudit />} />
            <Route path="health" element={<SuperAdminHealth />} />
            <Route path="settings" element={<SuperAdminSettings />} />
            <Route path="profile" element={<AdminProfilePage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

