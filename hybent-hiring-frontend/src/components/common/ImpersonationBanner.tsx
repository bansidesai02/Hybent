import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LogOut, ShieldAlert } from 'lucide-react'

export function ImpersonationBanner() {
  const { user, isImpersonating, exitImpersonation } = useAuth()

  if (!isImpersonating || !user) return null

  return (
    <div className="z-[9999] flex w-full items-center justify-between gap-4 border-b border-hb-warning/30 bg-hb-warning/10 px-4 py-2.5 backdrop-blur-md transition-all duration-300 animate-slide-down">
      <div className="flex items-center gap-3">
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hb-warning opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-hb-warning"></span>
        </div>
        <ShieldAlert size={16} className="text-hb-warning" />
        <p className="text-hb-sm font-semibold text-hb-text">
          You are currently impersonating <strong className="font-bold text-hb-text">{user.full_name}</strong> ({user.role}) from <strong className="font-bold text-hb-text">{user.organization_name || 'Organization'}</strong>.
        </p>
      </div>
      <button
        onClick={exitImpersonation}
        className="flex items-center gap-1.5 rounded-hb-sm bg-hb-grad px-3 py-1 text-hb-xs font-bold text-white shadow-hb-1 transition-all duration-hb hover:scale-[1.02] hover:shadow-hb-2 active:scale-95"
      >
        <LogOut size={13} />
        Exit Impersonation
      </button>
    </div>
  )
}
