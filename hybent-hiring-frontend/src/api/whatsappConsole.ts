import api from './axios'

export interface WaTemplate { name: string; status: string }

export const whatsappConsoleApi = {
  send: (to: string, text: string) =>
    api.post<{ to: string; message_id: string }>('/v1/whatsapp/console/send', { to, text }),
  createTemplate: (name: string, body: string) =>
    api.post<{ id: string; status: string; category: string }>('/v1/whatsapp/console/template', { name, body }),
  templates: () => api.get<WaTemplate[]>('/v1/whatsapp/console/templates'),
}

export interface WaContact {
  id: string
  phone: string | null
  name: string | null
  kind: 'visitor' | 'lead' | 'candidate' | 'client'
  status: string
  lead: Record<string, string>
  bot_paused: boolean
  handoff_requested_at: string | null
  last_message_at: string | null
  can_reply: boolean
}

export interface WaMessage {
  id: string
  direction: 'in' | 'out'
  author: 'person' | 'bot' | 'team'
  text: string
  created_at: string
}

export const whatsappInboxApi = {
  contacts: () => api.get<WaContact[]>('/v1/whatsapp/console/contacts'),
  messages: (id: string) =>
    api.get<{ contact: WaContact; messages: WaMessage[] }>(`/v1/whatsapp/console/contacts/${id}/messages`),
  reply: (id: string, text: string) => api.post<WaContact>(`/v1/whatsapp/console/contacts/${id}/reply`, { text }),
  setBot: (id: string, paused: boolean) => api.put<WaContact>(`/v1/whatsapp/console/contacts/${id}/bot`, { paused }),
}
