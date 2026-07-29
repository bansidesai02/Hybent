import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface CustomSelectProps {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}

export default function CustomSelect({ label, value, options, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      <label className="text-[12px] font-bold uppercase tracking-[0.5px] ml-1" style={{ color: 'var(--text-light)' }}>
        {label}
      </label>
      
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 rounded-[12px] border-none text-[15px] transition-all outline-none flex items-center justify-between text-left group"
        style={{ 
          background: 'white', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)', 
          color: 'var(--text)',
          cursor: 'pointer'
        }}
      >
        <span className="font-medium">{value}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="text-[12px] opacity-40 group-hover:opacity-100 transition-opacity"
        >
          ▼
        </motion.span>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-[300] left-0 right-0 mt-2 p-2 rounded-[16px] overflow-hidden"
            style={{ 
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.95)',
              boxShadow: '0 10px 40px rgba(108, 71, 255, 0.12)',
            }}
          >
            <div className="flex flex-col gap-0.5">
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setIsOpen(false)
                  }}
                  className="w-full text-left px-4 py-3 rounded-[10px] text-[14px] font-medium transition-all"
                  style={{ 
                    color: opt === value ? '#6c47ff' : 'var(--text-mid)',
                    background: opt === value ? 'rgba(108, 71, 255, 0.08)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (opt !== value) e.currentTarget.style.background = 'rgba(108, 71, 255, 0.04)'
                  }}
                  onMouseLeave={(e) => {
                    if (opt !== value) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
