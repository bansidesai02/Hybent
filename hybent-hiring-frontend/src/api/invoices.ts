import api from './axios'
import { getApiBaseUrl } from '@/config/api'

/** A trial invoice (paid by bank transfer / UPI, marked paid by the Hybent team). */
export interface Invoice {
  id: string
  organization_id: string
  organization_name: string | null
  invoice_number: string
  status: 'pending' | 'overdue' | 'paid' | 'canceled'
  currency: string
  total: number
  total_label: string
  lines: { label: string; quantity: number; amount: number; amount_label: string }[]
  plan_name: string | null
  issued_at: string
  due_at: string
  paid_at: string | null
  billed_to: { company?: string; contact?: string; email?: string; phone?: string; country?: string; website?: string }
  paid_method: string | null
  paid_reference: string | null
  business: { name: string; udyam: string; address: string; email: string; phone: string; website: string }
  url: string | null
  /** Hybent's bank / UPI details; only on the public page while unpaid. */
  payment_details?: PaymentDetails
}

export interface PaymentDetails {
  account_name: string
  bank_name: string
  account_number: string
  ifsc: string
  branch: string
  upi_id: string
  note: string
}

export interface InvoiceSettings {
  payment_details: PaymentDetails
  grace_days: number
  business: Invoice['business']
}

export type PaidMethod = 'bank_transfer' | 'upi' | 'cash' | 'cheque' | 'other'

export const invoiceApi = {
  /** Public: the page the invoice email links to. */
  get: (token: string) => api.get<Invoice>(`/v1/invoices/${token}`).then((res) => res.data),
  pdfUrl: (token: string) => `${getApiBaseUrl()}/v1/invoices/${token}/pdf`,
  /** The signed-in admin's own invoices. */
  mine: () => api.get<Invoice[]>('/v1/billing/invoices').then((res) => res.data),
}

export const superAdminInvoiceApi = {
  list: () => api.get<Invoice[]>('/v1/super-admin/invoices').then((res) => res.data),
  markPaid: (id: string, method: PaidMethod, reference: string) =>
    api.post<Invoice>(`/v1/super-admin/invoices/${id}/mark-paid`, { method, reference }).then((res) => res.data),
  resend: (id: string) => api.post<{ sent: number }>(`/v1/super-admin/invoices/${id}/resend`).then((res) => res.data),
  cancel: (id: string) => api.post(`/v1/super-admin/invoices/${id}/cancel`).then((res) => res.data),
  settings: () => api.get<InvoiceSettings>('/v1/super-admin/invoice-settings').then((res) => res.data),
  saveSettings: (payment_details: PaymentDetails & { account_number_confirm?: string }) =>
    api.put<{ payment_details: PaymentDetails }>('/v1/super-admin/invoice-settings', { payment_details }).then((res) => res.data),
  clearSettings: () =>
    api.delete<{ payment_details: PaymentDetails }>('/v1/super-admin/invoice-settings/payment-details').then((res) => res.data),
}
