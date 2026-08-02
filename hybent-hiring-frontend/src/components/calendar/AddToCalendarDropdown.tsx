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
        className="inline-flex items-center gap-1.5 rounded-hb-sm border border-hb-border bg-hb-surface px-3 py-1.5 text-hb-xs font-semibold text-hb-text transition-colors duration-hb hover:bg-hb-surface-2"
      >
        <CalendarIcon size={12} className="text-hb-cyan" />
        Add to Calendar
        <ChevronDown size={10} className="opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 z-[100] mt-1.5 w-40 overflow-hidden rounded-hb-md border border-hb-border bg-hb-elevated shadow-hb-2">
          <a
            href={urls.google}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-3.5 py-2 text-hb-xs font-semibold text-hb-text transition-colors duration-hb hover:bg-hb-surface-2"
          >
            Google Calendar <ExternalLink size={10} className="opacity-40" />
          </a>
          <a
            href={urls.outlook}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between border-t border-hb-border px-3.5 py-2 text-hb-xs font-semibold text-hb-text transition-colors duration-hb hover:bg-hb-surface-2"
          >
            Outlook Calendar <ExternalLink size={10} className="opacity-40" />
          </a>
          <a
            href={urls.ics}
            download={`${interview.title || 'interview'}.ics`}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between border-t border-hb-border px-3.5 py-2 text-hb-xs font-semibold text-hb-text transition-colors duration-hb hover:bg-hb-surface-2"
          >
            iCal / ICS File <ExternalLink size={10} className="opacity-40" />
          </a>
        </div>
      )}
    </div>
  )
}
