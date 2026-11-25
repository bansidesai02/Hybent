import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileText, MessageCircle, RefreshCw, Send } from 'lucide-react'

import { whatsappConsoleApi } from '@/api/whatsappConsole'
import { WhatsAppInbox } from '../components/WhatsAppInbox'
import { Badge, type BadgeTone, Button, Card, CardHeader, IconTile, Input, PageHeader, Textarea } from '@/components/hb'

const errorText = (err: any) => err?.response?.data?.detail || err?.message || 'Something went wrong'

const tone = (status: string): BadgeTone =>
  status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'warning'

/** Super admin: send a WhatsApp message and create a template from Hybent's own app. */
export default function WhatsAppConsolePage() {
  const queryClient = useQueryClient()
  const [to, setTo] = useState('')
  const [text, setText] = useState('Hello from Hybent! This message was sent from the Hybent app using the WhatsApp Cloud API.')
  const [lastSent, setLastSent] = useState<string | null>(null)
  const [name, setName] = useState('hybent_demo_update')
  const [body, setBody] = useState('Hi {{1}}, this is an update from Hybent about your application. Thank you.')

  const templates = useQuery({
    queryKey: ['wa-console-templates'],
    queryFn: () => whatsappConsoleApi.templates().then((r) => r.data),
  })

  const send = useMutation({
    mutationFn: () => whatsappConsoleApi.send(to, text).then((r) => r.data),
    onSuccess: (d) => {
      setLastSent(`Sent to ${d.to} · id ${d.message_id}`)
      toast.success('Message sent on WhatsApp')
    },
    onError: (e) => toast.error(errorText(e)),
  })

  const create = useMutation({
    mutationFn: () => {
      // A body with {{n}} needs sample values for Meta's review: send it as plain text if none.
      const plain = body.replace(/\{\{\d+\}\}/g, 'Raj')
      return whatsappConsoleApi.createTemplate(name, plain).then((r) => r.data)
    },
    onSuccess: (d) => {
      toast.success(`Template submitted: ${d.status}`)
      queryClient.invalidateQueries({ queryKey: ['wa-console-templates'] })
    },
    onError: (e) => toast.error(errorText(e)),
  })

  return (
    <div className="space-y-hb-6">
      <PageHeader
        eyebrow="Platform"
        title="WhatsApp console"
        description="Chats with people who message Hybent, plus tools to send a message and create templates through the WhatsApp Cloud API."
      />

      <WhatsAppInbox />

      <div className="grid gap-hb-6 lg:grid-cols-2">
        <Card as="section">
          <CardHeader
            title="1. Send a WhatsApp message"
            subtitle="Uses whatsapp_business_messaging. The number must have messaged Hybent in the last 24 hours."
            icon={<IconTile size="sm"><MessageCircle /></IconTile>}
          />
          <div className="space-y-hb-3">
            <Input label="To (WhatsApp number)" value={to} inputMode="tel" placeholder="98765 43210"
              onChange={(e) => setTo(e.target.value)} />
            <Textarea label="Message" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
            <Button icon={<Send size={15} />} onClick={() => send.mutate()} loading={send.isPending}
              disabled={to.replace(/\D/g, '').length < 10 || !text.trim()}>
              Send message
            </Button>
            {lastSent && <p className="text-hb-sm text-hb-success">{lastSent}</p>}
          </div>
        </Card>

        <Card as="section">
          <CardHeader
            title="2. Create a message template"
            subtitle="Uses whatsapp_business_management. Submitted to Meta for review."
            icon={<IconTile size="sm"><FileText /></IconTile>}
          />
          <div className="space-y-hb-3">
            <Input label="Template name (lowercase, underscores)" value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} />
            <Textarea label="Message body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            <Button icon={<FileText size={15} />} onClick={() => create.mutate()} loading={create.isPending}
              disabled={name.length < 3 || body.trim().length < 5}>
              Create template
            </Button>
          </div>
        </Card>
      </div>

      <Card as="section">
        <CardHeader
          title="Templates on Hybent's WhatsApp account"
          action={
            <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} onClick={() => templates.refetch()}>
              Refresh
            </Button>
          }
        />
        {templates.isLoading ? (
          <p className="text-hb-sm text-hb-muted">Loading…</p>
        ) : templates.isError ? (
          <p className="text-hb-sm text-hb-error">{errorText(templates.error)}</p>
        ) : (
          <ul className="divide-y divide-hb-border">
            {(templates.data ?? []).map((t) => (
              <li key={t.name} className="flex items-center justify-between py-2 text-hb-sm">
                <span className="font-mono text-hb-text">{t.name}</span>
                <Badge tone={tone(t.status)}>{t.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
