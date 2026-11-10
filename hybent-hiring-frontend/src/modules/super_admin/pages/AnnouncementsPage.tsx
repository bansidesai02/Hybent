import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Megaphone, Wrench } from 'lucide-react'

import api from '@/api/axios'
import { Button, Card, CardHeader, ConfirmDialog, PageHeader, Select, Switch, Textarea } from '@/components/hb'
import type { PlatformNotice } from '@/components/common/PlatformNoticeBanner'

/** Announcement banner and maintenance mode for every organization. */
export default function AnnouncementsPage() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['super-admin', 'platform-notice'],
    queryFn: () => api.get<PlatformNotice>('/v1/super-admin/platform-notice').then((r) => r.data),
  })
  const [a, setA] = useState<PlatformNotice['announcement']>({ active: false, message: '', tone: 'info' })
  const [m, setM] = useState<PlatformNotice['maintenance']>({ enabled: false, message: '' })
  const [busy, setBusy] = useState<'a' | 'm' | null>(null)
  const [confirmMaintenance, setConfirmMaintenance] = useState(false)

  useEffect(() => {
    if (!data) return
    setA(data.announcement)
    setM(data.maintenance)
  }, [data])

  const save = async (part: 'a' | 'm', body: Partial<PlatformNotice>) => {
    setBusy(part)
    try {
      await api.put('/v1/super-admin/platform-notice', body)
      toast.success('Saved')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'platform-notice'] })
      queryClient.invalidateQueries({ queryKey: ['platform-notice'] })
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not save.')
    } finally {
      setBusy(null)
    }
  }

  const saveMaintenance = () => {
    if (m.enabled && !data?.maintenance.enabled) setConfirmMaintenance(true)
    else save('m', { maintenance: m })
  }

  return (
    <div className="space-y-hb-6 pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Announcements"
        description="A banner every signed-in user sees, and maintenance mode. Changes reach open apps within a minute."
      />

      <Card>
        <CardHeader icon={<Megaphone size={16} />} title="Announcement banner" subtitle="Shown above the page for admins, recruiters and interviewers. Each person can dismiss it." />
        <div className="space-y-hb-4">
          <Textarea label="Message" maxLength={500} rows={3} value={a.message} onChange={(e) => setA({ ...a, message: e.target.value })} placeholder="e.g. New: AI calls are now live for Pro plans." />
          <Select
            label="Style"
            value={a.tone}
            onChange={(e: any) => setA({ ...a, tone: e.target.value })}
            options={[
              { value: 'info', label: 'Info (blue)' },
              { value: 'success', label: 'Good news (green)' },
              { value: 'warning', label: 'Warning (amber)' },
            ]}
          />
          <Switch label="Show the banner" checked={a.active} onChange={(v) => setA({ ...a, active: v })} />
          <Button loading={busy === 'a'} onClick={() => save('a', { announcement: a })}>Save announcement</Button>
        </div>
      </Card>

      <Card>
        <CardHeader icon={<Wrench size={16} />} title="Maintenance mode" subtitle="Organization users see a 'We'll be right back' screen and can't use the app. You and support sessions keep working; hybent.com and sign-in stay up." />
        <div className="space-y-hb-4">
          <Textarea label="Message" maxLength={500} rows={2} value={m.message} onChange={(e) => setM({ ...m, message: e.target.value })} />
          <Switch label="Maintenance mode" description={data?.maintenance.enabled ? 'On right now.' : 'Off.'} checked={m.enabled} onChange={(v) => setM({ ...m, enabled: v })} />
          <Button variant={m.enabled ? 'danger' : 'primary'} loading={busy === 'm'} onClick={saveMaintenance}>Save maintenance</Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmMaintenance}
        onClose={() => setConfirmMaintenance(false)}
        onConfirm={() => {
          setConfirmMaintenance(false)
          save('m', { maintenance: m })
        }}
        title="Turn on maintenance mode?"
        description="Every organization user is locked out until you turn it off here."
        confirmLabel="Turn on"
        destructive
      />
    </div>
  )
}
