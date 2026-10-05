/**
 * "Install the app" support for the installed Hybent PWA.
 *
 * Chrome / Edge / Android fire `beforeinstallprompt` once, early — often before
 * any React component exists — so it's captured here at module load (imported
 * from main.tsx) and replayed to whoever asks. iOS Safari has no install API:
 * there the UI shows the two manual steps instead.
 */
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we show our own button instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own flag for a home-screen launch
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

/** Which manual install steps apply when there's no native install dialog. */
export type InstallPlatform = 'ios-safari' | 'ios-other' | 'android' | 'desktop' | 'unsupported'

export function installPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'unsupported'
  const ua = navigator.userAgent
  if (isIOS()) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios-safari'
  if (/Android/.test(ua)) return /Firefox/.test(ua) ? 'unsupported' : 'android'
  // Desktop: Chrome, Edge, Opera and Brave can install; Firefox and Safari can't.
  if (/Edg\/|Chrome\//.test(ua) && !/Firefox/.test(ua)) return 'desktop'
  return 'unsupported'
}

export function useInstallPrompt() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  const standalone = isStandalone()
  const ios = isIOS()
  return {
    /** Already running as the installed app. */
    standalone,
    /** Show "Install app" at all: anywhere except inside the installed app.
        Chrome only offers its dialog after some engagement (a tap and ~30s
        on the site), so the entry point can't wait for it. */
    available: !standalone,
    /** A native install dialog is ready (Chrome / Edge / Android). */
    canPrompt: !standalone && deferred !== null,
    /** iOS: install is always manual (Share → Add to Home Screen). */
    iosManual: !standalone && ios,
    platform: installPlatform(),
    async promptInstall(): Promise<boolean> {
      if (!deferred) return false
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      deferred = null
      notify()
      return outcome === 'accepted'
    },
  }
}
