import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'

/**
 * Gmail OAuth lands back on the settings page with `?success=…` or
 * `?error=…&reason=…`. Shows the outcome once and clears the params.
 *
 * Shared by the admin mailbox list and the recruiter's single-mailbox card —
 * whichever one the page renders — so the result is never lost.
 */
export function useMailboxOAuthResult() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === 'email_account_connected') {
      toast.success('Gmail account connected')
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] })
    } else if (error === 'email_account_auth_failed') {
      // `reason` carries a readable cause from the backend, e.g. the address
      // is already connected by another member.
      toast.error(searchParams.get('reason') || 'Could not connect the Gmail account. Please try again.')
    } else {
      return
    }
    const next = new URLSearchParams(searchParams)
    next.delete('success')
    next.delete('error')
    next.delete('reason')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
}
