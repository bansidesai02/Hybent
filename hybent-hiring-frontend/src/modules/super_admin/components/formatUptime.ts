/** Seconds of process uptime as a compact "3d 4h" / "2h 10m" / "5m" label. */
export function formatUptime(seconds?: number): string {
  if (seconds == null) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}
