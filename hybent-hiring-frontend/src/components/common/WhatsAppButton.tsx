import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

/** Hybent's WhatsApp number (the Hybent AI bot answers there). */
const WHATSAPP_NUMBER = '918799029798'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hello! I'd like to know how Hybent can help us hire faster.")}`
const BUBBLE_KEY = 'hb-wa-bubble-dismissed'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="currentColor">
      <path d="M16.04 3C9.4 3 4 8.36 4 14.97c0 2.11.56 4.17 1.62 5.99L4 29l8.27-2.16a12.1 12.1 0 0 0 3.77.6h.01C22.67 27.44 28 22.08 28 15.47 28 8.86 22.68 3 16.04 3Zm0 22.4h-.01a10.1 10.1 0 0 1-3.4-.6l-.24-.09-4.9 1.28 1.31-4.77-.16-.25a9.9 9.9 0 0 1-1.55-5.3c0-5.5 4.5-9.96 10.04-9.96 5.53 0 9.9 4.75 9.9 10.25 0 5.5-4.45 9.44-10 9.44Zm5.5-7.45c-.3-.15-1.78-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.46-2.42-1.48-.9-.79-1.5-1.77-1.67-2.07-.18-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.57-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.08 1.78-.72 2.03-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35Z" />
    </svg>
  )
}

/** Floating "Chat on WhatsApp" button on the marketing site. */
export function WhatsAppButton() {
  const [bubble, setBubble] = useState(false)

  useEffect(() => {
    let dismissed = false
    try { dismissed = sessionStorage.getItem(BUBBLE_KEY) === '1' } catch { /* ignore */ }
    if (dismissed) return
    const t = window.setTimeout(() => setBubble(true), 2500)
    return () => window.clearTimeout(t)
  }, [])

  const closeBubble = () => {
    setBubble(false)
    try { sessionStorage.setItem(BUBBLE_KEY, '1') } catch { /* ignore */ }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex items-end gap-3 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {bubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="relative mb-2 hidden w-[280px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_-16px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.06)] sm:block"
          >
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#075E54] to-[#128C7E] px-4 py-3 text-white">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold ring-1 ring-white/30">
                H
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#25D366] ring-2 ring-[#0b6b5f]" aria-hidden />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-sm font-semibold">Hybent Team</span>
                <span className="block text-[11px] text-white/75">Online · replies in seconds</span>
              </span>
              <button
                type="button"
                onClick={closeBubble}
                aria-label="Dismiss"
                className="ml-auto rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <div className="bg-[#efeae2] px-4 py-3">
              <div className="relative max-w-[92%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[13px] leading-snug text-slate-700 shadow-sm">
                Hiring for a role? 👋 Ask us anything about Hybent, from pricing to a quick demo.
                <span className="mt-1 block text-right text-[10px] text-slate-400">now</span>
              </div>
            </div>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeBubble}
              className="flex items-center justify-center gap-2 bg-white px-4 py-2.5 text-sm font-semibold text-[#128C7E] hover:bg-slate-50"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Start chat
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={closeBubble}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        aria-label="Chat with Hybent on WhatsApp"
        title="Chat on WhatsApp"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_28px_-6px_rgba(37,211,102,0.6)]"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-25" aria-hidden />
        <WhatsAppIcon className="relative h-8 w-8" />
      </motion.a>
    </div>
  )
}
