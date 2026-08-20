import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { AUTH, PRODUCTS } from '@/app/paths'
import SolutionsMegaMenu from '@/components/SolutionsMegaMenu'

type GlobalNavProps = {
  drawerOpen: boolean
  onToggleDrawer: () => void
  onCloseDrawer: () => void
  /** The view being rendered below. Only the home view floats the bar over its
      hero, so the CSS needs to know which one is on screen. */
  route: string
}

/* The mega panel sits 12px below its trigger. Opening is immediate; closing
   waits, and is cancelled the moment the pointer re-enters trigger or panel. */
const CLOSE_DELAY = 220

export function GlobalNav({
  drawerOpen,
  onToggleDrawer,
  onCloseDrawer,
  route,
}: GlobalNavProps) {
  const headerRef = useRef<HTMLElement>(null)

  /* ---------- Sticky nav ---------- */
  useEffect(() => {
    const nav = headerRef.current
    if (!nav) return
    const onScroll = () => nav.classList.toggle('stuck', window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* ---------- Mega menu: hover intent ---------- */
  useEffect(() => {
    const root = headerRef.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('.has-mega'))
    const cleanups: Array<() => void> = []

    const closeMega = (item: HTMLElement) => {
      item.classList.remove('is-open')
      item.querySelector('.navlink')?.setAttribute('aria-expanded', 'false')
    }

    items.forEach((item) => {
      const trigger = item.querySelector<HTMLElement>('.navlink')
      let timer: number | undefined

      const open = () => {
        window.clearTimeout(timer)
        items.forEach((other) => other !== item && closeMega(other))
        item.classList.add('is-open')
        trigger?.setAttribute('aria-expanded', 'true')
      }
      const closeSoon = () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => closeMega(item), CLOSE_DELAY)
      }
      const onFocusOut = (e: FocusEvent) => {
        if (!item.contains(e.relatedTarget as Node)) closeMega(item)
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && item.classList.contains('is-open')) {
          closeMega(item)
          trigger?.focus()
        }
      }

      item.addEventListener('mouseenter', open)
      item.addEventListener('mouseleave', closeSoon)
      item.addEventListener('focusin', open)
      item.addEventListener('focusout', onFocusOut)
      item.addEventListener('keydown', onKeyDown)
      cleanups.push(() => {
        window.clearTimeout(timer)
        item.removeEventListener('mouseenter', open)
        item.removeEventListener('mouseleave', closeSoon)
        item.removeEventListener('focusin', open)
        item.removeEventListener('focusout', onFocusOut)
        item.removeEventListener('keydown', onKeyDown)
      })
    })

    const onDocClick = (e: MouseEvent) => {
      const inside = (e.target as Element)?.closest?.('.has-mega')
      items.forEach((item) => item !== inside && closeMega(item))
    }
    document.addEventListener('click', onDocClick)

    return () => {
      cleanups.forEach((fn) => fn())
      document.removeEventListener('click', onDocClick)
    }
  }, [])

  /* ---------- Escape closes the drawer ---------- */
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseDrawer()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen, onCloseDrawer])

  /* ---------- Premium CTA ripple ----------
     Purely additive decoration. The anchors keep their native href, so
     routing and keyboard activation are unaffected. */
  const onRipple = (e: ReactPointerEvent<HTMLElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const btn = e.currentTarget
    const r = btn.getBoundingClientRect()
    if (!r.width || !r.height) return
    const size = Math.max(r.width, r.height) * 2.2
    const rip = document.createElement('span')
    rip.className = 'rip'
    rip.style.width = rip.style.height = `${size}px`
    rip.style.left = `${e.clientX - r.left}px`
    rip.style.top = `${e.clientY - r.top}px`
    btn.appendChild(rip)
    const done = () => rip.parentNode?.removeChild(rip)
    rip.addEventListener('animationend', done)
    window.setTimeout(done, 800)
  }

  return (
    /* `hb-site` scopes the company design tokens to the chrome; `hb-chrome`
       stops it from painting a page background over product views. */
    <div className="hb-site hb-chrome" data-route={route}>
      {/* `data-drawer` rather than a class: the sticky-nav effect owns the
          `stuck` class through classList, and a className change here would
          wipe it. */}
      <header
        className="nav"
        id="nav"
        ref={headerRef}
        data-drawer={drawerOpen ? 'open' : undefined}
      >
        <div className="wrap nav__in">
          <a className="brand" href="/" aria-label="HYBENT home">
            <img className="mk" src="/hybent/hybent-mark.png" alt="HYBENT" />
            <img className="wm t-dark" src="/hybent/hybent-wordmark-dark.png" alt="" /><img className="wm t-light" src="/hybent/hybent-wordmark-light.png" alt="" />
          </a>

          <nav aria-label="Primary">
            <ul className="nav__links">
              <li className="has-mega">
                <a className="navlink" href="/products" aria-haspopup="true" aria-expanded="false" data-nav="products hiring">Products <svg className="chev" aria-hidden="true"><use href="#i-chev" /></svg></a>
                <div className="mega mega--sm">
                  <div className="mega__grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="mega__item mega__item--linked mega__item--full">
                      {/* Stretched hit area: the whole card opens the product, while
                          the action links below stay individually clickable. Hidden
                          from assistive tech so the card announces one link, not two. */}
                      <a className="mega__item-hit" href={PRODUCTS.hiring} tabIndex={-1} aria-hidden="true"></a>
                      <span className="icon-tile"><svg aria-hidden="true"><use href="#i-users" /></svg></span>
                      <span><h5>Hybent Hiring <span className="badge badge--live"><i className="dot dot--pulse"></i>Live</span></h5><p>AI recruitment platform — resume parsing, AI screening, interview management and offers in one pipeline.</p>
                        <span className="mega__acts"><a href="/products/hiring">Learn more <svg width="13" height="13" aria-hidden="true"><use href="#i-arrow" /></svg></a><a href="/products/hiring">Open product <svg width="13" height="13" aria-hidden="true"><use href="#i-arrow" /></svg></a></span>
                      </span>
                    </div>
                  </div>
                  <div className="mega__foot">
                    <p className="small">Hybent Hiring is our flagship AI recruitment platform.</p>
                    <a className="link-arrow" href="/products/hiring">Explore product <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
                  </div>
                </div>
              </li>
              <SolutionsMegaMenu />
              <li><a className="navlink" href="/customers" data-nav="customers">Customers</a></li>
              <li className="has-mega">
                <a className="navlink" href="/about" aria-haspopup="true" aria-expanded="false" data-nav="about careers contact security faq">Company <svg className="chev" aria-hidden="true"><use href="#i-chev" /></svg></a>
                <div className="mega mega--sm">
                  <div className="mega__grid">
                    <a className="mega__item" href="/about">
                      <span className="icon-tile"><svg aria-hidden="true"><use href="#i-eye" /></svg></span>
                      <span><h5>About Hybent</h5><p>Who we are, what we believe, and how the company is being built.</p></span>
                    </a>
                    <a className="mega__item" href="/security">
                      <span className="icon-tile"><svg aria-hidden="true"><use href="#i-shield" /></svg></span>
                      <span><h5>Security</h5><p>The controls every Hybent product inherits on the day it launches.</p></span>
                    </a>
                    <a className="mega__item" href="/careers">
                      <span className="icon-tile"><svg aria-hidden="true"><use href="#i-brief" /></svg></span>
                      <span><h5>Careers</h5><p>Join early enough to shape the platform everything else is built on.</p></span>
                    </a>
                    <a className="mega__item" href="/contact">
                      <span className="icon-tile"><svg aria-hidden="true"><use href="#i-mail" /></svg></span>
                      <span><h5>Contact</h5><p>Tell us what you are trying to fix. We reply within one business day.</p></span>
                    </a>
                    {/* Odd one out in a two-column grid, so it spans the row
                        rather than sitting orphaned beside a gap. */}
                    <a className="mega__item mega__item--full" href="/faq">
                      <span className="icon-tile"><svg aria-hidden="true"><use href="#i-doc" /></svg></span>
                      <span><h5>FAQ</h5><p>Straight answers on what is live today, how pricing works, and what happens to your data.</p></span>
                    </a>
                  </div>
                  <div className="mega__foot">
                    <p className="small">Building a global multi-product technology company, one release at a time.</p>
                    <a className="link-arrow" href="/about">Our story <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
                  </div>
                </div>
              </li>
            </ul>
          </nav>

          <div className="nav__cta">
            <a className="btn btn-quiet btn-sm" href={AUTH.login}>Log in</a>
            <a className="btn btn-primary btn-sm" href="/contact" onPointerDown={onRipple}>Get in Touch</a>
            <button
              className={drawerOpen ? 'burger open' : 'burger'}
              id="burger"
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={drawerOpen}
              aria-controls="drawer"
              onClick={onToggleDrawer}
            ><span></span></button>
          </div>
        </div>
      </header>

      <div
        className={drawerOpen ? 'drawer open' : 'drawer'}
        id="drawer"
        onClick={(e) => {
          if ((e.target as HTMLElement).tagName === 'A') onCloseDrawer()
        }}
      >
        <p className="mono" style={{ margin: '6px 0 4px', color: 'var(--dim)' }}>Products</p>
        <a href="/products/hiring">Hybent Hiring</a>
        <p className="mono" style={{ margin: '22px 0 4px', color: 'var(--dim)' }}>Solutions</p>
        <a href="/services">Services</a>
        <a href="/industries">Industries</a>
        <a href="/hire-talent">Hire Talent</a>
        <p className="mono" style={{ margin: '22px 0 4px', color: 'var(--dim)' }}>Explore</p>
        <a href="/solutions">Solutions Overview</a>
        <a href="/customers">Customers</a>
        <p className="mono" style={{ margin: '22px 0 4px', color: 'var(--dim)' }}>Company</p>
        <a href="/about">About</a>
        <a href="/security">Security</a>
        <a href="/careers">Careers</a>
        <a href="/faq">FAQ</a>
        <a href="/contact">Contact</a>
        <div className="drawer__cta">
          {/* The header's Log in is hidden under 860px, so the drawer carries it. */}
          <a className="btn btn-ghost btn-lg" href={AUTH.login}>Log in</a>
          <a className="btn btn-ghost btn-lg" href="/products/hiring">Explore Hybent Hiring</a>
          <a className="btn btn-primary btn-lg" href="/contact" onPointerDown={onRipple}>Get in Touch</a>
        </div>
      </div>
    </div>
  )
}
