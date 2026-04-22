import { clsx } from 'clsx'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-2xl',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const colors = [
  'bg-violet-500', 'bg-pink-500', 'bg-teal-500',
  'bg-amber-500', 'bg-blue-500', 'bg-emerald-500',
]

function getColor(name: string) {
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  // Use professional placeholder if no src is provided
  const avatarUrl = src || `https://i.pravatar.cc/150?u=${encodeURIComponent(name)}`

  return (
    <img
      src={avatarUrl}
      alt={name}
      className={clsx('rounded-full object-cover flex-shrink-0 bg-gray-100', sizes[size], className)}
      onError={(e) => {
        // Fallback to initials if image fails to load
        e.currentTarget.style.display = 'none'
        const parent = e.currentTarget.parentElement
        if (parent) {
          const initials = document.createElement('div')
          initials.className = clsx(
            'rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0',
            sizes[size],
            getColor(name),
            className
          )
          initials.innerText = getInitials(name)
          parent.appendChild(initials)
        }
      }}
    />
  )
}
