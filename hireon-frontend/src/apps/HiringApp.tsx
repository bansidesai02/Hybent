import { Routes, Route, Navigate } from 'react-router-dom'
import React, { lazy, Suspense } from 'react'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types'
import { Toaster } from 'react-hot-toast'

// Module Routes
import RecruiterRoutes from '../routes/RecruiterRoutes'
import AdminRoutes from '../routes/AdminRoutes'
import InterviewerRoutes from '../routes/InterviewerRoutes'
import PortalRoutes from '../routes/PortalRoutes'
import SuperAdminRoutes from '../routes/SuperAdminRoutes'

// Public & Auth (Lazy)
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'))
const OnboardingPage = lazy(() => import('@/pages/candidate/OnboardingPage'))
const PreScreeningPage = lazy(() => import('@/pages/candidate/PreScreeningPage'))

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

function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode
  roles?: UserRole[]
}) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/hiring/login" replace />
  if (roles && user && !roles.includes(user.role)) {
    if (user.role === 'super_admin') return <Navigate to="/hiring/super-admin" replace />
    if (user.role === 'candidate') return <Navigate to="/hiring/portal" replace />
    if (user.role === 'interviewer') return <Navigate to="/hiring/interviewer" replace />
    if (user.role === 'admin') return <Navigate to="/hiring/admin" replace />
    return <Navigate to="/hiring/recruiter" replace />
  }
  return <>{children}</>
}

export default function HiringApp() {
  return (
    <>
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

          {/* Module routes */}
          <Route path="/recruiter/*" element={<RequireAuth roles={['recruiter']}><RecruiterRoutes /></RequireAuth>} />
          <Route path="/admin/*" element={<RequireAuth roles={['admin']}><AdminRoutes /></RequireAuth>} />
          <Route path="/interviewer/*" element={<RequireAuth roles={['admin', 'recruiter', 'interviewer']}><InterviewerRoutes /></RequireAuth>} />
          <Route path="/portal/*" element={<RequireAuth roles={['candidate']}><PortalRoutes /></RequireAuth>} />
          <Route path="/super-admin/*" element={<RequireAuth roles={['super_admin']}><SuperAdminRoutes /></RequireAuth>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/hiring" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
