import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { BellRing, Smartphone } from 'lucide-react'

import { Badge, Button, Card, CardHeader } from '@/components/hb'
import { disablePush, enablePush, getPushConfig, getPushState, sendTestPush, type PushState } from '@/utils/push'

/**
 * "Phone notifications" for admins and super admins: turn push on for this
 * device, send a test, turn it off. Permission is asked only when they tap
 * "Turn on".
 */

const STATE_TEXT: Record<PushState, string> = {
  on: 'On for this device.',
  off: 'Off for this device.',
  'other-account': 'On for another account on this device, not this one yet. Turn it on to get this account’s notifications here too.',
  blocked: 'Blocked in this browser. Allow notifications for this site in the browser settings, then try again.',
  unsupported: "This browser can't receive notifications. On a phone, use Chrome (Android) or the installed app (iPhone).",
  'needs-install':
    'On iPhone, first add Hybent to your Home Screen (Share → Add to Home Screen), open it from there, then turn this on.',
}

export default function PushNotificationsCard() {
  const queryClient = useQueryClient()
  const { data: config } = useQuery({ queryKey: ['push-config'], queryFn: getPushConfig })
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'))
  }, [])

  if (!config) return null

  const refresh = async () => {
    setState(await getPushState())
    queryClient.invalidateQueries({ queryKey: ['push-config'] })
  }

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await action()
      toast.success(done)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Something went wrong.')
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  return (
    <Card padding="loose">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Smartphone size={17} aria-hidden className="text-hb-cyan" />
            Phone notifications
          </span>
        }
        subtitle={`Get a notification on this device for: ${config.events.join(', ').toLowerCase()}.`}
        action={state === 'on' ? <Badge tone="success">On</Badge> : undefined}
      />

      {!config.enabled ? (
        <p className="text-hb-sm text-hb-muted">Phone notifications aren't set up on the server yet.</p>
      ) : (
        <>
          <p className="mb-hb-4 text-hb-sm text-hb-muted">
            {state ? STATE_TEXT[state] : 'Checking this device…'}
            {config.devices > 0 && ` Your account has ${config.devices} device${config.devices === 1 ? '' : 's'} turned on.`}
          </p>
          <div className="flex flex-wrap gap-2.5">
            {(state === 'off' || state === 'other-account') && (
              <Button
                icon={<BellRing size={14} />}
                loading={busy}
                onClick={() => run(() => enablePush(config.public_key!), 'Notifications are on for this device')}
              >
                Turn on for this device
              </Button>
            )}
            {state === 'on' && (
              <>
                <Button variant="ghost" loading={busy} onClick={() => run(sendTestPush, 'Test sent')}>
                  Send a test
                </Button>
                <Button variant="ghost" loading={busy} onClick={() => run(disablePush, 'Notifications are off for this device')}>
                  Turn off
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
