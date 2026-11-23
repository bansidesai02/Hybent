import api from './axios'

export interface WaTemplate { name: string; status: string }

export const whatsappConsoleApi = {
  send: (to: string, text: string) =>
    api.post<{ to: string; message_id: string }>('/v1/whatsapp/console/send', { to, text }),
  createTemplate: (name: string, body: string) =>
    api.post<{ id: string; status: string; category: string }>('/v1/whatsapp/console/template', { name, body }),
  templates: () => api.get<WaTemplate[]>('/v1/whatsapp/console/templates'),
}
