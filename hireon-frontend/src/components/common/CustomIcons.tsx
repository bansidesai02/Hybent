import React from 'react'

interface IconProps {
  size?: number | string
  className?: string
  strokeWidth?: number
}

/**
 * TeamIcon - A premium, chunky 3-person group icon.
 * Designed to represent internal teams and collaborative environments.
 */
export const TeamIcon: React.FC<IconProps> = ({ 
  size = 24, 
  className = '', 
  strokeWidth = 2.5 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={strokeWidth} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {/* Heads */}
      <circle cx="12" cy="7" r="4" />
      <circle cx="5" cy="11" r="3" />
      <circle cx="19" cy="11" r="3" />
      
      {/* Bodies / Shoulders */}
      <path d="M17 21v-2a4 4 0 0 0-4-4H11a4 4 0 0 0-4 4v2" />
      <path d="M2 21v-2a4 4 0 0 1 4-4" />
      <path d="M22 21v-2a4 4 0 0 0-4-4" />
    </svg>
  )
}
