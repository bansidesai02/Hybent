import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquareText } from 'lucide-react'

import { SMS_KEY, smsApi, type SmsSettings } from '@/api/sms'
import { Badge, Button, Card, CardHeader, IconTile, Input, Select, Skeleton, Switch } from '@/components/hb'

function errMsg(err: any, fallback: string) {
  return err?.response?.data?.detail || err?.response?.data?.message || fallback
}

const STATUS_TONE = { sent: 'success', test: 'info', failed: 'error', skipped: 'warning' } as const

/**
 * Settings → SMS. Text messages to candidates and interviewers at each step
 * (application, shortlist, interview, reminders, offer, feedback), sent from
 * the HYBENT sender id. Each message needs its DLT-approved MSG91 template
 * id; until a provider key is set, messages are only logged ("Test").
 */
export function SmsSettingsCard() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: [...SMS_KEY, 'settings'],
    queryFn: () => smsApi.getSettings().then((r) => r.data),
  })
  const logs = useQuery({
    queryKey: [...SMS_KEY, 'logs'],
    queryFn: () => smsApi.logs().then((r) => r.data),
    refetchInterval: 60_000,
  })
  const [form, setForm] = useState<SmsSettings | null>(null)
  useEffect(() => { if (data) setForm(data) }, [data])
  const [testEvent, setTestEvent] = useState('shortlisted')
  const [testPhone, setTestPhone] = useState('')

  const save = useMutation({
    mutationFn: (f: SmsSettings) =>
      smsApi.saveSettings({
        enabled: f.enabled,
        events: Object.fromEntries(f.events.map((e) => [e.key, { on: e.on, template_id: e.template_id }])),
      }).then((r) => r.data),
    onSuccess: (saved) => {
      toast.success('SMS settings saved')
      queryClient.setQueryData([...SMS_KEY, 'settings'], saved)
    },
    onError: (err) => toast.error(errMsg(err, "Couldn't save the settings")),
  })

  const test = useMutation({
    mutationFn: () => smsApi.test(testEvent, testPhone.trim()),
    onSuccess: (res) => {
      const { status, error } = res.data
      if (status === 'sent') toast.success('Test SMS sent')
      else if (status === 'test') toast.success('Test mode: logged below, not sent (no SMS phone or key connected yet)')
      else toast.error(error || 'Not sent')
      queryClient.invalidateQueries({ queryKey: [...SMS_KEY, 'logs'] })
    },
    onError: (err) => toast.error(errMsg(err, 'Could not send')),
  })

  const setEvent = (key: string, patch: { on?: boolean; template_id?: string }) =>
    setForm((f) => (f ? { ...f, events: f.events.map((e) => (e.key === key ? { ...e, ...patch } : e)) } : f))
  const dirty = form && data && JSON.stringify(form) !== JSON.stringify(data)

  return (
    <Card as="section">
      <CardHeader
        title="SMS"
        subtitle="Text candidates and interviewers automatically at each step."
        icon={<IconTile size="sm"><MessageSquareText /></IconTile>}
      />
      {!form ? (
        <Skeleton className="h-48 w-full" rounded="md" />
      ) : (
        <div className="flex flex-col gap-hb-4">
          {!form.live && (
            <p className="rounded-hb-md bg-hb-surface-2 px-3 py-2 text-hb-sm text-hb-muted">
              <Badge tone="info">Test mode</Badge>{' '}
              {form.provider === 'android'
                ? 'No phone connected yet, so messages are only written to the log below, not sent. Install the free "SMS Gateway for Android" app on the phone with your SIM and add its username and password to the server settings.'
                : 'No SMS provider key yet, so messages are only written to the log below, not sent. Add the MSG91 key once your DLT registration is approved.'}
            </p>
          )}
          <Switch
            checked={form.enabled}
            onChange={(v) => setForm({ ...form, enabled: v })}
            label="Send SMS"
            description={
              form.provider === 'android'
                ? `Sent from your own phone's SIM, up to ${form.daily_limit} a day so the SIM is not blocked. Indian mobile numbers only.`
                : `From sender ID ${form.sender_id}. Indian mobile numbers only.`
            }
          />

          {(['candidate', 'interviewer'] as const).map((audience) => (
            <div key={audience} className="flex flex-col gap-hb-3">
              <p className="text-hb-xs font-semibold uppercase tracking-wide text-hb-dim">
                {audience === 'candidate' ? 'To candidates' : 'To interviewers'}
              </p>
              {form.events.filter((e) => e.audience === audience).map((e) => (
                <div key={e.key} className={`grid gap-hb-2 rounded-hb-md border border-hb-border p-3 ${form.needs_template_ids ? 'sm:grid-cols-[1fr_220px]' : ''}`}>
                  <div className="min-w-0">
                    <Switch checked={e.on} onChange={(v) => setEvent(e.key, { on: v })} label={e.label} />
                    <p className="mt-1 text-hb-xs text-hb-dim">{e.text.replace(/\{#var#\}/g, '…')}</p>
                  </div>
                  {form.needs_template_ids && (
                    <Input
                      label="MSG91 template ID"
                      value={e.template_id}
                      placeholder="From MSG91"
                      onChange={(ev) => setEvent(e.key, { template_id: ev.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}

          <div className="flex justify-end">
            <Button onClick={() => save.mutate(form)} loading={save.isPending} disabled={!dirty}>
              Save SMS settings
            </Button>
          </div>

          <div className="grid gap-hb-2 border-t border-hb-border pt-hb-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Select
              label="Send a test"
              value={testEvent}
              options={form.events.map((e) => ({ value: e.key, label: e.label }))}
              onChange={(e) => setTestEvent(e.target.value)}
            />
            <Input label="To mobile" value={testPhone} placeholder="98765 43210" onChange={(e) => setTestPhone(e.target.value)} />
            <Button variant="ghost" onClick={() => test.mutate()} loading={test.isPending} disabled={testPhone.trim().length < 10}>
              Send test
            </Button>
          </div>

          <div>
            <p className="mb-2 text-hb-xs font-semibold uppercase tracking-wide text-hb-dim">Recent SMS</p>
            {!logs.data?.length ? (
              <p className="text-hb-sm text-hb-muted">No SMS yet.</p>
            ) : (
              <ul className="divide-y divide-hb-border">
                {logs.data.map((l) => (
                  <li key={l.id} className="flex items-start gap-3 py-2">
                    <Badge tone={STATUS_TONE[l.status]}>{l.status === 'test' ? 'Test' : l.status}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-hb-sm text-hb-text">
                        {l.recipient_name || 'Unknown'} {l.phone ? `· ${l.phone}` : ''}
                      </p>
                      <p className="truncate text-hb-xs text-hb-dim">{l.error || l.body}</p>
                    </div>
                    {l.created_at && (
                      <span className="shrink-0 text-hb-xs text-hb-dim">
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
