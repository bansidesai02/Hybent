import { useCallback, useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { HeaderNav } from './HeaderNav'
import { Footer } from './Footer'
import { SvgDefs } from '../ui/SvgDefs'
import { Loader } from '../ui/Loader'
import { useTheme } from '@/hooks/useTheme'
import { useLandingBehaviours } from '@/hooks/useLandingBehaviours'
import '@/styles/hybent.css'

const META: Record<string, { t: string; d: string }> = {
  index: {
    t: 'HYBENT — Enterprise AI Software | Makers of Hybent Hiring',
    d: 'HYBENT builds intelligent software products that simplify business operations using AI. Hybent Hiring, our AI recruitment platform, is live today.',
  },
  products: {
    t: 'Products — Hybent Hiring & the roadmap | HYBENT',
    d: 'Hybent Hiring is our live AI recruitment platform: resume parsing, AI screening, interview management and recruiter copilot. See what is coming next.',
  },
  platform: {
    t: 'Platform — one foundation, every product | HYBENT',
    d: 'Four layers: data foundation, platform services, intelligence and products. Everything above inherits everything below.',
  },
  ai: {
    t: 'AI Capabilities — models inside the workflow | HYBENT',
    d: 'Every HYBENT product is built AI-first. Parsing, screening, ranking and interview assistance happen inside the workflow, and every suggestion can be explained.',
  },
  solutions: {
    t: 'Solutions — start where the pain is loudest | HYBENT',
    d: 'Four ways teams put HYBENT to work: talent acquisition, people operations, hiring managers, and IT & security.',
  },
  industries: {
    t: 'Industries — configured for how your sector hires | HYBENT',
    d: 'Role templates, screening criteria and scoring rubrics tuned by industry — from technology and financial services to healthcare, manufacturing and the public sector.',
  },
  security: {
    t: 'Security & compliance | HYBENT',
    d: 'Security is a property of the platform, not a per-product project. Encryption, role-based access, audit logging and responsible AI controls.',
  },
  customers: {
    t: 'Customers — outcomes, testimonials and integrations | HYBENT',
    d: 'What Hybent Hiring is built to change, how we support customers through go-live, and the systems it connects to.',
  },
  about: {
    t: 'About HYBENT — mission, vision and story',
    d: 'HYBENT is an enterprise software company building intelligent products that simplify business operations using AI. Our mission, vision, values and story.',
  },
  resources: {
    t: 'Resources — insights and frequently asked questions | HYBENT',
    d: 'Notes from the team building HYBENT, plus straight answers to the questions we get asked first.',
  },
  careers: {
    t: 'Careers — build the platform everything else stands on | HYBENT',
    d: 'Join HYBENT early enough to shape the platform. Open roles in engineering, design, sales and customer success in Ahmedabad and remote.',
  },
  contact: {
    t: 'Contact HYBENT — talk to the team',
    d: 'Tell us what you are trying to fix. Someone from the team replies within one business day.',
  },
}

export default function Layout() {
  const { theme, toggleTheme } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const [, route = 'index', frag = ''] = location.pathname.split('/')
  const routeName = route || 'index'

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const toggleDrawer = useCallback(() => setDrawerOpen((open) => !open), [])

  /* Body scroll lock while the drawer is open. */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  /* Close the drawer whenever the view changes. */
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  /* Per-view title + description, and aria-current on the owning nav link. */
  useEffect(() => {
    const meta = META[routeName]
    if (meta) {
      document.title = meta.t
      document.querySelector('meta[name="description"]')?.setAttribute('content', meta.d)
    }
    document.querySelectorAll<HTMLElement>('[data-nav]').forEach((a) => {
      const owns = ` ${a.getAttribute('data-nav')} `.includes(` ${routeName} `)
      if (owns) a.setAttribute('aria-current', 'page')
      else a.removeAttribute('aria-current')
    })
  }, [routeName])

  /* Land on the top of the view, or on the deep-linked section. */
  useEffect(() => {
    const root = document.documentElement
    const prev = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    const target = frag ? document.getElementById(frag) : null
    if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.pageYOffset - 92)
    else window.scrollTo(0, 0)
    root.style.scrollBehavior = prev
  }, [location.pathname, frag])

  /* Attached last so the view is already scrolled into place before the
     reveal observer decides what is on screen. */
  useLandingBehaviours(location.pathname)

  /* Keep the markup's plain <a href> links but route them client-side. */
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const anchor = (e.target as HTMLElement).closest?.('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href || !href.startsWith('/') || anchor.hasAttribute('target') || anchor.hasAttribute('download')) return
    e.preventDefault()
    navigate(href)
  }

  return (
    <div onClick={onClick}>
      <a className="skip" href="#main">Skip to content</a>
      <Loader />
      <SvgDefs />
      <HeaderNav
        theme={theme}
        onToggleTheme={toggleTheme}
        drawerOpen={drawerOpen}
        onToggleDrawer={toggleDrawer}
        onCloseDrawer={closeDrawer}
      />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
