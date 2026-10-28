import { useState } from 'react'
import { saveAs } from 'file-saver'
import toast from 'react-hot-toast'
import { Download, Sparkles } from 'lucide-react'

import { redirectToCheckout } from '@/api/billing'
import { trialApi, type ExportFormat } from '@/api/trial'
import { Button } from '@/components/hb'

/**
 * What a free trial's admin can do from Billing or the expired screen:
 * upgrade to Standard or Pro with Stripe Checkout, or download the
 * organization's data. Both work during the trial and after it ends.
 */

const EXPORTS: Array<{ format: ExportFormat; label: string }> = [
  { format: 'xlsx', label: 'Excel' },
  { format: 'csv', label: 'CSV' },
  { format: 'pdf', label: 'PDF summary' },
]

const PRICES = { Standard: '$29', Pro: '$39' } as const

export function TrialUpgradeButtons({
  paymentsEnabled = true,
  suggested = 'Pro',
}: {
  paymentsEnabled?: boolean
  suggested?: 'Standard' | 'Pro'
}) {
  const [busy, setBusy] = useState<'Standard' | 'Pro' | null>(null)

  const upgrade = async (plan: 'Standard' | 'Pro') => {
    try {
      setBusy(plan)
      const { checkout_url } = await trialApi.upgrade(plan)
      redirectToCheckout(checkout_url)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not start the payment.')
      setBusy(null)
    }
  }

  if (!paymentsEnabled) {
    return (
      <p className="text-hb-sm text-hb-muted">
        To choose a plan, email <a className="font-semibold text-hb-blue hover:underline" href="mailto:info@hybent.com">info@hybent.com</a>.
      </p>
    )
  }
  // The plan the trial mirrored comes first.
  const order: Array<'Standard' | 'Pro'> = suggested === 'Standard' ? ['Standard', 'Pro'] : ['Pro', 'Standard']
  return (
    <div className="flex flex-wrap gap-2">
      {order.map((plan, i) => (
        <Button
          key={plan}
          variant={i === 0 ? 'primary' : 'ghost'}
          icon={i === 0 ? <Sparkles size={15} /> : undefined}
          loading={busy === plan}
          disabled={!!busy}
          onClick={() => upgrade(plan)}
        >
          {i === 0 ? `Upgrade to ${plan}` : plan} · {PRICES[plan]}/mo
        </Button>
      ))}
    </div>
  )
}

export function TrialExportButtons() {
  const [busy, setBusy] = useState<ExportFormat | null>(null)

  const download = async (format: ExportFormat) => {
    try {
      setBusy(format)
      const { blob, filename } = await trialApi.exportData(format)
      saveAs(blob, filename)
    } catch (error: any) {
      const status = error?.response?.status
      toast.error(status === 429 ? 'Too many exports in the last hour. Please try again later.' : 'Could not export your data.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {EXPORTS.map(({ format, label }) => (
        <Button
          key={format}
          size="sm"
          variant="ghost"
          icon={<Download size={14} />}
          loading={busy === format}
          disabled={!!busy}
          onClick={() => download(format)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
