import { useState, useRef, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronDown, ExternalLink } from 'lucide-react'
import { getCalendarUrls } from '@/utils/calendar'

export interface AddToCalendarDropdownProps {
  interview: {
    title: string
    scheduled_at: string
    duration_minutes: number
    meeting_link?: string | null
    notes?: string | null
    candidate_name?: string | null
  }
}

export function AddToCalendarDropdown({ interview }: AddToCalendarDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const urls = getCalendarUrls(interview)

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2a2550] bg-white dark:bg-[#1a1730] text-[11px] font-bold text-gray-700 dark:text-[#ede9ff] hover:bg-gray-50 dark:hover:bg-[#201c3b] transition-colors"
      >
        <CalendarIcon size={12} className="text-violet-500" />
        Add to Calendar
        <ChevronDown size={10} className="opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-40 rounded-xl bg-white dark:bg-[#1a1730] border border-gray-100 dark:border-[#2a2550] shadow-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <a
            href={urls.google}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-3.5 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-950/20 font-semibold transition-colors"
          >
            Google Calendar <ExternalLink size={10} className="opacity-40" />
          </a>
          <a
            href={urls.outlook}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-3.5 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-950/20 font-semibold border-t border-gray-50 dark:border-[#201c3b] transition-colors"
          >
            Outlook Calendar <ExternalLink size={10} className="opacity-40" />
          </a>
          <a
            href={urls.ics}
            download={`${interview.title || 'interview'}.ics`}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-3.5 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-950/20 font-semibold border-t border-gray-50 dark:border-[#201c3b] transition-colors"
          >
            iCal / ICS File <ExternalLink size={10} className="opacity-40" />
          </a>
        </div>
      )}
    </div>
  )
}
