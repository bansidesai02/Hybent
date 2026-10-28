/** Dates and countdowns for the free trial, in the viewer's locale. */

export function formatTrialDate(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function trialTimeLeft(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return 'Ended'
  const hours = Math.floor(ms / 3_600_000)
  const days = Math.floor(hours / 24)
  if (days >= 1) return `${days} day${days > 1 ? 's' : ''} ${hours % 24}h left`
  if (hours >= 1) return `${hours}h ${Math.floor((ms % 3_600_000) / 60_000)}m left`
  return `${Math.max(1, Math.floor(ms / 60_000))} min left`
}
