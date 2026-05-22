import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { GlobalChatOverlay } from '@/components/messaging/GlobalChatOverlay'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

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
        <Topbar onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-[28px_30px]">
          <div className="main-content-container">
            <Outlet />
          </div>
        </main>
      </div>
      <GlobalChatOverlay />
    </div>
  )
}
