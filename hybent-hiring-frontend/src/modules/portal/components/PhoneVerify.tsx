import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { MessageCircle, Smartphone } from 'lucide-react'

import { PHONE_KEY, phoneApi } from '@/api/phone'
import { Button, Card, CardHeader, Dialog, IconTile, Input, Switch } from '@/components/hb'

const DISMISS_KEY = 'hb-phone-prompt-dismissed'

const errorText = (err: any) => err?.response?.data?.detail || err?.message || 'Something went wrong. Please try again.'

/** Enter mobile → 6-digit code on WhatsApp (from Hybent) → verified. */
export function PhoneVerifyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [mobile, setMobile] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)

  useEffect(() => {
    if (!open) {
      setCode('')
      setCodeSent(false)
    }
  }, [open])

  const digits = mobile.replace(/\D/g, '').replace(/^0/, '').slice(-10)
  const validMobile = /^[6-9]\d{9}$/.test(digits)

  const send = useMutation({
    mutationFn: () => phoneApi.sendCode(digits),
    onSuccess: () => {
      setCodeSent(true)
      toast.success(`Code sent on WhatsApp to +91 ${digits}`)
    },
    onError: (err) => toast.error(errorText(err)),
  })

  const verify = useMutation({
    mutationFn: () => phoneApi.verify(code.trim()).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(PHONE_KEY, data)
      toast.success('Mobile verified. You will get updates on WhatsApp.')
      onClose()
    },
    onError: (err) => toast.error(errorText(err)),
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Get updates on WhatsApp"
      description="Verify your mobile number to get WhatsApp updates when you are shortlisted, an interview is booked, and before each interview."
      size="sm"
    >
      {!codeSent ? (
        <div className="space-y-hb-3">
          <Input
            label="WhatsApp number"
            value={mobile}
            inputMode="tel"
            placeholder="98765 43210"
            onChange={(e) => setMobile(e.target.value)}
            description="India (+91). We will send a 6-digit code on WhatsApp."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Not now</Button>
            <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!validMobile}>
              Send code
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-hb-3">
          <Input
            label={`Code sent on WhatsApp to +91 ${digits}`}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6-digit code"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setCodeSent(false)}>Change number</Button>
            <Button onClick={() => verify.mutate()} loading={verify.isPending} disabled={code.length !== 6}>
              Verify
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

function usePhoneStatus() {
  return useQuery({
    queryKey: PHONE_KEY,
    queryFn: () => phoneApi.status().then((r) => r.data),
    staleTime: 5 * 60_000,
  })
}

/** Shown once per session after login to candidates who have not verified their mobile. */
export function PhoneVerifyPrompt() {
  const { data } = usePhoneStatus()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!data?.available || data.verified) return
    let dismissed = false
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === '1' } catch { /* ignore */ }
    if (!dismissed) setOpen(true)
  }, [data])

  const close = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
    setOpen(false)
  }

  if (!data?.available) return null
  return <PhoneVerifyDialog open={open} onClose={close} />
}

/** Settings → "WhatsApp updates": verify the number, or turn updates on/off. */
export function PhoneSmsCard() {
  const queryClient = useQueryClient()
  const { data } = usePhoneStatus()
  const [open, setOpen] = useState(false)
  const toggle = useMutation({
    mutationFn: (on: boolean) => phoneApi.setSmsOptIn(on).then((r) => r.data),
    onSuccess: (d) => queryClient.setQueryData(PHONE_KEY, { ...d, available: data?.available }),
    onError: (err) => toast.error(errorText(err)),
  })

  if (!data?.available && !data?.verified) return null
  return (
    <Card as="section">
      <CardHeader
        title="WhatsApp updates"
        subtitle="Interview times, reminders and results on WhatsApp."
        icon={<IconTile size="sm"><MessageCircle /></IconTile>}
      />
      {data?.verified ? (
        <div className="space-y-hb-3">
          <p className="flex items-center gap-2 text-hb-sm text-hb-text">
            <Smartphone size={15} className="text-hb-dim" aria-hidden /> {data.phone} · verified
          </p>
          <Switch
            checked={data.sms_opt_in}
            onChange={(v) => toggle.mutate(v)}
            label="Send me WhatsApp updates"
          />
          {data.available && <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Change number</Button>}
        </div>
      ) : (
        <Button onClick={() => setOpen(true)}>Verify WhatsApp number</Button>
      )}
      <PhoneVerifyDialog open={open} onClose={() => setOpen(false)} />
    </Card>
  )
}
