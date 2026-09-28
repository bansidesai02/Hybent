import type { PaymentLinkPayload } from '@/api/superAdmin'

/** The form state behind a plan payment link (see PaymentLinkFields). */
export interface PaymentLinkDraft {
  plan_name: string
  extra_admin_seats: string
  extra_recruiter_seats: string
  custom_amount_usd: string
  custom_term_months: string
}

export const EMPTY_PAYMENT_LINK: PaymentLinkDraft = {
  plan_name: 'Standard',
  extra_admin_seats: '0',
  extra_recruiter_seats: '0',
  custom_amount_usd: '',
  custom_term_months: '12',
}

const whole = (raw: string) => {
  const n = parseInt(raw, 10)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
}

export function toPaymentLinkPayload(draft: PaymentLinkDraft, isCustom: boolean): PaymentLinkPayload {
  return {
    plan_name: draft.plan_name,
    extra_admin_seats: isCustom ? 0 : whole(draft.extra_admin_seats),
    extra_recruiter_seats: isCustom ? 0 : whole(draft.extra_recruiter_seats),
    ...(isCustom
      ? {
          custom_amount_usd: parseFloat(draft.custom_amount_usd) || 0,
          custom_term_months: parseInt(draft.custom_term_months, 10),
        }
      : {}),
  }
}
