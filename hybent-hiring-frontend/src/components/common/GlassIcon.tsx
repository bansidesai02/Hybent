import React from 'react'
import { clsx } from 'clsx'
import * as LucideIcons from 'lucide-react'

export type GlassVariant = 'violet' | 'teal' | 'pink' | 'amber' | 'blue' | 'emerald' | 'rose' | 'indigo' | 'gray'

interface GlassIconProps {
  icon: keyof typeof LucideIcons | React.ReactNode
  variant?: GlassVariant
  size?: number
  iconSize?: number
  className?: string
  glow?: boolean
  rounded?: string // e.g. "12px" or "50%"
  ghost?: boolean
}

const VARIANTS: Record<GlassVariant, { bg: string; color: string; border: string; glow: string }> = {
  violet: { 
    bg: 'rgba(108, 71, 255, 0.08)', 
    color: '#8b5cf6', 
    border: 'rgba(108, 71, 255, 0.2)', 
    glow: 'rgba(108, 71, 255, 0.3)' 
  },
  teal: { 
    bg: 'rgba(0, 212, 200, 0.08)', 
    color: '#00d4c8', 
    border: 'rgba(0, 212, 200, 0.2)', 
    glow: 'rgba(0, 212, 200, 0.3)' 
  },
  pink: { 
    bg: 'rgba(255, 107, 198, 0.08)', 
    color: '#ff6bc6', 
    border: 'rgba(255, 107, 198, 0.2)', 
    glow: 'rgba(255, 107, 198, 0.3)' 
  },
  amber: { 
    bg: 'rgba(251, 191, 36, 0.08)', 
    color: '#f59e0b', 
    border: 'rgba(251, 191, 36, 0.2)', 
    glow: 'rgba(251, 191, 36, 0.3)' 
  },
  blue: { 
    bg: 'rgba(59, 130, 246, 0.08)', 
    color: '#3b82f6', 
    border: 'rgba(59, 130, 246, 0.2)', 
    glow: 'rgba(59, 130, 246, 0.3)' 
  },
  emerald: { 
    bg: 'rgba(16, 185, 129, 0.08)', 
    color: '#10b981', 
    border: 'rgba(16, 185, 129, 0.2)', 
    glow: 'rgba(16, 185, 129, 0.3)' 
  },
  rose: { 
    bg: 'rgba(244, 63, 94, 0.08)', 
    color: '#f43f5e', 
    border: 'rgba(244, 63, 94, 0.2)', 
    glow: 'rgba(244, 63, 94, 0.3)' 
  },
  indigo: { 
    bg: 'rgba(99, 102, 241, 0.08)', 
    color: '#6366f1', 
    border: 'rgba(99, 102, 241, 0.2)', 
    glow: 'rgba(99, 102, 241, 0.3)' 
  },
  gray: { 
    bg: 'rgba(148, 163, 184, 0.06)', 
    color: '#94a3b8', 
    border: 'rgba(148, 163, 184, 0.15)', 
    glow: 'rgba(148, 163, 184, 0.1)' 
  },
}

export function GlassIcon({ 
  icon, 
  variant = 'violet', 
  size = 40, 
  iconSize = 18,
  className, 
  glow = true,
  rounded = '12px',
  ghost = false
}: GlassIconProps) {
  const v = VARIANTS[variant] || VARIANTS.violet
  
  const finalIconSize = ghost ? (iconSize + 2) : iconSize // Boost size slightly when naked

  const renderIcon = () => {
    if (typeof icon === 'string' && icon in LucideIcons) {
      const Icon = (LucideIcons as any)[icon]
      return <Icon size={finalIconSize} color={v.color} strokeWidth={ghost ? 2.2 : 2.5} style={{ filter: (glow && !ghost) ? `drop-shadow(0 0 8px ${v.glow})` : 'none' }} />
    }
    return icon
  }

  return (
    <div 
      className={clsx(
        'flex items-center justify-center flex-shrink-0 transition-all duration-300',
        className
      )}
      style={{
        width: ghost ? 'auto' : size,
        height: ghost ? 'auto' : size,
        background: ghost ? 'transparent' : v.bg,
        border: ghost ? 'none' : `1.5px solid ${v.border}`,
        borderRadius: rounded,
        backdropFilter: ghost ? 'none' : 'blur(8px)',
        WebkitBackdropFilter: ghost ? 'none' : 'blur(8px)',
        boxShadow: (glow && !ghost) ? `0 4px 12px ${v.glow}` : 'none',
        color: v.color // Fix inheritance for currentColor in custom icons
      }}
    >
      {renderIcon()}
    </div>
  )
}
