import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { GlobalChatOverlay } from '../messaging/GlobalChatOverlay'
import { useWebSocket } from '@/hooks/useWebSocket'

export function InterviewerLayout() {
  useWebSocket()
  return (
    <div className="flex h-screen overflow-hidden interviewer-root" style={{ background: 'var(--bg)', fontFamily: "'Poppins', sans-serif" }}>
      <Sidebar role="interviewer" />
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <Topbar />
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
