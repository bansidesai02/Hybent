import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { CopilotSparkle } from '@/modules/recruiter/components/Copilot/CopilotSparkle'

/** Hybent's WhatsApp number (the Hybent AI bot answers there). */
const WHATSAPP_NUMBER = '918799029798'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hello! I'd like to know how Hybent can help us hire faster.")}`

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

const INSTAGRAM_URL = 'https://www.instagram.com/hybent__/'
const LINKEDIN_URL = 'https://www.linkedin.com/company/hybent/'

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" strokeWidth={2.1} strokeLinecap="round">
      <defs>
        <linearGradient id="hb-ig-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FEDA75" />
          <stop offset="0.3" stopColor="#FA7E1E" />
          <stop offset="0.55" stopColor="#D62976" />
          <stop offset="0.8" stopColor="#962FBF" />
          <stop offset="1" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="5.5" stroke="url(#hb-ig-grad)" />
      <circle cx="12" cy="12" r="4.2" stroke="url(#hb-ig-grad)" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="url(#hb-ig-grad)" stroke="none" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1.5" y="1.5" width="21" height="21" rx="4.5" fill="#0A66C2" />
      <path fill="#fff" d="M7.1 5.6a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM5.7 9.9h2.8v8.6H5.7V9.9Zm4.5 0h2.7v1.2h.04c.37-.7 1.29-1.44 2.66-1.44 2.84 0 3.37 1.87 3.37 4.3v4.54h-2.8v-4.02c0-.96-.02-2.2-1.34-2.2-1.34 0-1.55 1.05-1.55 2.13v4.09h-2.8V9.9Z" />
    </svg>
  )
}

const LINKS = [
  { href: INSTAGRAM_URL, label: 'Hybent on Instagram', Icon: InstagramIcon, size: 'h-[22px] w-[22px]', color: '', hover: 'hover:shadow-[0_12px_28px_-10px_rgba(214,41,118,0.55)]' },
  { href: WHATSAPP_URL, label: 'Chat with Hybent on WhatsApp', Icon: WhatsAppIcon, size: 'h-[22px] w-[22px]', color: 'text-[#25D366]', hover: 'hover:shadow-[0_12px_28px_-10px_rgba(37,211,102,0.6)]' },
  { href: LINKEDIN_URL, label: 'Hybent on LinkedIn', Icon: LinkedInIcon, size: 'h-[22px] w-[22px]', color: '', hover: 'hover:shadow-[0_12px_28px_-10px_rgba(10,102,194,0.55)]' },
]

/** Floating social dock on the marketing site: Instagram, WhatsApp and
 *  LinkedIn above a toggle button. Closed on load; the Copilot sparkle button opens them. */
export function WhatsAppButton() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-5 right-4 z-[60] flex flex-col items-center gap-3 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open &&
          LINKS.map(({ href, label, Icon, size, color, hover }, i) => (
            <motion.a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              initial={{ opacity: 0, y: 16, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: (LINKS.length - 1 - i) * 0.05 } }}
              exit={{ opacity: 0, y: 16, scale: 0.6, transition: { delay: i * 0.03 } }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-white ring-1 ring-slate-900/[0.06] shadow-[0_6px_18px_-8px_rgba(15,23,42,0.3)] transition-shadow duration-200 ${hover} ${color}`}
            >
              <Icon className={size} />
            </motion.a>
          ))}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Hide social links' : 'Show social links'}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-violet-500 text-white shadow-[0_12px_30px_-8px_rgba(59,130,246,0.7)]"
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
          <CopilotSparkle size={26} />
        </motion.span>
      </motion.button>
    </div>
  )
}
