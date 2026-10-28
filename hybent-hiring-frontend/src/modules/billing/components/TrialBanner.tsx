import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, LogOut } from 'lucide-react'

import { trialApi } from '@/api/trial'
import { useAuth } from '@/hooks/useAuth'
import { Button, Card } from '@/components/hb'
import { TRIAL_EXPIRED_EVENT } from '@/api/axios'
import { TrialExportButtons, TrialUpgradeButtons } from './TrialActions'
import { formatTrialDate, trialTimeLeft } from '../trialTime'

/**
 * The free trial in the workspace shell.
 *
 * While it runs: a slim countdown above the page. Once it ends: a screen in
 * place of the page. Admins can upgrade or export from it (and still use
 * Billing); everyone else is asked to contact their admin. The server is
 * what enforces this (402/403 "trial_expired"), so the screen also appears
 * the moment any request is refused, before the next status refresh.
 */

const BILLING_PATH = '/hiring/admin/billing'
const TRIAL_ROLES = new Set(['admin', 'recruiter', 'interviewer'])

export function TrialBanner() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [now, setNow] = useState(() => Date.now())
  const eligible = !!user && TRIAL_ROLES.has(user.role) && !user.is_impersonating

  const { data: trial } = useQuery({
    queryKey: ['trial-status'],
    queryFn: () => trialApi.status(),
    enabled: eligible,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  useEffect(() => {
    const onExpired = () => queryClient.invalidateQueries({ queryKey: ['trial-status'] })
    window.addEventListener(TRIAL_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(TRIAL_EXPIRED_EVENT, onExpired)
  }, [queryClient])

  useEffect(() => {
    if (!trial) return
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [trial])

  if (!eligible || !trial) return null

  const isAdmin = user!.role === 'admin'
  const expired = trial.status === 'expired' || new Date(trial.trial_end).getTime() <= now

  if (!expired) {
    const urgent = new Date(trial.trial_end).getTime() - now < 86_400_000
    return (
      <div
        role="status"
        className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2 text-hb-sm ${
          urgent ? 'border-hb-warning/30 bg-hb-warning/10' : 'border-hb-blue/20 bg-hb-blue/8'
        }`}
      >
        <span className="flex items-center gap-2 text-hb-text">
          <Clock size={15} aria-hidden className={urgent ? 'text-hb-warning' : 'text-hb-blue'} />
          <span>
            <b>Free trial</b> · {trialTimeLeft(trial.trial_end, now)}
            <span className="hidden text-hb-muted sm:inline"> · ends {formatTrialDate(trial.trial_end)}</span>
          </span>
        </span>
        {isAdmin ? (
          <Link to={BILLING_PATH} className="font-semibold text-hb-blue hover:underline">
            Upgrade or export data
          </Link>
        ) : (
          <span className="text-hb-muted">Ask your admin to choose a plan to keep access.</span>
        )}
      </div>
    )
  }

  // Admins can still use Billing to upgrade and export.
  if (isAdmin && location.pathname.startsWith(BILLING_PATH)) {
    return (
      <div role="alert" className="w-full border-b border-hb-error/30 bg-hb-error/8 px-4 py-2 text-hb-sm text-hb-text">
        <b>Your free trial has ended.</b> Choose a plan below to restore access for your team.
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9998] grid place-items-center overflow-y-auto bg-hb-bg/90 p-4 backdrop-blur-sm">
      <Card padding="loose" className="w-full max-w-lg" role="alertdialog" aria-labelledby="trial-ended-title">
        <h2 id="trial-ended-title" className="font-display text-hb-h2 text-hb-text">Your free trial has ended</h2>
        {isAdmin ? (
          <>
            <p className="mt-2 text-hb-sm text-hb-muted">
              Your team&apos;s access is paused. Choose a plan to pick up where you left off; everything from the trial
              is kept. Your data is deleted on <b>{formatTrialDate(trial.data_purge_at)}</b> if you don&apos;t upgrade.
            </p>
            <div className="mt-hb-5"><TrialUpgradeButtons paymentsEnabled={trial.payments_enabled} suggested={trial.plan} /></div>
            <p className="mt-hb-5 font-mono text-hb-label uppercase text-hb-muted">Download your data</p>
            <div className="mt-2"><TrialExportButtons /></div>
            <div className="mt-hb-5 flex flex-wrap justify-between gap-2 border-t border-hb-border pt-hb-4">
              <Button variant="quiet" size="sm" to={BILLING_PATH}>Compare plans on Billing</Button>
              <Button variant="quiet" size="sm" icon={<LogOut size={14} />} onClick={() => logout()}>Sign out</Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-hb-sm text-hb-muted">
              Your organization&apos;s 7-day trial of Hybent Hiring is over. Ask your admin to choose a plan; your access
              comes back as soon as they do.
            </p>
            <div className="mt-hb-5">
              <Button variant="ghost" icon={<LogOut size={14} />} onClick={() => logout()}>Sign out</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
