import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Which product the visitor is signing in *from*.
 *
 * Read from `?product=`. The platform used to answer this with a whole second
 * set of auth pages under `/hiring` — same endpoints, same accounts, different
 * design system — so that someone already inside Hybent Hiring did not feel
 * handed off to the parent brand. That cost ~880 lines, an embedded stylesheet
 * and two codepaths that had already drifted apart visually.
 *
 * One line of context does the same job. Add a product here and every auth
 * surface picks it up.
 */

const PRODUCTS: Record<string, string> = {
  hiring: 'Hybent Hiring',
}

export interface AuthProduct {
  /** The raw `?product=` value, for carrying across links. */
  key: string | null
  /** Display name, or undefined when the key is absent or unknown. */
  label?: string
}

export function useAuthProduct(): AuthProduct {
  const [params] = useSearchParams()
  const raw = params.get('product')
  return useMemo(() => {
    const key = raw?.toLowerCase().trim() || null
    return { key, label: key ? PRODUCTS[key] : undefined }
  }, [raw])
}

/**
 * Carries `?product=` across the links between sign-in, sign-up and reset.
 * Without this the eyebrow vanishes the moment someone clicks "Create account",
 * which is exactly the hand-off the product-branded pages existed to prevent.
 */
export function withProduct(path: string, key: string | null | undefined): string {
  return key ? `${path}?product=${encodeURIComponent(key)}` : path
}
