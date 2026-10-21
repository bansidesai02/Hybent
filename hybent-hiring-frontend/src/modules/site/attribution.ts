/**
 * Where a contact-form lead came from, so the email to info@ can say
 * "came from /products" rather than relying on "How did you hear about us?".
 *
 * Kept in sessionStorage for the visit: the first site page and the outside
 * site or campaign that brought the visitor are recorded once, and the page
 * before the current one is updated on every site view. Storage can be
 * unavailable (private mode, blocked cookies); every access is guarded and the
 * form simply sends less.
 */

const KEY = {
  landing: 'hb:attr:landing',
  externalReferrer: 'hb:attr:ref',
  utm: 'hb:attr:utm',
  current: 'hb:attr:cur',
  previous: 'hb:attr:prev',
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'] as const

export interface Attribution {
  came_from?: string
  landing_page?: string
  external_referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

/** Called by every site view as it mounts. */
export function recordSiteVisit(path: string, search: string) {
  try {
    const s = sessionStorage
    if (!s.getItem(KEY.landing)) {
      s.setItem(KEY.landing, path + search)
      if (document.referrer && new URL(document.referrer).origin !== location.origin) {
        s.setItem(KEY.externalReferrer, document.referrer)
      }
      const params = new URLSearchParams(search)
      const utm = Object.fromEntries(UTM_KEYS.map((k) => [k, params.get(k)]).filter(([, v]) => v))
      if (Object.keys(utm).length) s.setItem(KEY.utm, JSON.stringify(utm))
    }
    const current = s.getItem(KEY.current)
    if (current !== path) {
      if (current) s.setItem(KEY.previous, current)
      s.setItem(KEY.current, path)
    }
  } catch {
    /* Storage unavailable: attribution is a nice-to-have. */
  }
}

/** What the contact form sends alongside the visitor's own answers. */
export function readAttribution(): Attribution {
  try {
    const s = sessionStorage
    const utm = JSON.parse(s.getItem(KEY.utm) || '{}') as Attribution
    return {
      came_from: s.getItem(KEY.previous) ?? undefined,
      landing_page: s.getItem(KEY.landing) ?? undefined,
      external_referrer: s.getItem(KEY.externalReferrer) ?? undefined,
      ...utm,
    }
  } catch {
    return {}
  }
}
