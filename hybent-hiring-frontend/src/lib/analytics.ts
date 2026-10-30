/**
 * Google Tag Manager (which carries the GA4 tag) for the public site only.
 *
 * Loaded from AppLayout, so it never starts inside a workspace, the candidate
 * portal or a token link. Consent Mode v2: everything starts denied and is
 * granted only from the cookie banner's choice. GA4 is switched off again
 * whenever the visitor leaves the public shell for the app (setSiteTracking),
 * because GTM stays loaded across SPA navigation.
 */
const GTM_ID = 'GTM-K5T6ZNPP'
const GA4_ID = 'G-4GR2RNYP9N'
export const CONSENT_STORAGE_KEY = 'hybent_cookie_consent'

type Consent = { analytics: boolean; marketing: boolean }

declare global {
  interface Window {
    dataLayer: unknown[]
    [key: `ga-disable-${string}`]: boolean
  }
}

let loaded = false

// GTM reads the `arguments` object, not an array, so this can't use rest params.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments)
}

function consentState({ analytics, marketing }: Consent) {
  const ads = marketing ? 'granted' : 'denied'
  return {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
  }
}

function savedConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Consent) : null
  } catch {
    return null
  }
}

/** Starts GTM once. Skipped in dev and in the prerender's headless Chrome. */
export function initAnalytics() {
  if (loaded || import.meta.env.DEV || navigator.webdriver) return
  loaded = true
  window.dataLayer = window.dataLayer || []
  gtag('consent', 'default', { ...consentState({ analytics: false, marketing: false }), wait_for_update: 500 })
  const saved = savedConsent()
  if (saved) gtag('consent', 'update', consentState(saved))
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`
  document.head.appendChild(script)
}

/** Applies a choice made in the cookie banner. */
export function updateConsent(consent: Consent) {
  if (loaded) gtag('consent', 'update', consentState(consent))
}

/** GA4 on while a public page is shown, off inside the app. */
export function setSiteTracking(on: boolean) {
  window[`ga-disable-${GA4_ID}`] = !on
}
