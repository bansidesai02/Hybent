import { Routes, Route, Navigate } from 'react-router-dom'
import React, { lazy, Suspense } from 'react'
import { useAuthStore } from '@/store/authStore'
import { AlertTriangle } from 'lucide-react'

// Root Apps
import HiringApp from './apps/HiringApp'

const LandingPage = lazy(() => import('@/pages/landing/LandingPage'))

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
    window.location.href = '/hiring/login'
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
  return (
    <>
      <ForcedLogoutModal />
      
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Main Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Hiring Platform */}
          <Route path="/hiring/*" element={<HiringApp />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
