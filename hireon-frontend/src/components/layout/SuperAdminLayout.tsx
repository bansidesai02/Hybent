import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuth } from '@/hooks/useAuth'
import { lazy, Suspense, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ImpersonationBanner } from '../common/ImpersonationBanner'

function ContentFallback() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-52 rounded-xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-24 rounded-2xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
        <div className="h-24 rounded-2xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
        <div className="h-24 rounded-2xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
      </div>
      <div className="h-80 rounded-2xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
    </div>
  )
}

export function SuperAdminLayout() {
  const { user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden recruiter-root" style={{ background: 'var(--bg)', fontFamily: "'Poppins', sans-serif" }}>

      {/* Sidebar Overlay for mobile */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      <Sidebar 
        role="super_admin" 
        mobileOpen={mobileMenuOpen} 
        setMobileOpen={setMobileMenuOpen} 
      />

      <div className="relative z-10 flex-1 flex flex-col overflow-hidden w-full">
        <ImpersonationBanner />
        <Topbar onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 overflow-y-auto p-3 md:p-6 lg:p-[28px_30px]">
          <div className="main-content-container">
            <Suspense fallback={<ContentFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
