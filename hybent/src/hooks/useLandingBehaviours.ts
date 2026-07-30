import { useEffect } from 'react'

/**
 * Every progressive enhancement the static page shipped with, re-attached
 * whenever the router swaps a view in. Each effect is fully torn down on
 * unmount so navigating away never leaves a stray observer or listener.
 */
export function useLandingBehaviours(routeKey: string) {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(pointer:fine)').matches
    const cleanups: Array<() => void> = []

    /* ---------- Scroll reveal + counters + mock meters ---------- */
    const revealables = document.querySelectorAll<HTMLElement>('[data-rv]')
    const counters = document.querySelectorAll<HTMLElement>('[data-count]')
    const mock = document.getElementById('mock')

    const countUp = (el: HTMLElement) => {
      const target = parseFloat(el.getAttribute('data-count') || '') || 0
      const suffix = el.getAttribute('data-suffix') || ''
      const dur = 1500
      const start = performance.now()
      const step = (now: number) => {
        const p = Math.min((now - start) / dur, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        el.textContent = Math.round(target * eased).toLocaleString('en-US') + (p === 1 ? suffix : '')
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }

    if (!('IntersectionObserver' in window) || reduce) {
      revealables.forEach((el) => el.classList.add('in'))
      counters.forEach((el) => {
        el.textContent = (el.getAttribute('data-count') || '') + (el.getAttribute('data-suffix') || '')
      })
      mock?.classList.add('in')
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (!en.isIntersecting) return
            const el = en.target as HTMLElement
            el.style.transitionDelay = `${el.getAttribute('data-delay') || 0}ms`
            el.classList.add('in')
            io.unobserve(el)
          })
        },
        { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
      )
      revealables.forEach((el) => io.observe(el))
      cleanups.push(() => io.disconnect())

      const cio = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (!en.isIntersecting) return
            countUp(en.target as HTMLElement)
            cio.unobserve(en.target)
          })
        },
        { threshold: 0.5 }
      )
      counters.forEach((el) => cio.observe(el))
      cleanups.push(() => cio.disconnect())

      if (mock) {
        const mio = new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              if (!en.isIntersecting) return
              en.target.classList.add('in')
              mio.unobserve(en.target)
            })
          },
          { threshold: 0.3 }
        )
        mio.observe(mock)
        cleanups.push(() => mio.disconnect())
      }
    }

    /* ---------- Hero headline rotator ---------- */
    const rot = document.querySelector('.hero h1 .rot')
    if (rot && !reduce) {
      const items = Array.from(rot.querySelectorAll('span'))
      let idx = 0
      const timer = window.setInterval(() => {
        items[idx].classList.remove('on')
        items[idx].classList.add('out')
        const prev = idx
        window.setTimeout(() => items[prev].classList.remove('out'), 750)
        idx = (idx + 1) % items.length
        items[idx].classList.add('on')
      }, 3200)
      cleanups.push(() => window.clearInterval(timer))
    }

    /* ---------- Solutions tabs ---------- */
    const tabs = Array.from(document.querySelectorAll<HTMLElement>('.tab'))
    const selectTab = (tab: HTMLElement) => {
      tabs.forEach((t) => {
        const on = t === tab
        t.setAttribute('aria-selected', String(on))
        const panel = document.getElementById(t.getAttribute('aria-controls') || '')
        if (!panel) return
        panel.classList.toggle('on', on)
        if (on) panel.removeAttribute('hidden')
        else panel.setAttribute('hidden', '')
      })
    }
    tabs.forEach((tab, i) => {
      const onClick = () => selectTab(tab)
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
        e.preventDefault()
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
        next.focus()
        selectTab(next)
      }
      tab.addEventListener('click', onClick)
      tab.addEventListener('keydown', onKeyDown)
      cleanups.push(() => {
        tab.removeEventListener('click', onClick)
        tab.removeEventListener('keydown', onKeyDown)
      })
    })

    /* ---------- Mouse parallax (hero orbs + lattice) ---------- */
    if (!reduce && finePointer) {
      const orbs = Array.from(document.querySelectorAll<HTMLElement>('[data-para]'))
      const lattice = document.getElementById('lattice')
      if (orbs.length || lattice) {
        let tx = 0
        let ty = 0
        let cx = 0
        let cy = 0
        let ticking = false
        const loop = () => {
          cx += (tx - cx) * 0.06
          cy += (ty - cy) * 0.06
          orbs.forEach((o) => {
            const f = parseFloat(o.getAttribute('data-para') || '0') * 900
            o.style.transform = `translate3d(${cx * f}px,${cy * f}px,0)`
          })
          if (lattice) {
            lattice.style.transform = `translate3d(${cx * -14}px,${cy * -14}px,0) rotateX(${cy * -3}deg) rotateY(${cx * 3}deg)`
          }
          if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) requestAnimationFrame(loop)
          else ticking = false
        }
        const onMove = (e: MouseEvent) => {
          tx = e.clientX / window.innerWidth - 0.5
          ty = e.clientY / window.innerHeight - 0.5
          if (!ticking) {
            ticking = true
            requestAnimationFrame(loop)
          }
        }
        window.addEventListener('mousemove', onMove, { passive: true })
        cleanups.push(() => window.removeEventListener('mousemove', onMove))
      }
    }

    /* ---------- Card glow follows cursor ---------- */
    if (!reduce && finePointer) {
      document.querySelectorAll<HTMLElement>('.card').forEach((card) => {
        const glow = card.querySelector<HTMLElement>('.card__glow')
        if (!glow) return
        const onMove = (e: MouseEvent) => {
          const r = card.getBoundingClientRect()
          glow.style.left = `${e.clientX - r.left - 110}px`
          glow.style.top = `${e.clientY - r.top - 110}px`
          glow.style.right = 'auto'
          glow.style.bottom = 'auto'
        }
        card.addEventListener('mousemove', onMove)
        cleanups.push(() => card.removeEventListener('mousemove', onMove))
      })
    }

    /* ---------- Forms (demo handlers) ---------- */
    const wireForm = (formId: string, toastId: string, emailId: string) => {
      const form = document.getElementById(formId) as HTMLFormElement | null
      const toast = document.getElementById(toastId)
      if (!form || !toast) return
      let hideTimer: number | undefined
      const onSubmit = (e: Event) => {
        e.preventDefault()
        const email = document.getElementById(emailId) as HTMLInputElement | null
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value)) {
          email.focus()
          email.style.borderColor = 'rgba(255,107,129,.7)'
          return
        }
        if (email) email.style.borderColor = ''
        toast.classList.add('on')
        form.reset()
        window.clearTimeout(hideTimer)
        hideTimer = window.setTimeout(() => toast.classList.remove('on'), 5000)
      }
      form.addEventListener('submit', onSubmit)
      cleanups.push(() => {
        window.clearTimeout(hideTimer)
        form.removeEventListener('submit', onSubmit)
      })
    }
    wireForm('contactForm', 'contactToast', 'cf-email')
    wireForm('newsForm', 'newsToast', 'nf-email')

    /* ---------- FAQ: one open at a time ---------- */
    const faqs = Array.from(document.querySelectorAll<HTMLDetailsElement>('.faq details'))
    faqs.forEach((d) => {
      const onToggle = () => {
        if (!d.open) return
        faqs.forEach((o) => {
          if (o !== d) o.open = false
        })
      }
      d.addEventListener('toggle', onToggle)
      cleanups.push(() => d.removeEventListener('toggle', onToggle))
    })

    return () => cleanups.forEach((fn) => fn())
  }, [routeKey])
}
