import api from './axios'

/** What the visitor came for. Decides the [tag] on the email to info@. */
export type ContactTopic = 'hiring' | 'services'

/** The hybent.com/contact form. Topic, name, email and message are required. */
export interface ContactMessage {
  topic: ContactTopic
  name: string
  email: string
  message: string
  /** E.164, e.g. "+971501234567". The server derives the country from it. */
  phone?: string
  company?: string
  location?: string
  referrer?: string
  team_size?: string
  hires_per_year?: string
  // What the link that opened the form was about (a service page, an
  // industry, a Hire Talent role). Not asked; carried from the URL.
  service?: string
  industry?: string
  role?: string
  // Recorded by the page, not typed — see modules/site/attribution.ts.
  came_from?: string
  landing_page?: string
  external_referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  /** Time from the form appearing to it being sent; bots are instant. */
  elapsed_ms?: number
  /** Honeypot, hidden from people. */
  website?: string
}

export const contactApi = {
  send: (payload: ContactMessage) =>
    api.post('/api/public/contact', payload, { skipLoader: true }).then((res) => res.data),
}
