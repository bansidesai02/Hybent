import api from './axios'

/** The hybent.com/contact form. Name, email and message are required. */
export interface ContactMessage {
  name: string
  email: string
  message: string
  phone?: string
  company?: string
  country?: string
  location?: string
  referrer?: string
  /** Honeypot, hidden from people. */
  website?: string
}

export const contactApi = {
  send: (payload: ContactMessage) =>
    api.post('/api/public/contact', payload, { skipLoader: true }).then((res) => res.data),
}
