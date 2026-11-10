import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Bell } from 'lucide-react'

import api from '@/api/axios'
import { Button, Card, CardHeader, Switch } from '@/components/hb'

/**
 * Which platform events reach this super admin's bell and phone. Each switch
 * saves at once. Applies to this account only (app/services/alert_catalog.py).
 */

interface Alert {
  group: string
  key: string
  label: string
  hint: string
  enabled: boolean
}

const KEY = ['super-admin', 'alert-prefs']

export default function AlertPreferencesCard() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: () => api.get<{ alerts: Alert[] }>('/v1/push/alerts').then((r) => r.data),
  })

  const save = useMutation({
    mutationFn: (prefs: Record<string, boolean>) =>
      api.put<{ alerts: Alert[] }>('/v1/push/alerts', { prefs }).then((r) => r.data),
    onSuccess: (fresh) => queryClient.setQueryData(KEY, fresh),
    onError: () => toast.error('Could not save. Please try again.'),
  })

  if (!data) return null
  const groups = [...new Set(data.alerts.map((a) => a.group))]
  const setAll = (on: boolean) => save.mutate(Object.fromEntries(data.alerts.map((a) => [a.key, on])))

  return (
    <Card padding="loose">
      <CardHeader
        icon={<Bell />}
        title="Alerts"
        subtitle="Choose what reaches your bell and phone. Client activity is limited to one alert per client every 10 minutes for each type."
      />
      <div className="mt-hb-3 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => setAll(true)}>Turn all on</Button>
        <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => setAll(false)}>Turn all off</Button>
      </div>
      <div className="mt-hb-4 grid gap-hb-5 lg:grid-cols-3">
        {groups.map((group) => (
          <section key={group}>
            <h3 className="mb-hb-3 text-hb-sm font-semibold text-hb-text">{group}</h3>
            <div className="space-y-hb-3">
              {data.alerts.filter((a) => a.group === group).map((a) => (
                <Switch
                  key={a.key}
                  checked={a.enabled}
                  onChange={(on: boolean) => save.mutate({ [a.key]: on })}
                  disabled={save.isPending}
                  label={a.label}
                  description={a.hint}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  )
}
