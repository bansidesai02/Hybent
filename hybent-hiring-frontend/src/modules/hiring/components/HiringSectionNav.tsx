import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AUTH, PRODUCTS } from '@/app/paths'

/**
 * In-page section navigation for the Hybent Hiring product view.
 *
 * The platform has exactly one global navigation bar (GlobalNav). Rather than
 * stacking a second product header under it, the product's own links become
 * section navigation for the page they belong to, and the Sign In entry point
 * lives here — the first place in the journey where authentication makes sense.
 */
/**
 * Every section the page can offer. Testimonials and pricing ship commented out
 * today, so the list is filtered against the DOM on mount — uncommenting a
 * section is enough to bring its link back, and a link never points at nothing.
 */
const SECTIONS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'features', label: 'Features' },
  { id: 'about', label: 'About' },
  { id: 'testimonials', label: 'Customers' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faqs', label: 'FAQs' },
] as const

export function HiringSectionNav() {
  const [sections, setSections] = useState<Array<{ id: string; label: string }>>([])
  const [active, setActive] = useState<string>('')

  useEffect(() => {
    const present = SECTIONS.filter((s) => document.getElementById(s.id))
    setSections(present)

    const targets = present
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (!targets.length || !('IntersectionObserver' in window)) return

    /* Highlight the section the reader is actually in. */
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    )
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const goTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <nav className="hb-subnav" aria-label="Hybent Hiring sections">
      <div className="hb-subnav__in">
        {/* Sits directly under the HYBENT wordmark, so the parent brand reads
            first and the product you are inside reads second. */}
        <Link to={PRODUCTS.hiring} className="hb-subnav__product">
          Hybent Hiring
        </Link>

        <ul className="hb-subnav__links">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                className="hb-subnav__link"
                aria-current={active === section.id ? 'true' : undefined}
                onClick={() => goTo(section.id)}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="hb-subnav__cta">
          <Link
            to={AUTH.login}
            className="px-5 py-2 rounded-[12px] text-[14px] font-bold no-underline transition-all duration-200 hover:bg-[rgba(108,71,255,0.06)] active:scale-95"
            style={{
              border: '1px solid rgba(108,71,255,0.25)',
              color: '#6c47ff',
              fontFamily: "'Sora', sans-serif",
            }}
          >
            Sign In
          </Link>
          <Link
            to={AUTH.register}
            className="hidden sm:inline-block px-6 py-2 rounded-[12px] text-[14px] font-bold text-white no-underline transition-all duration-200 hover:-translate-y-[1px] active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #6c47ff, #8b6bff)',
              boxShadow: '0 4px 16px rgba(108,71,255,0.35)',
              fontFamily: "'Sora', sans-serif",
            }}
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </nav>
  )
}
