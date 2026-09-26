import { useNavigate, useSearchParams } from 'react-router-dom'

import HybentRegisterPortal from './HybentRegisterPortal'
import type { HybentRegisterValues, SelectedPlan } from './HybentRegisterPortal'
import { AUTH, SITE } from '@/app/paths'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Pricing cards link here with ?plan=; mirrors PLANS in PricingPage. */
const PLANS: Record<string, SelectedPlan> = {
  '1m': { label: 'Standard · 1 month', price: '$69/month' },
  '6m': { label: '6 months', price: '$66/month' },
  '12m': { label: '12 months', price: '$62/month' },
}

/**
 * /register — Hybent does not allow self sign-up, so this raises a demo or
 * access request on the public demo-request endpoint (the same lead pipeline
 * as the rest of the site) instead of creating an account.
 */
export default function HybentRegisterRoute() {
  useDocumentTitle(
    'Book a demo or request access — HYBENT',
    'Hybent accounts are set up by our team. Book a demo or request access to Hybent Hiring, our AI recruitment platform.'
  )

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planKey = searchParams.get('plan')
  const plan = planKey ? PLANS[planKey] ?? null : null
  const initialIntent = searchParams.get('demo') === 'true' || !plan ? 'demo' : 'access'

  const handleSubmit = async ({ intent, fullName, email, organization, teamSize }: HybentRegisterValues) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || ''
    const [first, ...rest] = fullName.split(' ')
    const response = await fetch(`${apiBase}/api/public/demo-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: first || fullName,
        last_name: rest.join(' ') || '-',
        work_email: email,
        company_name: organization,
        team_size: teamSize,
        monthly_hires: 'Not asked',
        hiring_challenge: [
          intent === 'demo' ? 'Book a demo' : 'Request access',
          plan ? `Selected plan: ${plan.label} (${plan.price})` : null,
          'via hybent.com/register',
        ].filter(Boolean).join(' · '),
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
      onContact={() => navigate(SITE.contact)}
      onBackToSite={() => navigate(SITE.home)}
      initialIntent={initialIntent}
      plan={plan}
    />
  )
}
