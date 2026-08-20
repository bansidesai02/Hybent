import React from 'react'
import { Link } from 'react-router-dom'
import { getServiceBySlug } from '../../data/servicesData'

interface ServiceRelatedProps {
  relatedSlugs: string[]
  currentTitle: string
}

export function ServiceRelated({ relatedSlugs, currentTitle }: ServiceRelatedProps) {
  const relatedServices = relatedSlugs
    .map((slug) => getServiceBySlug(slug))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .slice(0, 3)

  if (!relatedServices.length) return null

  return (
    <section className="section" style={{ paddingTop: 'clamp(40px, 5vw, 64px)', paddingBottom: 'clamp(40px, 5vw, 64px)', background: 'rgba(248, 250, 253, 0.6)', borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <span className="badge" style={{ fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
              Explore Next
            </span>
            <h2 className="h-sm" style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A' }}>
              Related Solutions
            </h2>
          </div>
          <Link to="/services" className="link-arrow" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--blue)' }}>
            <span>View All 20 Services</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </Link>
        </div>

        <div className="grid g3" style={{ gap: '16px' }}>
          {relatedServices.map((svc, idx) => (
            <Link
              key={svc.slug}
              to={`/services/${svc.slug}`}
              className="card card--interactive"
              style={{
                padding: '20px 18px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                background: '#FFFFFF',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              data-rv="up"
              data-delay={String(idx * 40)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span className="badge" style={{ fontSize: '8.5px', textTransform: 'uppercase', padding: '2px 7px', background: 'rgba(241, 245, 249, 0.9)' }}>
                    {svc.categoryLabel}
                  </span>
                </div>

                <h3 className="h-sm" style={{ margin: '0 0 6px', fontSize: '1.02rem', color: '#0F172A', fontWeight: 700 }}>
                  {svc.title}
                </h3>
                <p className="small" style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.45, fontSize: '0.82rem' }}>
                  {svc.summary}
                </p>
              </div>

              <div
                style={{
                  marginTop: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--blue)',
                }}
              >
                <span>Learn More</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
