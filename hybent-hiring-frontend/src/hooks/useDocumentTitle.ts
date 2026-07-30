import { useEffect } from 'react'

/**
 * Title for views that render outside AppLayout — authentication and the
 * token-gated candidate flows. Public views get theirs from ROUTE_META instead,
 * so a title is never set in two places for the same route.
 */
export function useDocumentTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = title
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    }
  }, [title, description])
}
