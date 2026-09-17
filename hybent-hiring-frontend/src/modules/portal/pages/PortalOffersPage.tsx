import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Banknote, FileText, Inbox, Sparkles, Trophy, UserCheck } from 'lucide-react'

import { portalApi } from '@/api/portal'
import type { Offer } from '@/types'
import { formatDate, formatSalary } from '@/utils/formatters'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Dialog,
  EmptyState,
  IconTile,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/hb'

/**
 * Pending offers, the compensation breakdown, and the documents that unlock
 * after acceptance.
 *
 * Rebuilt on the design system in phase 7. Beyond appearance:
 *
 * - Accept/decline outcomes were reported with `window.alert`, which blocks
 *   the tab and reads as a browser error. They are toasts now, like every
 *   other mutation in the product.
 * - The pending-offer banner (`.offer-banner`, two absolutely-positioned
 *   `.ob-bg` layers) came from portal.css. It is the brand gradient now —
 *   the one place in the portal loud treatment is earned, because an offer
 *   is the moment the whole journey builds to.
 * - The decline flow used a `Modal` from the legacy `components/ui` kit; it
 *   is the design system's `Dialog` with a destructive footer.
 */

function DeclineDialog({
  offer,
  onClose,
  onConfirm,
  loading,
}: {
  offer: Offer
  onClose: () => void
  onConfirm: (reason: string) => void
  loading: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <Dialog
      open
      onClose={onClose}
      title="Decline offer"
      description={`Are you sure you want to decline the offer for ${offer.position_title}?`}
      size="sm"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="quiet" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={loading}
            disabled={loading}
            onClick={() => {
              if (!loading) onConfirm(reason)
            }}
          >
            Decline offer
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason (optional)"
        placeholder="Let the recruiter know why you're declining…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
      />
    </Dialog>
  )
}

function CtcRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-hb-sm px-4 py-3 ${
        highlight ? 'bg-hb-blue/8' : 'bg-hb-surface-2'
      }`}
    >
      <span
        className={`text-hb-sm ${highlight ? 'font-semibold text-hb-text' : 'text-hb-muted'}`}
      >
        {label}
      </span>
      <span
        className={
          highlight
            ? 'hb-grad-text font-display text-hb-h3'
            : 'font-mono text-hb-sm tabular-nums text-hb-text'
        }
      >
        {value}
      </span>
    </div>
  )
}

function OfferCard({
  offer,
  onAccept,
  onDecline,
}: {
  offer: Offer
  onAccept: () => void
  onDecline: () => void
}) {
  const isPending = offer.status === 'sent'
  const isAccepted = offer.status === 'accepted'
  const isDeclined = offer.status === 'declined'

  const total = (offer.base_salary ?? 0) + (offer.bonus ?? 0)

  return (
    <Card padding="none" className="overflow-hidden">
      {isPending ? (
        <div className="bg-hb-grad-diag p-6 text-white">
          <p className="inline-flex items-center gap-1.5 rounded-hb-full bg-white/15 px-3 py-1 font-mono text-hb-label uppercase">
            <Sparkles size={12} aria-hidden />
            Pending offer
          </p>
          <h3 className="mt-3 font-display text-hb-h2">{offer.position_title}</h3>
          <p className="mt-1 text-hb-sm text-white/85">
            {formatSalary(offer.base_salary, null, offer.salary_currency)} / year
            {offer.equity ? ' · plus equity' : ''}
          </p>
          {offer.expiry_date && (
            <p className="mt-2 text-hb-xs text-white/70">Expires {formatDate(offer.expiry_date)}</p>
          )}
          <div className="mt-hb-4 flex flex-wrap gap-2">
            {/* White on the gradient: the two actions must read against the
                banner, not the page. */}
            <Button
              onClick={onAccept}
              className="!bg-white !bg-none !text-hb-blue hover:!bg-white/90"
            >
              Accept offer
            </Button>
            <Button
              variant="ghost"
              onClick={onDecline}
              className="!border-white/40 !text-white hover:!bg-white/10"
            >
              Decline
            </Button>
            {offer.pdf_url && (
              <Button
                variant="ghost"
                icon={<FileText size={14} />}
                href={offer.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="!border-white/40 !text-white hover:!bg-white/10"
              >
                View PDF
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4 border-b border-hb-border p-6 pb-4">
          <div>
            <h3 className="font-display text-hb-h3 text-hb-text">{offer.position_title}</h3>
            <p className="mt-1 text-hb-xs text-hb-muted">
              Status:{' '}
              <Badge tone={isAccepted ? 'success' : isDeclined ? 'error' : 'neutral'}>
                {offer.status}
              </Badge>
            </p>
          </div>
          {offer.pdf_url && (
            <Button
              variant="ghost"
              size="sm"
              icon={<FileText size={14} />}
              href={offer.pdf_url}
              target="_blank"
              rel="noreferrer"
            >
              PDF
            </Button>
          )}
        </div>
      )}

      <div className="space-y-hb-4 p-6">
        <div>
          <p className="mb-2.5 font-mono text-hb-label uppercase text-hb-dim">
            Compensation breakdown
          </p>
          <div className="space-y-1">
            <CtcRow
              label="Base salary"
              value={formatSalary(offer.base_salary, null, offer.salary_currency)}
            />
            {offer.bonus != null && (
              <CtcRow label="Bonus" value={formatSalary(offer.bonus, null, offer.salary_currency)} />
            )}
            {offer.equity && <CtcRow label="Equity" value={offer.equity} />}
            {offer.start_date && <CtcRow label="Start date" value={formatDate(offer.start_date)} />}
            {(offer.bonus != null || offer.equity) && (
              <CtcRow
                label="Total CTC (excl. equity)"
                value={formatSalary(total, null, offer.salary_currency)}
                highlight
              />
            )}
          </div>
        </div>

        {offer.benefits && (
          <div>
            <p className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">Benefits</p>
            <p className="text-hb-sm leading-relaxed text-hb-muted">{offer.benefits}</p>
          </div>
        )}

        {isAccepted && (
          <p className="flex items-center gap-2.5 rounded-hb-md border border-hb-success/25 bg-hb-success/8 px-4 py-3 text-hb-sm font-semibold text-hb-success">
            <Trophy size={16} aria-hidden />
            Accepted on {formatDate(offer.responded_at as string)}
          </p>
        )}

        {isDeclined && (
          <div className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 px-4 py-3 text-hb-sm text-hb-error">
            Declined on {formatDate(offer.responded_at as string)}
            {offer.decline_reason && (
              <p className="mt-1 text-hb-xs opacity-80">Reason: {offer.decline_reason}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

/* The document checklist is static UI today — no upload endpoint exists yet.
   Kept as display-only rows, matching the previous behaviour. */
const DOCUMENTS = [
  { icon: <FileText />, name: 'Signed offer letter', meta: 'Requires signature', badge: <Badge tone="warning" dot>Pending</Badge> },
  { icon: <Banknote />, name: 'Bank details form', meta: 'For payroll processing', badge: <Badge tone="success" dot>Done</Badge> },
  { icon: <UserCheck />, name: 'Government ID', meta: 'Aadhar / PAN / passport', badge: <Badge tone="warning" dot>Upload</Badge> },
]

export default function PortalOffersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [acceptTarget, setAcceptTarget] = useState<Offer | null>(null)
  const [declineTarget, setDeclineTarget] = useState<Offer | null>(null)

  // Gate: check if the candidate has reached HR round
  const OFFER_ELIGIBLE_STAGES = [
    'hr_round_selected', 'offered', 'offer', 'hired', 'hired_joined',
    'offered_back_out', 'offer_withdrawn',
  ]
  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['portal', 'applications'],
    queryFn: () => portalApi.myApplications().then((r: any) => r.data),
  })
  const offersUnlocked =
    applications?.some(
      (a: any) =>
        OFFER_ELIGIBLE_STAGES.includes(a.stage) ||
        OFFER_ELIGIBLE_STAGES.includes(a.candidate?.pipeline_stage)
    ) ?? false

  const { data: offers, isLoading, isError } = useQuery({
    queryKey: ['portal', 'offers'],
    queryFn: () => portalApi.myOffers().then((r: any) => r.data),
    enabled: offersUnlocked,
  })

  const respondMutation = useMutation({
    mutationFn: ({ id, accept, reason }: { id: string; accept: boolean; reason?: string }) =>
      portalApi.respondOffer(id, accept, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'offers'] })
      setAcceptTarget(null)
      setDeclineTarget(null)
      toast.success('Offer status updated')
    },
    onError: () => toast.error('Failed to respond to the offer.'),
  })

  const hasAccepted = offers?.some((o: any) => o.status === 'accepted') || false

  // Silently redirect if not yet eligible
  useEffect(() => {
    if (!appsLoading && !offersUnlocked) {
      navigate('/hiring/portal', { replace: true })
    }
  }, [appsLoading, offersUnlocked, navigate])

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Candidate portal"
        title="Offer & documents"
        description="Review pending offers and complete your pre-joining documents."
      />

      {offersUnlocked && (
        <div className="grid gap-hb-5 lg:grid-cols-3">
          <div className="space-y-hb-5 lg:col-span-2">
            {isLoading ? (
              <Skeleton className="h-72 w-full" rounded="md" />
            ) : isError ? (
              <div
                role="alert"
                className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 p-4 text-hb-sm text-hb-error"
              >
                Failed to load offers.
              </div>
            ) : offers?.length === 0 ? (
              <Card padding="none">
                <EmptyState
                  icon={<Inbox />}
                  title="No offers yet"
                  description="When a company extends you an offer, it will appear here."
                  size="page"
                />
              </Card>
            ) : (
              offers?.map((offer: any) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  onAccept={() => setAcceptTarget(offer)}
                  onDecline={() => setDeclineTarget(offer)}
                />
              ))
            )}
          </div>

          <Card padding="default" className="self-start">
            <CardHeader
              title="Required documents"
              action={
                hasAccepted ? <Badge tone="warning">Action needed</Badge> : <Badge>Locked</Badge>
              }
            />
            {hasAccepted ? (
              <ul className="space-y-3">
                {DOCUMENTS.map((doc) => (
                  <li key={doc.name} className="flex items-center gap-3">
                    <IconTile size="sm">{doc.icon}</IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="text-hb-sm font-semibold text-hb-text">{doc.name}</p>
                      <p className="text-hb-xs text-hb-muted">{doc.meta}</p>
                    </div>
                    {doc.badge}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-5 text-center text-hb-sm text-hb-muted">
                Document collection unlocks once you accept a job offer.
              </p>
            )}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!acceptTarget}
        onClose={() => setAcceptTarget(null)}
        onConfirm={() => {
          if (!respondMutation.isPending && acceptTarget) {
            respondMutation.mutate({ id: acceptTarget.id, accept: true })
          }
        }}
        title="Accept offer"
        description={`Accept the offer for "${acceptTarget?.position_title}"? The recruiter is notified immediately.`}
        confirmLabel="Accept offer"
        loading={respondMutation.isPending}
      />

      {declineTarget && (
        <DeclineDialog
          offer={declineTarget}
          onClose={() => setDeclineTarget(null)}
          onConfirm={(reason) =>
            respondMutation.mutate({ id: declineTarget.id, accept: false, reason })
          }
          loading={respondMutation.isPending}
        />
      )}
    </div>
  )
}
