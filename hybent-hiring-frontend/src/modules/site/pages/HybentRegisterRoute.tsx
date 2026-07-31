import { useNavigate, useSearchParams } from 'react-router-dom'

import HybentRegisterPortal from './HybentRegisterPortal'
import type { HybentRegisterValues } from './HybentRegisterPortal'
import { AUTH } from '@/app/paths'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * Wires the Hybent Register Portal to the public demo-request endpoint — the
 * same lead pipeline the Hybent Hiring form posts to, so a request raised from
 * either brand surface lands in one place.
 */
export default function HybentRegisterRoute() {
  useDocumentTitle(
    'Create your account — HYBENT',
    'Request access to Hybent and start with Hybent Hiring, our AI recruitment platform.'
  )

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'

  const handleSubmit = async ({ fullName, email, organization }: HybentRegisterValues) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || ''
    const [first, ...rest] = fullName.split(' ')
    const response = await fetch(`${apiBase}/api/public/demo-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: first || fullName,
        last_name: rest.join(' ') || 'User',
        work_email: email,
        company_name: organization,
        team_size: 'Lead from Hybent Register',
        monthly_hires: 'Lead from Hybent Register',
        hiring_challenge: isDemo ? 'Book a Demo Request' : 'Get Started Free Request',
      }),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'We could not submit your request. Please try again.')
    }
  }

  return (
    <HybentRegisterPortal
      onSubmit={handleSubmit}
      onSignIn={() => navigate(AUTH.login)}
    />
  )
}
