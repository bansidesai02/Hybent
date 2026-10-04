import { useEffect, useState } from 'react'

/**
 * Live result of a CSS media query, for the few phone/desktop differences that
 * can't be expressed in classes (a placeholder's wording, a default view).
 *
 *   const isPhone = useMediaQuery('(max-width: 767.98px)')
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Below the md breakpoint — the phone layout. */
export const PHONE_QUERY = '(max-width: 767.98px)'
