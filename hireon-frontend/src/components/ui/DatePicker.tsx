import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
  placeholder?: string
  className?: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, placeholder = 'Select date', className }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Internal state for calendar navigation
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value)
    return new Date()
  })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const selectedDate = value ? new Date(value) : null
  const isSelected = (d: number) => {
    if (!selectedDate) return false
    return selectedDate.getFullYear() === year && 
           selectedDate.getMonth() === month && 
           selectedDate.getDate() === d
  }

  const handleDateClick = (day: number) => {
    // Construct local date string to avoid timezone shifts
    const d = new Date(year, month, day)
    const yearStr = d.getFullYear()
    const monthStr = String(d.getMonth() + 1).padStart(2, '0')
    const dayStr = String(d.getDate()).padStart(2, '0')
    onChange(`${yearStr}-${monthStr}-${dayStr}`)
    setIsOpen(false)
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  return (
    <div className={clsx('relative w-full', className)} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-base flex items-center justify-between px-3 py-2 text-sm text-left truncate"
        style={{ borderRadius: 12 }}
      >
        <span className={clsx(!value && 'text-gray-400 font-medium')}>
          {value ? new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : placeholder}
        </span>
        <svg style={{ width: 14, height: 14, opacity: 0.5 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Calendar Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            style={{ 
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, 
              zIndex: 100, width: 280, padding: 20,
              background: '#fff', borderRadius: 24,
              boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
              border: '1px solid rgba(0,0,0,0.05)'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h4 className="text-[17px] font-black text-gray-900">{MONTHS[month]} {year}</h4>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 text-center mb-2">
              {DAYS_SHORT.map(d => (
                <span key={d} className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const active = isSelected(day)
                return (
                  <button
                    key={day}
                    onClick={() => handleDateClick(day)}
                    className={clsx(
                      'aspect-square flex items-center justify-center text-[13px] font-bold rounded-xl transition-all',
                      active ? 'bg-[#f0edff] text-[#6c47ff] border-2 border-[#6c47ff]' : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-top border-gray-50 flex justify-between">
              <button 
                onClick={() => { onChange(''); setIsOpen(false) }}
                className="text-[11px] font-extrabold text-red-500 uppercase tracking-wider hover:opacity-70"
              >
                Clear
              </button>
              <button 
                onClick={() => { 
                  const d = new Date()
                  handleDateClick(d.getDate()) 
                }}
                className="text-[11px] font-extrabold text-[#6c47ff] uppercase tracking-wider hover:opacity-70"
              >
                Today
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
