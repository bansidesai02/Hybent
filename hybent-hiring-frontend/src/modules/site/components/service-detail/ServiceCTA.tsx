import React from 'react'
import { Link } from 'react-router-dom'

interface ServiceCTAProps {
  serviceTitle: string
  primaryCta: string
}

export function ServiceCTA({ serviceTitle, primaryCta }: ServiceCTAProps) {
  return (
    <section className="section" style={{ paddingTop: 'clamp(48px, 6vw, 96px)', paddingBottom: 'clamp(48px, 6vw, 96px)', background: 'linear-gradient(180deg, rgba(248, 250, 253, 0.6), #FFFFFF)' }}>
      <div className="wrap">
        <div
          className="cta-panel"
          style={{
            position: 'relative',
            padding: 'clamp(36px, 6vw, 64px) clamp(24px, 5vw, 56px)',
            borderRadius: 'var(--r-xl)',
            background: 'linear-gradient(135deg, #0B0F19 0%, #151E32 50%, #0B1120 100%)',
            color: '#FFFFFF',
            overflow: 'hidden',
            boxShadow: '0 24px 64px -20px rgba(15, 23, 42, 0.35)',
            textAlign: 'center',
          }}
          data-rv="scale"
        >
          {/* Subtle Ambient Glow Orbs */}
          <div
            style={{
              position: 'absolute',
              top: '-50%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '400px',
              height: '300px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(34, 207, 255, 0.25), transparent 70%)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          ></div>
          <div
            style={{
              position: 'absolute',
              bottom: '-50%',
              right: '10%',
              width: '350px',
              height: '250px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(168, 85, 247, 0.2), transparent 70%)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          ></div>

          <div style={{ position: 'relative', zIndex: 2, maxWidth: '640px', marginInline: 'auto' }}>
            <span
              className="badge"
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: 'var(--cyan)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                marginBottom: '18px',
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Enterprise Consultation
            </span>

            <h2
              style={{
                fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)',
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
                marginBottom: '16px',
              }}
            >
              Ready to Accelerate Your {serviceTitle}?
            </h2>

            <p
              style={{
                fontSize: 'clamp(0.95rem, 1.2vw, 1.1rem)',
                lineHeight: 1.6,
                color: 'rgba(226, 232, 240, 0.8)',
                marginBottom: '32px',
              }}
            >
              Speak directly with a senior HYBENT software architect. We will review your current technical state, evaluate feasibility, and map out a high-impact execution plan.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px' }}>
              <Link
                to={`/contact?service=${encodeURIComponent(serviceTitle)}`}
                className="btn btn-primary btn-lg"
                style={{ background: 'var(--grad)', color: '#05060B', fontWeight: 700, border: 'none' }}
              >
                <span>{primaryCta}</span>
                <svg className="arw" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
              <Link
                to="/services"
                className="btn btn-ghost btn-lg"
                style={{ color: '#FFFFFF', borderColor: 'rgba(255, 255, 255, 0.25)', background: 'rgba(255, 255, 255, 0.05)' }}
              >
                <span>View All 20 Services</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
