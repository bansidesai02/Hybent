import { useEffect, useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import { useInstallPrompt } from '@/pwa/install'

const DISMISS_KEY = 'hybent_install_dismissed_at'
export const SHOW_INSTALL_EVENT = 'hybent:show-install'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return Date.now() - at < SNOOZE_MS
  } catch {
    return false
  }
}

/**
 * Phones (below lg), in the workspace: offers to install Hybent as an app.
 * Android/Chrome get the native install dialog; iOS Safari gets the two
 * manual steps. Never shown inside the installed app, and "Not now" hides it
 * for two weeks.
 */
export function InstallAppCard() {
  const { canPrompt, iosManual, promptInstall } = useInstallPrompt()
  const [hidden, setHidden] = useState(snoozed)
  const [showSteps, setShowSteps] = useState(false)

  // The account menu's "Install app" reopens this, steps first on iOS.
  useEffect(() => {
    const open = () => {
      setHidden(false)
      setShowSteps(iosManual)
    }
    window.addEventListener(SHOW_INSTALL_EVENT, open)
    return () => window.removeEventListener(SHOW_INSTALL_EVENT, open)
  }, [iosManual])

  if (hidden || (!canPrompt && !iosManual)) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* storage blocked: it just shows again next visit */
    }
    setHidden(true)
  }

  return (
    <div
      role="dialog"
      aria-label="Install the Hybent app"
      className="fixed inset-x-3 bottom-[calc(var(--hb-mobile-nav)+12px)] z-40 rounded-hb-md border border-hb-border bg-hb-elevated p-3.5 shadow-hb-3 lg:hidden"
    >
      <div className="flex items-start gap-3">
        <img src="/pwa-maskable-192x192.png" alt="" className="h-11 w-11 shrink-0 rounded-[12px] border border-hb-border" />
        <div className="min-w-0 flex-1">
          <p className="text-hb-sm font-semibold text-hb-text">Get the Hybent app</p>
          <p className="mt-0.5 text-hb-xs text-hb-muted">Full screen, on your home screen, one tap away.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-hb-dim active:bg-hb-muted/10"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {showSteps ? (
        <ol className="mt-3 space-y-2 rounded-hb-sm bg-hb-surface-2 p-3 text-hb-sm text-hb-text">
          <li className="flex items-center gap-2">
            <span className="font-mono text-hb-xs text-hb-dim">1</span>
            Tap <Share size={15} aria-label="Share" className="text-hb-blue" /> Share in Safari's toolbar
          </li>
          <li className="flex items-center gap-2">
            <span className="font-mono text-hb-xs text-hb-dim">2</span>
            Choose <SquarePlus size={15} aria-hidden className="text-hb-blue" /> <strong>Add to Home Screen</strong>
          </li>
        </ol>
      ) : (
        <button
          type="button"
          onClick={async () => {
            if (canPrompt) {
              if (await promptInstall()) setHidden(true)
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
