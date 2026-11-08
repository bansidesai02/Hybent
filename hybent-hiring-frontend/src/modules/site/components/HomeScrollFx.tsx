import { useEffect } from 'react'

/**
 * Curtain on the home page: the section before the "Get started" band sticks
 * with its bottom on the bottom of the screen, and the band card slides up
 * over it. Renders nothing. Off for people who ask the system to reduce motion.
 */
export default function HomeScrollFx() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const band = document.querySelector<HTMLElement>('.hb-site .cta-band')
    const over = band?.closest('section') ?? null
    const under = over?.previousElementSibling as HTMLElement | null

    if (over && under) {
      under.classList.add('curtain-under')
      over.classList.add('curtain-over')
    }

    let frame = 0
    const update = () => {
      frame = 0
      if (under && window.innerWidth <= 860) {
        // Phones and small tablets: plain stacked sections (see hybent-site.css).
        under.style.top = ''
        under.style.transform = ''
      } else if (under) {
        // Stick just under the nav, so the band slides over it with no gap
        // above. Too tall to fit? Then stick with its bottom on the screen's.
        const navBottom = document.getElementById('nav')?.getBoundingClientRect().bottom ?? 0
        const fit = navBottom + under.offsetHeight <= window.innerHeight
        const top = fit ? navBottom : window.innerHeight - under.offsetHeight
        under.style.top = `${top}px`
        // Once the band has passed, carry the stuck section up with it (its
        // bottom never below the band's), so it never shows again underneath.
        const card = band ?? over
        const lift = card ? card.getBoundingClientRect().bottom - (top + under.offsetHeight) : 0
        under.style.transform = lift < 0 ? `translateY(${lift}px)` : ''
      }
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      under?.classList.remove('curtain-under')
      over?.classList.remove('curtain-over')
      if (under) { under.style.top = ''; under.style.transform = '' }
    }
  }, [])

  return null
}
