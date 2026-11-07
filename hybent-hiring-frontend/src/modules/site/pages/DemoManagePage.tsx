import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { SiteView } from '../components/SiteView'
import { DemoScheduler } from '../components/DemoScheduler'
import { demoApi, demoError } from '@/api/demo'
import type { DemoBooking } from '@/api/demo'

/** The visitor's link from the confirmation email: see, move or cancel the demo. */
export default function DemoManagePage() {
  const { token = '' } = useParams()
  const [b, setB] = useState<DemoBooking | null>(null)
  const [error, setError] = useState('')
  const [moving, setMoving] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    demoApi.manage(token).then(setB).catch((e) => setError(demoError(e, 'This link is not valid.')))
  }, [token])

  const cancel = async () => {
    if (!window.confirm('Cancel this demo?')) return
    setBusy(true)
    try { setB(await demoApi.cancel(token)) } catch (e) { setError(demoError(e)) } finally { setBusy(false) }
  }

  const start = b ? new Date(b.start_at) : null
  const tz = b?.timezone || 'UTC'
  const when = start
    ? `${start.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' })} · ${start.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })} (${tz.replace(/_/g, ' ')})`
    : ''

  return (
    <SiteView route="book-demo">
      <section className="section bd" style={{ paddingTop: 'calc(var(--nav-h) + clamp(32px,4vw,56px))' }}>
        <div className="wrap">
          <div className="bd__shell bd__shell--narrow">
            {error ? <p className="ds-error">{error}</p>
              : !b ? <p className="ds-muted">Loading your demo…</p>
              : moving && b.status === 'booked' ? (
                <div className="bd__main">
                  <button type="button" className="ds-back" onClick={() => setMoving(false)}>← Back</button>
                  <h2 className="bd__step">Pick a new time</h2>
                  <p className="ds-muted" style={{ marginBottom: 18 }}>Now: {when}</p>
                  <DemoScheduler mode="reschedule" token={token} current={b} onDone={(nb) => setB({ ...b, ...nb })} />
                </div>
              ) : (
                <div className="bd__main bd__manage">
                  <h1 className="bd__title">
                    {b.status === 'cancelled' ? 'This demo is cancelled' : b.status === 'booked' ? 'Your Hybent Hiring demo' : 'This demo has taken place'}
                  </h1>
                  <p className="bd__when">{when}</p>
                  <p className="ds-muted">{b.name} · {b.company} · {b.email}</p>
                  {b.status === 'booked' ? (
                    <div className="ds-done__actions">
                      {b.meet_link && <a className="btn btn-primary" href={b.meet_link} target="_blank" rel="noreferrer">Join with Google Meet</a>}
                      <button type="button" className="btn btn-ghost" onClick={() => setMoving(true)}>Reschedule</button>
                      <button type="button" className="btn btn-ghost bd__cancel" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel demo'}</button>
                    </div>
                  ) : (
                    <div className="ds-done__actions"><a className="btn btn-primary" href="/book-demo">Book another time</a></div>
                  )}
                </div>
              )}
          </div>
        </div>
      </section>
    </SiteView>
  )
}
