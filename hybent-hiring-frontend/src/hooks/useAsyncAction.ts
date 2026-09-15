import { useCallback, useRef, useState } from 'react'

/**
 * Wraps a plain async handler (one not already backed by a React Query
 * mutation) with a loading flag for `Button`'s `loading` prop and a guard
 * against re-entry.
 *
 * The guard is a ref checked synchronously before anything async happens —
 * a `useState`-only guard can theoretically be beaten by a second click in
 * the same tick, before React re-renders the button as disabled/loading; a
 * ref read is immediate, so it closes that window.
 */
export function useAsyncAction<Args extends unknown[]>(action: (...args: Args) => Promise<unknown>) {
  const [loading, setLoading] = useState(false)
  const inFlight = useRef(false)
  const actionRef = useRef(action)
  actionRef.current = action

  const run = useCallback(async (...args: Args) => {
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    try {
      await actionRef.current(...args)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  return [run, loading] as const
}
