import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Copy, Download, Loader2, MessageCircle, XCircle } from 'lucide-react'

import { invoiceApi, type Invoice } from '@/api/invoices'
import { Badge, Button, Card } from '@/components/hb'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * A trial invoice, reached from the invoice email (/invoice/<token>). No
 * sign-in: the token is the secret. Shows what's owed, Hybent's bank / UPI
 * details and a PDF download; the client pays by transfer and sends the
 * receipt, and the Hybent team marks it paid.
 *
 * Renders outside the app shell, so it wraps itself in `.hb-app`.
 */

const WHATSAPP = '918799029798'

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="hb-app flex min-h-screen items-center justify-center p-4">{children}</div>
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked: the value is still on screen */
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-hb-sm">
      <span className="text-hb-muted">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-hb-text">{value}</span>
        <button type="button" onClick={copy} className="text-hb-muted hover:text-hb-blue" aria-label={`Copy ${label}`}>
          {copied ? <CheckCircle2 size={14} className="text-hb-success" /> : <Copy size={14} />}
        </button>
      </span>
    </div>
  )
}

export default function InvoicePage() {
  const { token = '' } = useParams<{ token: string }>()
  const [inv, setInv] = useState<Invoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  useDocumentTitle(inv ? `Invoice ${inv.invoice_number} — HYBENT` : 'Invoice — HYBENT', 'Your Hybent invoice and how to pay it.')

  useEffect(() => {
    if (!token) return
    invoiceApi.get(token).then(setInv).catch((err: any) => {
      setError(err.response?.data?.message || 'This invoice link isn’t valid.')
    })
  }, [token])

  if (error) {
    return (
      <Shell>
        <Card padding="loose" className="w-full max-w-md text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-hb-error/25 bg-hb-error/10 text-hb-error">
            <XCircle size={28} aria-hidden />
          </span>
          <h1 className="mb-2 font-display text-hb-h2 text-hb-text">Invoice unavailable</h1>
          <p className="text-hb-sm text-hb-muted">
            {error} Need help? Email <a className="text-hb-blue hover:underline" href="mailto:info@hybent.com">info@hybent.com</a>.
          </p>
        </Card>
      </Shell>
    )
  }

  if (!inv) {
    return (
      <Shell>
        <p role="status" className="flex items-center gap-2.5 text-hb-body text-hb-muted">
          <Loader2 size={22} aria-hidden className="animate-spin text-hb-cyan" /> Loading your invoice…
        </p>
      </Shell>
    )
  }

  const paid = inv.status === 'paid'
  const pd = inv.payment_details
  const hasDetails = !!pd && Object.entries(pd).some(([k, v]) => k !== 'note' && v)
  const whatsappText = encodeURIComponent(`Hi Hybent, I've paid invoice ${inv.invoice_number}. Sharing the receipt.`)

  return (
    <Shell>
      <Card padding="loose" className="w-full max-w-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-hb-label uppercase text-hb-muted">Invoice {inv.invoice_number}</p>
            <h1 className="mt-1 font-display text-hb-h2 text-hb-text">{inv.billed_to.company || inv.organization_name}</h1>
            <p className="mt-1 text-hb-xs text-hb-muted">
              Issued {fmtDate(inv.issued_at)}
              {!paid && <> · Due <b className="text-hb-text">{fmtDate(inv.due_at)}</b></>}
            </p>
          </div>
          <Badge tone={paid ? 'success' : inv.status === 'overdue' ? 'error' : 'warning'}>
            {paid ? 'Paid' : inv.status === 'overdue' ? 'Overdue' : 'Unpaid'}
          </Badge>
        </div>

        <ul className="mt-hb-5 space-y-2 border-t border-hb-border pt-hb-4">
          {inv.lines.map((line) => (
            <li key={line.label} className="flex items-baseline justify-between gap-3 text-hb-sm">
              <span className="text-hb-text">
                {line.label}
                {line.quantity > 1 && <span className="text-hb-muted"> × {line.quantity}</span>}
              </span>
              <span className="font-mono tabular-nums text-hb-text">{line.amount_label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-hb-4 flex items-baseline justify-between gap-3 border-t border-hb-border pt-hb-4">
          <span className="font-semibold text-hb-text">Total</span>
          <span className="hb-grad-text font-display text-hb-num">{inv.total_label}</span>
        </div>

        {paid ? (
          <p className="mt-hb-5 flex items-center gap-2 text-hb-sm text-hb-success">
            <CheckCircle2 size={16} aria-hidden /> Paid on {fmtDate(inv.paid_at)}. Thank you!
          </p>
        ) : (
          <div className="mt-hb-5 rounded-hb-md border border-hb-border bg-hb-surface-2 p-hb-4">
            <p className="mb-2 font-mono text-hb-label uppercase text-hb-muted">How to pay</p>
            {hasDetails ? (
              <>
                <CopyRow label="Account name" value={pd!.account_name} />
                <CopyRow label="Bank" value={pd!.bank_name} />
                <CopyRow label="Account number" value={pd!.account_number} />
                <CopyRow label="IFSC" value={pd!.ifsc} />
                <CopyRow label="Branch" value={pd!.branch} />
                <CopyRow label="UPI ID" value={pd!.upi_id} />
                {pd!.note && <p className="mt-2 text-hb-xs text-hb-muted">{pd!.note}</p>}
              </>
            ) : (
              <p className="text-hb-sm text-hb-muted">Contact us below and we&apos;ll share the payment details.</p>
            )}
            <p className="mt-3 text-hb-xs text-hb-muted">
              Mention <b className="text-hb-text">{inv.invoice_number}</b> in the payment reference, then send us the receipt.
              We activate your plan as soon as it arrives.
            </p>
          </div>
        )}

        <div className="mt-hb-5 flex flex-wrap gap-2">
          <Button icon={<Download size={15} />} href={invoiceApi.pdfUrl(token)}>Download PDF</Button>
          {!paid && (
            <Button
              variant="ghost"
              icon={<MessageCircle size={15} />}
              href={`https://wa.me/${WHATSAPP}?text=${whatsappText}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Send receipt on WhatsApp
            </Button>
          )}
        </div>
        <p className="mt-hb-4 text-hb-xs text-hb-muted">
          Questions? Email <a className="text-hb-blue hover:underline" href={`mailto:${inv.business.email}`}>{inv.business.email}</a> or
          call/WhatsApp {inv.business.phone}. {inv.business.name} · Udyam {inv.business.udyam}.
        </p>
      </Card>
    </Shell>
  )
}
