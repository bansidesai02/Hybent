import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Calendar, FileSearch, FileText, Map, User } from 'lucide-react'
import { portalApi } from '@/api/portal'
import { AppShell } from './AppShell'
import type { NavSection } from './navConfig'

/**
 * The candidate portal, as a variant of AppShell.
 *
 * It was a separate 294-line layout with its own theme state machine and its
 * own copy of the sidebar markup. Structurally it was never different from the
 * workspaces — sidebar plus top bar — so the only things it genuinely needs of
 * its own are the navigation and two topbar switches.
 *
 * The Offers section is server-driven rather than role-driven: it appears once
 * an application reaches a stage where an offer exists, which is why the portal
 * supplies `sections` instead of using the role table in navConfig.
 */

/* Stages at which Offers & Documents becomes meaningful. */
const OFFER_STAGES = [
  'hr_round_selected',
  'offered',
  'offer',
  'hired',
  'hired_joined',
  'offered_back_out',
  'offer_withdrawn',
]

export function PortalShell() {
  const { data: applications } = useQuery({
    queryKey: ['portal', 'applications-summary'],
    queryFn: () => portalApi.myApplicationsSummary().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const offersUnlocked =
    applications?.some(
      (a) =>
        OFFER_STAGES.includes(a.stage) ||
        OFFER_STAGES.includes(a.candidate_pipeline_stage || '')
    ) ?? false

  const sections = useMemo<NavSection[]>(() => {
    const base: NavSection[] = [
      {
        label: 'Main',
        items: [
          { to: '/hiring/portal', label: 'Application Journey', icon: Map, end: true },
          { to: '/hiring/portal/interviews', label: 'My Interviews', icon: Calendar },
          { to: '/hiring/portal/openings', label: 'Job Openings', icon: Briefcase },
        ],
      },
      {
        label: 'Intelligence',
        items: [{ to: '/hiring/portal/prep', label: 'Preparation Hub', icon: FileSearch }],
      },
    ]

    if (offersUnlocked) {
      base.push({
        label: 'Resources',
        items: [
          { to: '/hiring/portal/offers', label: 'Offers & Documents', icon: FileText },
        ],
      })
    }

    return base
  }, [offersUnlocked])

  return (
    <AppShell
      role="candidate"
      sections={sections}
      footerSubtitle="AI Hiring Platform"
      topbar={{
        /* No scoped candidate search API exists, and there is no team messaging
           on this side — both were absent from the old portal top bar too. */
        search: false,
        messages: false,
        menuItems: [
          { label: 'My Profile', icon: <User size={15} />, path: '/hiring/portal/profile' },
        ],
      }}
    />
  )
}
