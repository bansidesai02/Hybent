import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { portalApi } from '@/api/portal'
import type { Offer } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { formatDate, formatSalary } from '@/utils/formatters'

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 9999,
        padding: '12px 22px',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background:
          type === 'success'
            ? 'linear-gradient(135deg,#10b981,#34d399)'
            : 'linear-gradient(135deg,#ef4444,#f87171)',
      }}
    >
      {message}
    </motion.div>
  )
}

// ── Decline modal ────────────────────────────────────────────────────────────

function DeclineModal({
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
    <Modal open onClose={onClose} title="Decline Offer" size="sm">
      <p style={{ fontSize: 13, color: 'var(--p-text-mid)', marginBottom: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        Are you sure you want to decline the offer for <strong>{offer.position_title}</strong>?
      </p>
      <Textarea
        label="Reason (optional)"
        placeholder="Let the recruiter know why you're declining..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
      />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 18px',
            borderRadius: 10,
            border: '1px solid var(--p-border)',
            background: 'transparent',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--p-text-mid)',
            cursor: 'pointer',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(reason)}
          disabled={loading}
          style={{
            padding: '8px 18px',
            borderRadius: 10,
            border: 'none',
            background: loading ? 'rgba(239,68,68,0.50)' : 'linear-gradient(135deg,#ef4444,#f87171)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {loading ? 'Declining…' : 'Decline Offer'}
        </button>
      </div>
    </Modal>
  )
}

// ── CTC row ──────────────────────────────────────────────────────────────────

function CtcRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: 10,
        background: highlight ? 'rgba(124,58,237,0.07)' : 'rgba(124,58,237,0.03)',
        borderBottom: '1px solid rgba(124,58,237,0.06)',
        marginBottom: 4,
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: highlight ? 'var(--p-text)' : 'var(--p-text-mid)',
          fontWeight: highlight ? 700 : 500,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: highlight ? 16 : 14,
          fontWeight: highlight ? 700 : 600,
          color: highlight ? '#7c3aed' : 'var(--p-text)',
          fontFamily: highlight ? "'Fraunces', serif" : "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Status badge ─────────────────────────────────────────────────────────────

function OfferStatusChip({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    draft:    { bg: 'rgba(107,114,128,0.10)', color: '#6b7280', label: 'Draft' },
    sent:     { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', label: 'Pending' },
    accepted: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981', label: 'Accepted' },
    declined: { bg: 'rgba(239,68,68,0.10)',   color: '#ef4444', label: 'Declined' },
    expired:  { bg: 'rgba(107,114,128,0.10)', color: '#6b7280', label: 'Expired' },
    revoked:  { bg: 'rgba(239,68,68,0.08)',   color: '#ef4444', label: 'Revoked' },
  }
  const c = cfg[status] ?? cfg.draft
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 11px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: c.bg,
        color: c.color,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {c.label}
    </span>
  )
}

// ── Offer card ───────────────────────────────────────────────────────────────

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

  const total =
    (offer.base_salary ?? 0) + (offer.bonus ?? 0)

  return (
    <div>
      {/* Gradient banner for pending offers */}
      {isPending && (
        <div
          style={{
            background: 'linear-gradient(135deg,#1a0050,#2d0080,#7c3aed,#a855f7)',
            borderRadius: '16px 16px 0 0',
            padding: '28px 32px',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              top: -80,
              right: -50,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              bottom: -40,
              left: 30,
            }}
          />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    opacity: 0.65,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  Job Offer
                </span>
                <h3
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 26,
                    lineHeight: 1.2,
                    marginTop: 4,
                    marginBottom: 4,
                  }}
                >
                  {offer.position_title}
                </h3>
              </div>
              <OfferStatusChip status={offer.status} />
            </div>
            {offer.expiry_date && (
              <p style={{ fontSize: 12, opacity: 0.70, marginTop: 10, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Offer expires {formatDate(offer.expiry_date)} — please respond before then.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Card body */}
      <div
        style={{
          background: 'var(--p-kpi)',
          border: '1px solid var(--p-table-border)',
          borderRadius: isPending ? '0 0 16px 16px' : 16,
          padding: '22px 24px',
          boxShadow: 'var(--p-shadow)',
        }}
      >
        {/* For non-pending: header inside card */}
        {!isPending && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--p-text)', marginBottom: 2 }}>{offer.position_title}</h3>
            </div>
            <OfferStatusChip status={offer.status} />
          </div>
        )}

        {/* CTC breakdown */}
        <div style={{ marginBottom: 18 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              color: 'var(--p-text-lite)',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              marginBottom: 8,
            }}
          >
            Compensation Breakdown
          </p>
          <CtcRow label="Base Salary" value={formatSalary(offer.base_salary, null, offer.salary_currency)} />
          {offer.bonus != null && (
            <CtcRow label="Bonus" value={formatSalary(offer.bonus, null, offer.salary_currency)} />
          )}
          {offer.equity && <CtcRow label="Equity" value={offer.equity} />}
          {offer.start_date && <CtcRow label="Start Date" value={formatDate(offer.start_date)} />}
          {(offer.bonus != null || offer.equity) && (
            <CtcRow
              label="Total CTC (excl. equity)"
              value={formatSalary(total, null, offer.salary_currency)}
              highlight
            />
          )}
        </div>

        {/* Benefits */}
        {offer.benefits && (
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--p-text-lite)', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>
              Benefits
            </p>
            <p style={{ fontSize: 13, color: 'var(--p-text-mid)', lineHeight: 1.6, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {offer.benefits}
            </p>
          </div>
        )}

        {/* PDF link */}
        {offer.pdf_url && (
          <a
            href={offer.pdf_url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#7c3aed',
              textDecoration: 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              marginBottom: 18,
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Download Offer Letter PDF
          </a>
        )}

        {/* Action buttons for pending */}
        {isPending && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              paddingTop: 16,
              borderTop: '1px solid var(--p-border)',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={onAccept}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 24px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg,#10b981,#34d399)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(16,185,129,0.45)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(16,185,129,0.35)'
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Accept Offer
            </button>
            <button
              onClick={onDecline}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 12,
                border: '1px solid rgba(239,68,68,0.30)',
                background: 'rgba(239,68,68,0.07)',
                color: '#ef4444',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.13)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.07)' }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Decline
            </button>
          </div>
        )}

        {/* Accepted state */}
        {isAccepted && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              background: 'rgba(16,185,129,0.10)',
              border: '1px solid rgba(16,185,129,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18 }}>🎉</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#10b981', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Offer Accepted — Congratulations!
              </p>
              {offer.responded_at && (
                <p style={{ fontSize: 11, color: 'var(--p-text-lite)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Accepted on {formatDate(offer.responded_at)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Declined state */}
        {isDeclined && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(107,114,128,0.07)',
              border: '1px solid rgba(107,114,128,0.15)',
            }}
          >
            <p style={{ fontSize: 13, color: 'var(--p-text-mid)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Declined on {formatDate(offer.responded_at)}
              {offer.decline_reason && (
                <span style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                  Reason: {offer.decline_reason}
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PortalOffersPage() {
  const queryClient = useQueryClient()
  const [acceptTarget, setAcceptTarget] = useState<Offer | null>(null)
  const [declineTarget, setDeclineTarget] = useState<Offer | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const { data: offers, isLoading, isError } = useQuery({
    queryKey: ['portal', 'offers'],
    queryFn: () => portalApi.myOffers().then((r) => r.data),
  })

  const respondMutation = useMutation({
    mutationFn: ({ id, accept, reason }: { id: string; accept: boolean; reason?: string }) =>
      portalApi.respondOffer(id, accept, reason),
    onSuccess: (_, { accept }) => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'offers'] })
      showToast(accept ? 'Offer accepted! Congratulations!' : 'Offer declined.')
      setAcceptTarget(null)
      setDeclineTarget(null)
    },
    onError: () => showToast('Failed to respond to offer. Please try again.', 'error'),
  })

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: 'var(--p-text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 30,
            fontWeight: 700,
            color: 'var(--p-text)',
            lineHeight: 1.2,
            marginBottom: 4,
          }}
        >
          My Offers
        </h1>
        <p style={{ fontSize: 14, color: 'var(--p-text-mid)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Review and respond to job offers
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ height: 200, borderRadius: 16, background: 'rgba(124,58,237,0.05)' }} />
          ))}
        </div>
      ) : isError ? (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 12,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.20)',
            color: '#ef4444',
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Failed to load offers.
        </div>
      ) : !offers?.length ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--p-text-lite)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
          <p
            style={{
              fontSize: 16,
              fontWeight: 600,
              fontFamily: "'Fraunces', serif",
              color: 'var(--p-text-mid)',
              marginBottom: 6,
            }}
          >
            No offers yet
          </p>
          <p style={{ fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            When a company extends you an offer, it will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              onAccept={() => setAcceptTarget(offer)}
              onDecline={() => setDeclineTarget(offer)}
            />
          ))}
        </div>
      )}

      {/* Accept confirm */}
      <ConfirmModal
        open={!!acceptTarget}
        onClose={() => setAcceptTarget(null)}
        onConfirm={() => acceptTarget && respondMutation.mutate({ id: acceptTarget.id, accept: true })}
        title="Accept Offer"
        message={`Are you sure you want to accept the offer for "${acceptTarget?.position_title}"?`}
        confirmText="Accept Offer"
        loading={respondMutation.isPending}
      />

      {/* Decline modal */}
      {declineTarget && (
        <DeclineModal
          offer={declineTarget}
          onClose={() => setDeclineTarget(null)}
          onConfirm={(reason) =>
            respondMutation.mutate({ id: declineTarget.id, accept: false, reason })
          }
          loading={respondMutation.isPending}
        />
      )}

      <AnimatePresence>
        {toast && <Toast {...toast} />}
      </AnimatePresence>
    </div>
  )
}
