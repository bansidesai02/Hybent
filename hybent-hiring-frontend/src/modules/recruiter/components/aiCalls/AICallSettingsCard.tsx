import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { PhoneCall } from 'lucide-react'

import { VOICE_CALLS_KEY, voiceCallsApi, type VoiceSettings } from '@/api/voiceCalls'
import { Button, Card, CardHeader, IconTile, Input, Select, Skeleton, Switch } from '@/components/hb'

import { errorMessage } from './format'

/**
 * Settings → AI Calls (Plan §7A). Admins edit; recruiters see the rules the
 * AI Agent follows. Calls are never placed outside the calling window, in
 * the candidate's own time zone.
 */
export function AICallSettingsCard({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: [...VOICE_CALLS_KEY, 'settings'],
    queryFn: () => voiceCallsApi.getSettings().then((r) => r.data),
  })
  const [form, setForm] = useState<VoiceSettings | null>(null)
  useEffect(() => { if (data) setForm(data) }, [data])

  const save = useMutation({
    mutationFn: (values: VoiceSettings) => voiceCallsApi.saveSettings(values).then((r) => r.data),
    onSuccess: (saved) => {
      toast.success('AI Call settings saved')
      queryClient.setQueryData([...VOICE_CALLS_KEY, 'settings'], saved)
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't save the settings")),
  })

  const set = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))
  const dirty = form && data && JSON.stringify(form) !== JSON.stringify(data)

  return (
    <Card as="section">
      <CardHeader
        title="AI Calls"
        subtitle="How the Hybent AI Agent calls your candidates."
        icon={<IconTile size="sm"><PhoneCall /></IconTile>}
      />
      {!form ? (
        <Skeleton className="h-48 w-full" rounded="md" />
      ) : (
        <fieldset disabled={!canEdit} className="flex flex-col gap-hb-4">
          <div className="grid gap-hb-3 sm:grid-cols-2">
            <Input label="Calling hours from" type="time" value={form.window_start}
                   onChange={(e) => set('window_start', e.target.value)} />
            <Input label="Calling hours to" type="time" value={form.window_end}
                   onChange={(e) => set('window_end', e.target.value)}
                   description="In the candidate's time zone." />
            <Select label="Attempts per candidate" value={String(form.max_attempts)}
                    options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` }))}
                    onChange={(e) => set('max_attempts', Number(e.target.value))} />
            <Select label="Gap between attempts" value={String(form.retry_gap_minutes)}
                    options={[30, 60, 120, 240, 1440].map((m) => ({ value: String(m), label: m < 60 ? `${m} minutes` : m === 1440 ? '1 day' : `${m / 60} hours` }))}
                    onChange={(e) => set('retry_gap_minutes', Number(e.target.value))} />
            <Select label="Call language" value={form.default_language}
                    options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'Hindi' }]}
                    onChange={(e) => set('default_language', e.target.value as 'en' | 'hi')}
                    description="The agent switches if the candidate answers in the other language." />
            <Select label="Keep recordings for" value={String(form.recording_retention_days)}
                    options={[30, 60, 90, 180, 365].map((d) => ({ value: String(d), label: `${d} days` }))}
                    onChange={(e) => set('recording_retention_days', Number(e.target.value))} />
            <Input label="Communication pass mark — client-facing" type="number" min={1} max={5} step="0.5"
                   value={form.communication_threshold_client_facing}
                   onChange={(e) => set('communication_threshold_client_facing', Number(e.target.value))} />
            <Input label="Communication pass mark — other roles" type="number" min={1} max={5} step="0.5"
                   value={form.communication_threshold_other}
                   onChange={(e) => set('communication_threshold_other', Number(e.target.value))} />
          </div>
          <Switch checked={form.reminder_calls} onChange={(v) => set('reminder_calls', v)}
                  label="Interview reminder calls"
                  description="Call candidates who agreed to AI calls the evening before (6 PM) and an hour before each interview, within calling hours." />
          <Switch checked={form.auto_update_profile} onChange={(v) => set('auto_update_profile', v)}
                  label="Update candidate profiles from calls"
                  description="Clear answers (experience, CTC, expected CTC, notice period, company, role) are copied to the profile, with an audit note. Unclear answers never are." />
          {canEdit ? (
            <div className="flex justify-end">
              <Button loading={save.isPending} disabled={!dirty} onClick={() => form && save.mutate(form)}>Save</Button>
            </div>
          ) : (
            <p className="text-hb-xs text-hb-dim">Only admins can change these settings.</p>
          )}
        </fieldset>
      )}
    </Card>
  )
}
