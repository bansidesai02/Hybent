import { useEffect, useState, type ReactNode } from 'react'
import { Download, EllipsisVertical, MonitorDown, Share, SquarePlus, X } from 'lucide-react'
import { useInstallPrompt, type InstallPlatform } from '@/pwa/install'

const DISMISS_KEY = 'hybent_install_dismissed_at'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000
export const SHOW_INSTALL_EVENT = 'hybent:show-install'

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return Date.now() - at < SNOOZE_MS
  } catch {
    return false
  }
}

/** Manual steps per browser, for when there's no native install dialog. */
const STEPS: Record<InstallPlatform, ReactNode[]> = {
  'ios-safari': [
    <>Tap <Share size={15} aria-label="Share" className="inline text-hb-blue" /> <strong>Share</strong> in Safari's toolbar</>,
    <>Choose <SquarePlus size={15} aria-hidden className="inline text-hb-blue" /> <strong>Add to Home Screen</strong>, then <strong>Add</strong></>,
  ],
  'ios-other': [
    <>Tap <Share size={15} aria-label="Share" className="inline text-hb-blue" /> <strong>Share</strong> in the address bar</>,
    <>Choose <SquarePlus size={15} aria-hidden className="inline text-hb-blue" /> <strong>Add to Home Screen</strong> (or open this page in Safari)</>,
  ],
  android: [
    <>Tap <EllipsisVertical size={15} aria-label="menu" className="inline text-hb-blue" /> in Chrome's top-right corner</>,
    <>Choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>)</>,
  ],
  desktop: [
    <>Click <MonitorDown size={15} aria-label="install" className="inline text-hb-blue" /> <strong>Install</strong> at the right of the address bar</>,
    <>Or open the browser menu → <strong>Install Hybent Hiring…</strong></>,
  ],
  unsupported: [
    <>This browser can't install apps.</>,
    <>Open Hybent in <strong>Chrome</strong>, <strong>Edge</strong> or (on iPhone) <strong>Safari</strong> to install it.</>,
  ],
}

/**
 * Offers to install Hybent as an app.
 *
 * Phones (below lg): shown on its own, above the tab bar, until dismissed
 * ("Not now" snoozes it for two weeks). Any screen: opened from the account
 * menu's "Install app". Uses the browser's install dialog when one is ready,
 * otherwise the right manual steps for this browser. Never shown inside the
 * installed app.
 */
export function InstallAppCard() {
  const { available, canPrompt, platform, promptInstall } = useInstallPrompt()
  const [autoHidden, setAutoHidden] = useState(snoozed)
  // Opened on purpose from the menu: shown on every screen size.
  const [forced, setForced] = useState(false)
  const [showSteps, setShowSteps] = useState(false)

  useEffect(() => {
    const open = () => {
      setForced(true)
      setShowSteps(false)
    }
    window.addEventListener(SHOW_INSTALL_EVENT, open)
    return () => window.removeEventListener(SHOW_INSTALL_EVENT, open)
  }, [])

  if (!available || (!forced && autoHidden)) return null

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* storage blocked: it just shows again next visit */
    }
    setAutoHidden(true)
    setForced(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Install the Hybent app"
      className={
        forced
          ? 'fixed inset-x-3 bottom-[calc(var(--hb-mobile-nav)+12px)] z-[80] rounded-hb-md border border-hb-border bg-hb-elevated p-3.5 shadow-hb-3 lg:inset-x-auto lg:bottom-auto lg:right-6 lg:top-20 lg:w-[360px]'
          : 'fixed inset-x-3 bottom-[calc(var(--hb-mobile-nav)+12px)] z-40 rounded-hb-md border border-hb-border bg-hb-elevated p-3.5 shadow-hb-3 lg:hidden'
      }
    >
      <div className="flex items-start gap-3">
        <img src="/pwa-maskable-192x192.png" alt="" className="h-11 w-11 shrink-0 rounded-[12px] border border-hb-border" />
        <div className="min-w-0 flex-1">
          <p className="text-hb-sm font-semibold text-hb-text">Get the Hybent app</p>
          <p className="mt-0.5 text-hb-xs text-hb-muted">Full screen, on your home screen or dock, one tap away.</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Not now"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-hb-dim active:bg-hb-muted/10"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {showSteps ? (
        <ol className="mt-3 space-y-2 rounded-hb-sm bg-hb-surface-2 p-3 text-hb-sm text-hb-text">
          {STEPS[platform].map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-hb-xs leading-5 text-hb-dim">{i + 1}</span>
              <span className="leading-5">{step}</span>
            </li>
          ))}
        </ol>
      ) : (
        <button
          type="button"
          onClick={async () => {
            if (canPrompt) {
              if (await promptInstall()) close()
            } else {
              setShowSteps(true)
            }
          }}
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-hb-full bg-hb-grad text-hb-sm font-semibold text-hb-on-brand active:opacity-90"
        >
          <Download size={16} aria-hidden />
          Install app
        </button>
      )}
    </div>
  )
}
