/**
 * Fades out the installed app's launch screen (#hb-boot in index.html) once
 * React has painted. Held for a short minimum so a fast load doesn't flash it.
 */
const MIN_VISIBLE_MS = 450

export function hideBootScreen() {
  const el = document.getElementById('hb-boot')
  if (!el || el.hidden) {
    el?.remove()
    return
  }
  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now())
  setTimeout(() => {
    // Two frames: the first lets React's commit reach the screen.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.classList.add('hb-boot-out')
        el.addEventListener('transitionend', () => el.remove(), { once: true })
        setTimeout(() => el.remove(), 600)
      }),
    )
  }, wait)
}
