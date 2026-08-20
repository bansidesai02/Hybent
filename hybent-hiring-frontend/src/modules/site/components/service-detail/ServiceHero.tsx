import React from 'react'
import { Link } from 'react-router-dom'
import type { ServiceDetail } from '../../data/servicesData'
import { ServiceHeroVisual } from './ServiceHeroVisual'

interface ServiceHeroProps {
  service: ServiceDetail
}

export function ServiceHero({ service }: ServiceHeroProps) {
  return (
    <section className="hero" style={{ paddingTop: 'calc(var(--nav-h) + clamp(28px, 4vw, 48px))', paddingBottom: 'clamp(40px, 5vw, 64px)' }}>
      <div className="hero__orb orb-a" data-para="0.02"></div>
      <div className="hero__orb orb-b" data-para="-0.03"></div>

      <div className="wrap">
        {/* Breadcrumbs: Home -> Services -> Service Name */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: '20px' }} data-rv="up">
          <ol
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.82rem',
              color: 'var(--muted)',
              padding: 0,
              margin: 0,
              listStyle: 'none',
              fontFamily: 'var(--f-mono)',
            }}
          >
            <li>
              <Link to="/" style={{ color: 'var(--muted)', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cyan)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}>
                Home
              </Link>
            </li>
            <li aria-hidden="true" style={{ opacity: 0.5 }}>/</li>
            <li>
              <Link to="/services" style={{ color: 'var(--muted)', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cyan)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}>
                Services
              </Link>
            </li>
            <li aria-hidden="true" style={{ opacity: 0.5 }}>/</li>
            <li style={{ color: 'var(--text)', fontWeight: 600 }}>{service.title}</li>
          </ol>
        </nav>

        {/* 2-Column Split: Text on Left, Architecture Visual on Right */}
        <div className="split" style={{ alignItems: 'center', gap: 'clamp(32px, 5vw, 64px)' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }} data-rv="up">
              <span className="badge badge--live" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                <i className="dot dot--pulse"></i>
                {service.categoryLabel}
              </span>
              <span className="badge" style={{ fontSize: '10px', letterSpacing: '0.08em' }}>
                {service.badge}
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2.2rem, 4.2vw, 3.5rem)',
                fontWeight: 700,
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                marginBottom: '18px',
              }}
              data-rv="up"
              data-delay="60"
            >
              {service.heroHeadline}
            </h1>

            <p className="hero__sub" style={{ fontSize: 'clamp(1rem, 1.2vw, 1.15rem)', lineHeight: 1.65, color: 'var(--muted)', marginBottom: '28px', maxWidth: '58ch' }} data-rv="up" data-delay="120">
              {service.heroSubheadline}
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '32px' }} data-rv="up" data-delay="180">
              <Link to={`/contact?service=${encodeURIComponent(service.title)}`} className="btn btn-primary btn-lg">
                <span>{service.primaryCta}</span>
                <svg className="arw" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
              <a href="#capabilities" className="btn btn-ghost btn-lg">
                <span>{service.secondaryCta}</span>
              </a>
            </div>

            {/* Trust Chips Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '18px', borderTop: '1px solid var(--border)' }} data-rv="up" data-delay="240">
              {service.trustChips.map((chip, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--f-mono)',
                    color: 'var(--dim)',
                    background: 'rgba(255, 255, 255, 0.6)',
                    border: '1px solid var(--border)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* Right Column: Interactive / Tech Visual Component */}
          <div data-rv="scale" data-delay="160">
            <ServiceHeroVisual visualType={service.visualType} title={service.title} />
          </div>
        </div>
      </div>
    </section>
  )
}
