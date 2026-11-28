import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Ban, CheckCircle2, ExternalLink, FileText, Landmark, Send, Trash2 } from 'lucide-react'

import {
  superAdminInvoiceApi,
  type Invoice,
  type PaidMethod,
  type PaymentDetails,
} from '@/api/invoices'
import {
  Badge,
  Button,
  Card,
  type Column,
  DataTable,
  Dialog,
  Input,
  Select,
  StatCard,
  StatGrid,
} from '@/components/hb'

/**
 * Trial invoices (Super Admin → Billing → Invoices).
 *
 * A trial is invoiced automatically the day before it ends; the client pays
 * Hybent by bank transfer / UPI and sends the receipt. "Mark as paid" here
 * records it and activates their plan (same as a Stripe payment), and the
 * client is emailed a receipt. Hybent's bank / UPI details shown on every
 * invoice are edited at the bottom.
 */

const STATUS_TONE: Record<Invoice['status'], 'warning' | 'error' | 'success' | 'neutral'> = {
  pending: 'warning',
  overdue: 'error',
  paid: 'success',
  canceled: 'neutral',
}
const STATUS_LABEL: Record<Invoice['status'], string> = {
  pending: 'Unpaid',
  overdue: 'Overdue',
  paid: 'Paid',
  canceled: 'Cancelled',
}
const METHODS: { value: PaidMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer (NEFT/IMPS/RTGS)' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]
type DetailKey = keyof PaymentDetails | 'account_number_confirm'
const DETAIL_FIELDS: { key: DetailKey; label: string; placeholder?: string; hint?: string; auto?: boolean; wide?: boolean }[] = [
  { key: 'account_name', label: 'Account holder name', placeholder: 'HYBENT', hint: 'Exactly as the bank has it.' },
  { key: 'ifsc', label: 'IFSC', placeholder: 'SBIN0001234', hint: 'Checked against the RBI IFSC list; bank and branch fill in.' },
  { key: 'account_number', label: 'Account number', placeholder: '9 to 18 digits' },
  { key: 'account_number_confirm', label: 'Confirm account number', placeholder: 'Type it again' },
  { key: 'bank_name', label: 'Bank', auto: true },
  { key: 'branch', label: 'Branch', auto: true },
  { key: 'upi_id', label: 'UPI ID', placeholder: 'hybent@okhdfcbank', hint: 'Optional if the bank account is filled.' },
  { key: 'note', label: 'Note on invoices (optional)', placeholder: 'e.g. International clients: email us for SWIFT details.', wide: true },
]
const EMPTY_DETAILS: PaymentDetails = {
  account_name: '', bank_name: '', account_number: '', ifsc: '', branch: '', upi_id: '', note: '',
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

function sumLabel(rows: Invoice[]): string {
  const byCurrency = new Map<string, number>()
  rows.forEach((r) => byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + r.total))
  if (!byCurrency.size) return '—'
  return [...byCurrency.entries()]
    .map(([cur, amt]) => `${cur === 'INR' ? '₹' : cur === 'USD' ? '$' : `${cur} `}${amt.toLocaleString('en-IN')}`)
    .join(' + ')
}

function StatValue({ count, sum }: { count: number; sum: string }) {
  return (
    <span className="flex items-baseline gap-2">
      {count}
      {count > 0 && <span className="font-body text-hb-sm font-normal text-hb-muted">{sum}</span>}
    </span>
  )
}

function PaymentDetailsCard() {
  const queryClient = useQueryClient()
  const [details, setDetails] = useState<PaymentDetails>(EMPTY_DETAILS)
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Partial<Record<DetailKey, string>>>({})
  const [grace, setGrace] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const { data } = useQuery({ queryKey: ['sa-invoice-settings'], queryFn: superAdminInvoiceApi.settings })
  const hasSaved = !!data && Object.entries(data.payment_details).some(([k, v]) => k !== 'note' && v)

  useEffect(() => {
    if (data) {
      setDetails({ ...EMPTY_DETAILS, ...data.payment_details })
      setConfirm(data.payment_details.account_number || '')
      setGrace(data.grace_days)
    }
  }, [data])

  const value = (key: DetailKey) => (key === 'account_number_confirm' ? confirm : details[key])
  const change = (key: DetailKey, v: string) => {
    if (key === 'account_number_confirm') setConfirm(v)
    else setDetails((d) => ({ ...d, [key]: v, ...(key === 'ifsc' ? { bank_name: '', branch: '' } : {}) }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const save = async () => {
    setSaving(true)
    setErrors({})
    try {
      const res = await superAdminInvoiceApi.saveSettings({ ...details, account_number_confirm: confirm })
      setDetails({ ...EMPTY_DETAILS, ...res.payment_details })
      toast.success('Payment details checked and saved. New and resent invoices show them.')
    } catch (err: any) {
      const fields = err.response?.data?.details?.fields
      if (fields) setErrors(fields)
      toast.error(err.response?.data?.message || 'Could not save the payment details.')
    } finally {
      setSaving(false)
    }
  }

  const clear = async () => {
    setClearing(true)
    try {
      await superAdminInvoiceApi.clearSettings()
      setDetails(EMPTY_DETAILS)
      setConfirm('')
      setErrors({})
      setConfirmClear(false)
      await queryClient.invalidateQueries({ queryKey: ['sa-invoice-settings'] })
      toast.success('Payment details removed. Invoices now ask clients to contact Hybent for them.')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not remove the payment details.')
    } finally {
      setClearing(false)
    }
  }

  return (
    <Card padding="loose">
      <div className="mb-hb-4 flex items-start gap-3">
        <Landmark size={20} className="mt-0.5 text-hb-blue" aria-hidden />
        <div>
          <h2 className="font-display text-hb-h3 text-hb-text">Hybent&apos;s payment details</h2>
          <p className="text-hb-sm text-hb-muted">
            Shown on every invoice and in the invoice email. Use Hybent&apos;s business account: a bank account, a UPI ID,
            or both. Everything is checked before it&apos;s saved.
            {grace !== null && <> Clients keep access for {grace} days after the trial ends while the invoice is unpaid.</>}
          </p>
        </div>
      </div>
      <div className="grid gap-hb-3 sm:grid-cols-2">
        {DETAIL_FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? 'sm:col-span-2' : undefined}>
            <Input
              label={f.label}
              value={value(f.key)}
              placeholder={f.auto ? 'Fills in from the IFSC when you save' : f.placeholder}
              description={f.hint}
              error={errors[f.key]}
              readOnly={f.auto}
              inputMode={f.key.startsWith('account_number') ? 'numeric' : undefined}
              autoComplete="off"
              onChange={(e) => change(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="mt-hb-4 flex flex-wrap justify-end gap-2">
        {hasSaved && (
          <Button size="sm" variant="quiet" icon={<Trash2 size={14} />} onClick={() => setConfirmClear(true)} disabled={saving}>
            Remove details
          </Button>
        )}
        <Button size="sm" loading={saving} onClick={save}>Check &amp; save payment details</Button>
      </div>
      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Remove Hybent's payment details?"
        description="Invoices, including unpaid ones already sent, will stop showing the bank account and UPI ID and ask clients to contact Hybent instead. You can add details again any time."
        size="md"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setConfirmClear(false)} disabled={clearing}>Cancel</Button>
            <Button size="sm" variant="danger" loading={clearing} onClick={clear}>Remove details</Button>
          </>
        }
      >
        <span />
      </Dialog>
    </Card>
  )
}

export default function SuperAdminInvoices() {
  const queryClient = useQueryClient()
  const { data: invoices = [], isLoading } = useQuery({ queryKey: ['sa-invoices'], queryFn: superAdminInvoiceApi.list })
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [method, setMethod] = useState<PaidMethod>('bank_transfer')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['sa-invoices'] })

  const openPay = (inv: Invoice) => {
    setPaying(inv)
    setMethod('bank_transfer')
    setReference('')
  }

  const markPaid = async () => {
    if (!paying) return
    setBusy('pay')
    try {
      await superAdminInvoiceApi.markPaid(paying.id, method, reference.trim())
      toast.success(`${paying.invoice_number} marked paid. ${paying.organization_name}'s plan is active.`)
      setPaying(null)
      refresh()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not mark it paid.')
    } finally {
      setBusy(null)
    }
  }

  const resend = async (inv: Invoice) => {
    setBusy(`send-${inv.id}`)
    try {
      const res = await superAdminInvoiceApi.resend(inv.id)
      toast.success(`Invoice emailed to ${res.sent} admin${res.sent === 1 ? '' : 's'}.`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not resend.')
    } finally {
      setBusy(null)
    }
  }

  const cancel = async (inv: Invoice) => {
    setBusy(`cancel-${inv.id}`)
    try {
      await superAdminInvoiceApi.cancel(inv.id)
      toast.success(`${inv.invoice_number} cancelled.`)
      refresh()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not cancel.')
    } finally {
      setBusy(null)
    }
  }

  const unpaid = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue')
  const overdue = invoices.filter((i) => i.status === 'overdue')
  const paid = invoices.filter((i) => i.status === 'paid')

  const columns: Array<Column<Invoice>> = [
    {
      key: 'org',
      header: 'Client',
      cardTitle: true,
      cell: (i) => (
        <span className="min-w-0">
          <span className="block text-hb-sm font-semibold text-hb-text">{i.organization_name || i.billed_to.company}</span>
          <span className="block text-hb-xs text-hb-muted">{i.billed_to.email}</span>
        </span>
      ),
    },
    {
      key: 'number',
      header: 'Invoice',
      cell: (i) => (
        <span className="min-w-0">
          <span className="block font-mono text-hb-sm text-hb-text">{i.invoice_number}</span>
          <span className="block text-hb-xs text-hb-muted">{i.plan_name} plan</span>
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (i) => <span className="font-mono tabular-nums text-hb-text">{i.total_label}</span>,
    },
    {
      key: 'due',
      header: 'Due',
      cell: (i) => (
        <span className="text-hb-sm text-hb-text">
          {i.status === 'paid' ? <>Paid {fmtDate(i.paid_at)}</> : fmtDate(i.due_at)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (i) => <Badge tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (i) => (
        <span className="flex flex-wrap justify-end gap-1.5">
          {(i.status === 'pending' || i.status === 'overdue') && (
            <>
              <Button size="sm" icon={<CheckCircle2 size={14} />} onClick={() => openPay(i)}>Mark as paid</Button>
              <Button size="sm" variant="quiet" icon={<Send size={14} />} loading={busy === `send-${i.id}`} onClick={() => resend(i)}>
                Resend
              </Button>
              <Button size="sm" variant="quiet" icon={<Ban size={14} />} loading={busy === `cancel-${i.id}`} onClick={() => cancel(i)}>
                Cancel
              </Button>
            </>
          )}
          {i.url && (
            <Button size="sm" variant="quiet" icon={<ExternalLink size={14} />} href={i.url} target="_blank" rel="noopener noreferrer">
              Open
            </Button>
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-hb-6">
      <StatGrid>
        <StatCard label="Unpaid" value={<StatValue count={unpaid.length} sum={sumLabel(unpaid)} />} loading={isLoading} />
        <StatCard label="Overdue (access paused)" value={<StatValue count={overdue.length} sum={sumLabel(overdue)} />} loading={isLoading} />
        <StatCard label="Paid" value={<StatValue count={paid.length} sum={sumLabel(paid)} />} loading={isLoading} />
      </StatGrid>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={invoices}
          rowKey={(i) => i.id}
          loading={isLoading}
          caption="Trial invoices"
          empty={{
            icon: <FileText />,
            title: 'No invoices yet',
            description: 'Every free trial is invoiced automatically the day before it ends.',
          }}
        />
      </Card>

      <PaymentDetailsCard />

      <Dialog
        open={!!paying}
        onClose={() => setPaying(null)}
        title={paying ? `Mark ${paying.invoice_number} as paid` : ''}
        description={
          paying
            ? `${paying.organization_name || paying.billed_to.company} · ${paying.total_label}. Only do this once the money is in Hybent's account: their ${paying.plan_name} plan starts now and they're emailed a receipt.`
            : undefined
        }
        size="md"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setPaying(null)} disabled={busy === 'pay'}>Cancel</Button>
            <Button size="sm" loading={busy === 'pay'} onClick={markPaid}>Mark as paid</Button>
          </>
        }
      >
        <div className="space-y-hb-3">
          <Select
            label="How they paid"
            value={method}
            options={METHODS}
            onChange={(e) => setMethod(e.target.value as PaidMethod)}
          />
          <Input
            label="Transaction reference (UTR / UPI ref)"
            placeholder="e.g. 4123 5678 9012"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
      </Dialog>
    </div>
  )
}
