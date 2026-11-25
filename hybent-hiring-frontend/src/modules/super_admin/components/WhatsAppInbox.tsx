import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Bot, Hand, Send, UserRound } from 'lucide-react'

import { whatsappInboxApi, type WaContact } from '@/api/whatsappConsole'
import { Badge, type BadgeTone, Button, Card, CardHeader, Textarea } from '@/components/hb'

const KIND_TONE: Record<WaContact['kind'], BadgeTone> = {
  visitor: 'neutral',
  lead: 'brand',
  candidate: 'info',
  client: 'success',
}

const errorText = (err: any) => err?.response?.data?.detail || err?.message || 'Something went wrong'
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''

/** Everyone who messaged Hybent on WhatsApp: who they are, lead details, the chat; take over and reply. */
export function WhatsAppInbox() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const contacts = useQuery({
    queryKey: ['wa-contacts'],
    queryFn: () => whatsappInboxApi.contacts().then((r) => r.data),
    refetchInterval: 15_000,
  })
  const chat = useQuery({
    queryKey: ['wa-chat', selected],
    queryFn: () => whatsappInboxApi.messages(selected as string).then((r) => r.data),
    enabled: !!selected,
    refetchInterval: 8_000,
  })

  const count = chat.data?.messages.length ?? 0
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [count])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['wa-contacts'] })
    queryClient.invalidateQueries({ queryKey: ['wa-chat', selected] })
  }
  const reply = useMutation({
    mutationFn: () => whatsappInboxApi.reply(selected as string, text.trim()),
    onSuccess: () => {
      setText('')
      refresh()
    },
    onError: (e) => toast.error(errorText(e)),
  })
  const bot = useMutation({
    mutationFn: (paused: boolean) => whatsappInboxApi.setBot(selected as string, paused),
    onSuccess: (r) => {
      toast.success(r.data.bot_paused ? 'You took over this chat' : 'Bot is answering again')
      refresh()
    },
    onError: (e) => toast.error(errorText(e)),
  })

  const c = chat.data?.contact
  const lead = Object.entries(c?.lead ?? {}).filter(([, v]) => v)
  const list = contacts.data ?? []

  return (
    <Card as="section">
      <CardHeader
        title="WhatsApp chats"
        subtitle="Everyone who messaged Hybent. The bot answers; take over any chat to reply yourself."
      />
      <div className="grid gap-hb-4 lg:grid-cols-[320px_1fr]">
        <ul className="max-h-[560px] divide-y divide-hb-border overflow-y-auto rounded-hb-sm border border-hb-border">
          {list.length === 0 && <li className="p-4 text-hb-sm text-hb-muted">No chats yet.</li>}
          {list.map((ct) => (
            <li key={ct.id}>
              <button
                type="button"
                onClick={() => setSelected(ct.id)}
                className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-hb-surface-2 ${
                  selected === ct.id ? 'bg-hb-surface-2' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-hb-sm font-semibold text-hb-text">{ct.name || ct.phone}</span>
                  <Badge tone={KIND_TONE[ct.kind]}>{ct.kind}</Badge>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-hb-xs text-hb-muted">
                  <span className="truncate">{ct.lead.company || ct.phone}</span>
                  <span className="shrink-0">
                    {ct.bot_paused && ct.handoff_requested_at ? 'Needs reply · ' : ''}
                    {when(ct.last_message_at)}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {!c ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-hb-sm border border-dashed border-hb-border text-hb-sm text-hb-muted">
            Pick a chat to read it.
          </div>
        ) : (
          <div className="flex min-h-[420px] flex-col rounded-hb-sm border border-hb-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hb-border px-4 py-3">
              <div>
                <p className="font-semibold text-hb-text">{c.name || c.phone}</p>
                <p className="text-hb-xs text-hb-muted">
                  {c.phone} · {c.kind} · {c.status}
                </p>
              </div>
              {c.bot_paused ? (
                <Button size="sm" variant="ghost" icon={<Bot size={14} />} onClick={() => bot.mutate(false)} loading={bot.isPending}>
                  Hand back to bot
                </Button>
              ) : (
                <Button size="sm" variant="ghost" icon={<Hand size={14} />} onClick={() => bot.mutate(true)} loading={bot.isPending}>
                  Take over
                </Button>
              )}
            </div>

            {lead.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-hb-border px-4 py-2">
                {lead.map(([k, v]) => (
                  <span key={k} className="rounded-full bg-hb-surface-2 px-2 py-0.5 text-hb-xs text-hb-text">
                    <span className="text-hb-muted">{k.replace(/_/g, ' ')}:</span> {v}
                  </span>
                ))}
              </div>
            )}

            <div className="max-h-[420px] flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {(chat.data?.messages ?? []).map((m) => {
                const out = m.direction === 'out'
                const tone = !out ? 'bg-hb-surface-2' : m.author === 'team' ? 'bg-hb-success/15' : 'bg-hb-violet/10'
                return (
                  <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-hb-sm text-hb-text ${tone}`}>
                      <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-hb-muted">
                        {m.author === 'bot' ? <Bot size={11} /> : <UserRound size={11} />}
                        {m.author === 'person' ? 'them' : m.author === 'team' ? 'you' : 'bot'} · {when(m.created_at)}
                      </p>
                      {m.text}
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            <div className="border-t border-hb-border p-3">
              {c.can_reply ? (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Textarea rows={2} value={text} placeholder="Reply as the Hybent team…" onChange={(e) => setText(e.target.value)} />
                  </div>
                  <Button icon={<Send size={14} />} onClick={() => reply.mutate()} loading={reply.isPending} disabled={!text.trim()}>
                    Send
                  </Button>
                </div>
              ) : (
                <p className="text-hb-xs text-hb-muted">
                  More than 24 hours since their last message, so WhatsApp only allows a template now.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
