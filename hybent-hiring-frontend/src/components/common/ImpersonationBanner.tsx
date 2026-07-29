import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LogOut, ShieldAlert } from 'lucide-react'

export function ImpersonationBanner() {
  const { user, isImpersonating, exitImpersonation } = useAuth()

  if (!isImpersonating || !user) return null

  return (
    <div 
      className="w-full flex items-center justify-between gap-4 px-4 py-2.5 z-[9999] transition-all duration-300 animate-slide-down"
      style={{
        background: 'linear-gradient(135deg, rgba(108, 71, 255, 0.15), rgba(255, 107, 198, 0.15))',
        borderBottom: '1px solid rgba(108, 71, 255, 0.25)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--violet)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--violet)]"></span>
        </div>
        <ShieldAlert size={16} className="text-[var(--violet)]" />
        <p className="text-[12.5px] font-semibold text-[var(--text)]">
          You are currently impersonating <strong className="text-[var(--violet)] font-bold">{user.full_name}</strong> ({user.role}) from <strong className="text-[var(--violet)] font-bold">{user.organization_name || 'Organization'}</strong>.
        </p>
      </div>
      <button
        onClick={exitImpersonation}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-bold text-white transition-all hover:scale-[1.02] active:scale-95 shadow-sm hover:shadow-md"
        style={{
          background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))',
          boxShadow: '0 4px 10px rgba(108, 71, 255, 0.25)',
        }}
      >
        <LogOut size={13} />
        Exit Impersonation
      </button>
    </div>
  )
}
