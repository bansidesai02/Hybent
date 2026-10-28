import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { RefreshCw, Send, Sparkles } from 'lucide-react'

import { trialsApi, type TrialReplyKind, type TrialRequest } from '@/api/superAdmin'
import { Badge, Button, Dialog, Input, Tabs, Textarea } from '@/components/hb'

/**
 * The Hybent team's email about a trial request, sent from info@hybent.com.
 *
 * Pick what to say (approve, ask for more information, reject), let the AI
 * draft it, regenerate with an instruction if needed, edit, and send.
 * Nothing goes out until Send. Approving starts the 7-day trial; the email
 * gets the "Set up your organization" button and the trial end date.
 */

const KINDS: Array<{ value: TrialReplyKind; label: string }> = [
  { value: 'approve', label: 'Approve & start trial' },
  { value: 'info', label: 'Ask for more info' },
  { value: 'reject', label: 'Reject' },
]

const SEND_LABEL: Record<TrialReplyKind, string> = {
  approve: 'Approve & send',
  info: 'Send email',
  reject: 'Reject & send',
}

export function TrialReplyDialog({
  request,
  initialKind,
  onClose,
}: {
  request: TrialRequest | null
  initialKind: TrialReplyKind
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<TrialReplyKind>(initialKind)
  const [instructions, setInstructions] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [aiGenerated, setAiGenerated] = useState(false)
  const [reason, setReason] = useState('')

  const draft = useMutation({
    mutationFn: (args: { kind: TrialReplyKind; instructions: string }) =>
      trialsApi.draft(request!.id, args.kind, args.instructions),
    onSuccess: (res) => {
      setSubject(res.subject)
      setBody(res.body)
      setAiGenerated(res.ai_generated)
      if (!res.ai_generated) toast('AI is unavailable, so a template was used. Edit it before sending.')
    },
    onError: () => toast.error('Could not create a draft. Write the email below instead.'),
  })

  // A fresh draft whenever the dialog opens or the kind changes.
  useEffect(() => {
    if (!request) return
    setKind(initialKind)
  }, [request, initialKind])
  useEffect(() => {
    if (!request) return
    setSubject('')
    setBody('')
    draft.mutate({ kind, instructions: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id, kind])

  const send = useMutation({
    mutationFn: () =>
      trialsApi.send(request!.id, {
        kind, subject: subject.trim(), body: body.trim(), ai_generated: aiGenerated,
        reason: kind === 'reject' ? reason.trim() || undefined : undefined,
      }),
    onSuccess: (res) => {
      if (res.email_sent) toast.success(`Email sent to ${res.contact_email}.`)
      else toast.error('Saved, but the email could not be sent. Check the email settings and try again.')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'trials'] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not send the email.'),
  })

  const busy = draft.isPending || send.isPending
  const ready = subject.trim().length >= 3 && body.trim().length >= 10

  return (
    <Dialog
      open={!!request}
      onClose={() => !send.isPending && onClose()}
      title={`Reply to ${request?.company_name ?? ''}`}
      description={request ? `To ${request.contact_name} <${request.contact_email}> · from info@hybent.com` : undefined}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-hb-xs text-hb-muted">
            {kind === 'approve'
              ? 'Sending starts the 7-day trial. The setup button and trial end date are added to the email.'
              : kind === 'reject'
                ? 'The request is closed and the company can’t request another trial.'
                : 'The request stays pending.'}
          </span>
          <span className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={send.isPending}>Cancel</Button>
            <Button
              variant={kind === 'reject' ? 'danger' : 'primary'}
              icon={<Send size={14} />}
              loading={send.isPending}
              disabled={busy || !ready}
              onClick={() => send.mutate()}
            >
              {SEND_LABEL[kind]}
            </Button>
          </span>
        </div>
      }
    >
      <div className="space-y-hb-4">
        <Tabs aria-label="Email type" items={KINDS} value={kind} onChange={(next) => !busy && setKind(next)} />

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <Input
              label="Tell the AI what to change (optional)"
              placeholder={kind === 'reject' ? 'e.g. mention we could not verify the website' : 'e.g. make it shorter, mention the Copilot'}
              value={instructions}
              maxLength={500}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            icon={subject ? <RefreshCw size={14} /> : <Sparkles size={14} />}
            loading={draft.isPending}
            disabled={send.isPending}
            onClick={() => draft.mutate({ kind, instructions })}
          >
            {subject ? 'Regenerate' : 'Generate with AI'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {aiGenerated && <Badge tone="brand"><Sparkles size={11} aria-hidden /> AI draft</Badge>}
          {draft.isPending && <span className="text-hb-xs text-hb-muted">Writing a draft…</span>}
        </div>

        <Input label="Subject" value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} disabled={draft.isPending} />
        <Textarea
          label="Message"
          description="Plain text. Leave a blank line between paragraphs."
          rows={12}
          maxLength={8000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={draft.isPending}
        />
        {kind === 'approve' && (
          <div className="rounded-hb-md border border-hb-border bg-hb-surface-2 p-hb-3 text-hb-sm text-hb-muted">
            Added below your message: <b className="text-hb-text">Your trial ends on …</b> and a{' '}
            <b className="text-hb-text">Set up your organization</b> button.
          </div>
        )}
        {kind === 'reject' && (
          <Input
            label="Internal reason (not emailed)"
            placeholder="e.g. Couldn't verify the company"
            value={reason}
            maxLength={1000}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </div>
    </Dialog>
  )
}
