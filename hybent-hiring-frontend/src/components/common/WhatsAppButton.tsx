import { motion } from 'framer-motion'

/** Hybent's WhatsApp number (the Hybent AI bot answers there). */
const WHATSAPP_NUMBER = '918799029798'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hello! I'd like to know how Hybent can help us hire faster.")}`

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="currentColor">
      <path d="M16.04 3C9.4 3 4 8.36 4 14.97c0 2.11.56 4.17 1.62 5.99L4 29l8.27-2.16a12.1 12.1 0 0 0 3.77.6h.01C22.67 27.44 28 22.08 28 15.47 28 8.86 22.68 3 16.04 3Zm0 22.4h-.01a10.1 10.1 0 0 1-3.4-.6l-.24-.09-4.9 1.28 1.31-4.77-.16-.25a9.9 9.9 0 0 1-1.55-5.3c0-5.5 4.5-9.96 10.04-9.96 5.53 0 9.9 4.75 9.9 10.25 0 5.5-4.45 9.44-10 9.44Zm5.5-7.45c-.3-.15-1.78-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.46-2.42-1.48-.9-.79-1.5-1.77-1.67-2.07-.18-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.57-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.08 1.78-.72 2.03-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35Z" />
    </svg>
  )
}

/** Floating "Chat on WhatsApp" button on the marketing site. */
export function WhatsAppButton() {
  return (
    <div className="fixed bottom-5 right-5 z-[60] sm:bottom-6 sm:right-6">
      <motion.a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
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
