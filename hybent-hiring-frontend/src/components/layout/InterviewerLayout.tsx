import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useWebSocket } from '@/hooks/useWebSocket'
import { lazy, Suspense, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { ImpersonationBanner } from '../common/ImpersonationBanner'

const GlobalChatOverlay = lazy(() => import('@/components/messaging/GlobalChatOverlay').then((m) => ({ default: m.GlobalChatOverlay })))

function ContentFallback() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-52 rounded-xl bg-[var(--kpi-bg)] animate-pulse" />
      <div className="h-80 rounded-2xl bg-[var(--kpi-bg)] animate-pulse" />
    </div>
  )
}

export function InterviewerLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  useWebSocket()
  return (
    <div className="flex h-screen overflow-hidden interviewer-root" style={{ background: 'var(--bg)', fontFamily: "'Poppins', sans-serif" }}>
      
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

      <Sidebar role="interviewer" mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <ImpersonationBanner />
        <Topbar onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-[28px_30px]">
          <div className="main-content-container">
            <Suspense fallback={<ContentFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <Suspense fallback={null}>
        <GlobalChatOverlay />
      </Suspense>
    </div>
  )
}
