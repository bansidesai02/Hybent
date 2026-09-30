import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { SHOW_CUSTOMERS } from '@/app/paths'

/* Only accounts that exist get an icon: an empty url hides it, and with no
   urls at all the whole row is left out rather than linking back home. */
const SOCIAL_LINKS = [
  { label: 'LinkedIn', icon: 'i-in', url: 'https://www.linkedin.com/company/hybent' },
  { label: 'X', icon: 'i-x', url: '' },
  { label: 'GitHub', icon: 'i-gh', url: '' },
  { label: 'YouTube', icon: 'i-yt', url: '' },
].filter((link) => link.url)

/* --d orders each letter's entrance: "Where" types in left to right, "meets"
   bursts out from its middle, and the two brand words ignite outward from
   "meets" — "vision" right to left, "innovation" left to right. */
const TAGLINE = [
  { word: 'Where', kind: 'where', order: (i: number) => i },
  { word: 'vision', kind: 'vision', order: (i: number) => 5 - i },
  { word: 'meets', kind: 'meets', order: (i: number) => Math.abs(i - 2) },
  { word: 'innovation', kind: 'innovation', order: (i: number) => i },
]

export function GlobalFooter() {
  const tagRef = useRef<HTMLParagraphElement>(null)

  /* Tagline choreography, played once the first time it scrolls into view:
     two points travel a hairline from either end and meet under "meets",
     which sparks the brand words alight. The footer renders outside SiteView
     too, so it can't rely on useSiteBehaviours' [data-rv] observer. Armed
     before paint so it stays visible without JS. */
  useLayoutEffect(() => {
    const el = tagRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) return

    const meets = el.querySelector<HTMLElement>('.tag-meets')
    const measure = () => {
      el.style.setProperty('--w', `${el.offsetWidth}px`)
      if (meets) el.style.setProperty('--mx', `${meets.offsetLeft + meets.offsetWidth / 2}px`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)

    el.classList.add('armed')
    const io = new IntersectionObserver(
      ([en]) => {
        if (!en.isIntersecting) return
        el.classList.add('in')
        io.disconnect()
      },
      { threshold: 0.6 }
    )
    io.observe(el)

    // Letters near the cursor lift and glow, falling off over ~70px.
    const cleanups = [() => io.disconnect(), () => ro.disconnect()]
    if (window.matchMedia('(pointer:fine)').matches) {
      const chars = Array.from(el.querySelectorAll<HTMLElement>('.ch'))
      let frame = 0
      const onMove = (e: PointerEvent) => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          chars.forEach((c) => {
            const r = c.getBoundingClientRect()
            const lift = Math.max(0, 1 - Math.abs(e.clientX - (r.left + r.width / 2)) / 70)
            c.style.setProperty('--lift', lift.toFixed(3))
          })
        })
      }
      const onLeave = () => {
        cancelAnimationFrame(frame)
        chars.forEach((c) => c.style.removeProperty('--lift'))
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerleave', onLeave)
      cleanups.push(() => {
        cancelAnimationFrame(frame)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerleave', onLeave)
      })
    }
    return () => cleanups.forEach((fn) => fn())
  }, [])

  return (
    /* Same scoping contract as the global nav: design tokens, no page surface. */
    <div className="hb-site hb-chrome">
      <footer className="footer">
      <svg className="footer__field" aria-hidden="true" viewBox="0 0 900 200" width="900" height="200" style={{ maxWidth: "100%" }}>
          <rect width="900" height="200" fill="var(--surface-2)" />
          <g opacity=".5">
            <g stroke="url(#hbgh)" strokeWidth="1" fill="none" opacity=".55">
              <path d="M80 150L200 70M200 70L330 130M330 130L470 50M470 50L610 120M610 120L740 60M740 60L850 140M200 70L330 40M330 130L470 170M610 120L500 170" />
            </g>
            <g fill="url(#hbgh)">
              <circle cx="80" cy="150" r="3.5" /><circle cx="200" cy="70" r="5" /><circle cx="330" cy="130" r="3.5" />
              <circle cx="470" cy="50" r="5.5" /><circle cx="610" cy="120" r="3.5" /><circle cx="740" cy="60" r="4.5" />
              <circle cx="850" cy="140" r="3.5" /><circle cx="330" cy="40" r="2.6" /><circle cx="470" cy="170" r="2.6" /><circle cx="500" cy="170" r="2.6" />
            </g>
          </g>
        </svg>
      <div className="wrap">
        <div className="footer__top">
          <div className="footer__brand">
            <img className="wm t-dark" src="/hybent/hybent-wordmark-dark.png" alt="HYBENT" /><img className="wm t-light" src="/hybent/hybent-wordmark-light.png" alt="HYBENT" />
            <p className="small" style={{ maxWidth: "34ch" }}>Intelligent enterprise software, built AI-first. Headquartered in Ahmedabad, India.</p>
            {SOCIAL_LINKS.length > 0 && (
              <div className="socials" style={{ marginTop: "22px" }}>
                {SOCIAL_LINKS.map((link) => (
                  <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label}><svg aria-hidden="true"><use href={`#${link.icon}`} /></svg></a>
                ))}
              </div>
            )}
          </div>
          <div><h5>Products</h5><ul>
            <li><a href="/products/hiring">Hybent Hiring</a></li>
          </ul></div>
          <div><h5>Solutions</h5><ul>
            <li><a href="/services">Services</a></li>
            <li><a href="/industries">Industries</a></li>
            <li><a href="/hire-talent">Hire Talent</a></li>
          </ul></div>
          <div><h5>Company</h5><ul>
            <li><a href="/about">About</a></li><li><a href="/about/story">Our story</a></li><li><a href="/careers">Careers</a></li>
            <li><a href="/faq">FAQ</a></li><li><a href="/contact">Contact</a></li></ul></div>
          <div><h5>More</h5><ul>
            <li><a href="/security">Security</a></li><li><a href="/platform/ecosystem">Platform</a></li>
            {SHOW_CUSTOMERS && <li><a href="/customers">Customers</a></li>}<li><a href="/pricing">Pricing</a></li><li><a href="/contact">Contact sales</a></li></ul></div>
        </div>

        <p className="footer__tag" ref={tagRef}>
          <span className="tag-sr">Where vision meets innovation</span>
          <span className="tag-line" aria-hidden="true">
            {TAGLINE.map(({ word, kind, order }) => (
              <span key={word} className={`tag-word tag-${kind}`}>
                {Array.from(word, (ch, i) => (
                  <span key={i} className="ch" style={{ '--d': order(i), '--p': i / (word.length - 1) } as CSSProperties}>
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </span>
          <span className="tag-rail" aria-hidden="true">
            <i className="tag-rail__l" /><i className="tag-rail__r" />
            <i className="tag-dot tag-dot--l" /><i className="tag-dot tag-dot--r" />
            <i className="tag-pulse" />
          </span>
          <i className="tag-spark" aria-hidden="true" />
        </p>

        <div className="footer__bottom">
          <p>© 2026 HYBENT. All rights reserved.</p>
          <p style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
            <a href="/privacy">Privacy &amp; Terms</a><a href="/cookies">Cookies</a>
          </p>
        </div>
      </div>
      </footer>
    </div>
  )
}
