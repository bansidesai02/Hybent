import { useState, useRef, useEffect, forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  error?: string
  options: Option[]
  value?: string
  onChange: (e: { target: { value: string, name?: string } }) => void
  name?: string
  className?: string
  containerClassName?: string
  placeholder?: string
  disabled?: boolean
}

/**
 * Custom Premium Select Component
 * Replaces native HTML selects with a luxury Glassmorphism UI.
 */
export const Select = forwardRef<HTMLDivElement, SelectProps>(
  ({ label, error, options, value, onChange, name, className, containerClassName, placeholder = 'Select option...', disabled }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Handle click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
      }
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    const selectedOption = options.find((opt) => opt.value === value)

    const handleSelect = (val: string) => {
      if (disabled) return
      onChange({ target: { value: val, name } })
      setIsOpen(false)
    }

    return (
      <div className={clsx('w-full space-y-1.5 relative', containerClassName)} ref={containerRef}>
        {label && (
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-[var(--text-light)] ml-1 opacity-80">
            {label}
          </label>
        )}

        <div className="relative">
          {/* Trigger Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className={clsx(
              'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left outline-none',
              'bg-white dark:bg-[var(--card-bg)] border border-gray-100 dark:border-[var(--card-border)]',
              'hover:border-[var(--violet)] hover:shadow-lg dark:hover:shadow-none shadow-sm',
              isOpen ? 'border-[var(--violet)] ring-4 ring-violet-500/10' : '',
              error ? 'border-red-400' : '',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              className // User-provided classes go here to override defaults
            )}
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <span className={clsx('text-[13px] font-semibold truncate', selectedOption ? 'text-[var(--text)]' : 'text-gray-400')}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 text-gray-400"
            >
              <ChevronDown size={16} />
            </motion.div>
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute z-[100] left-0 right-0 mt-2 p-1.5 rounded-2xl overflow-hidden overflow-y-auto max-h-[280px] custom-scrollbar"
                style={{
                  background: 'var(--card-bg)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid var(--card-border)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                }}
              >
                <div className="space-y-0.5">
                  {options.length === 0 ? (
                    <div className="px-4 py-3 text-center text-xs text-gray-400 italic">
                      No options available
                    </div>
                  ) : (
                    options.map((opt) => {
                      const isActive = opt.value === value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelect(opt.value)}
                          className={clsx(
                            'w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-left transition-all duration-150 group',
                            isActive 
                              ? 'bg-[var(--sb-active)] text-[var(--violet)] font-bold' 
                              : 'text-[var(--text-mid)] hover:bg-[var(--sb-hover)] hover:text-[var(--violet)]'
                          )}
                        >
                          <span className="text-[13px] flex-1 truncate">{opt.label}</span>
                          {isActive && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-1.5 h-1.5 rounded-full bg-[var(--violet)] shadow-[0_0_8px_var(--violet)]" 
                            />
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <motion.p 
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[11px] font-bold text-red-500 ml-1"
          >
            {error}
          </motion.p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
