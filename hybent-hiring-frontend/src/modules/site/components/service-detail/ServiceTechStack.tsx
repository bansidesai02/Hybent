import React from 'react'
import type { ServiceTechCategory } from '../../data/servicesData'

interface ServiceTechStackProps {
  technologies: ServiceTechCategory[]
  serviceTitle: string
}

export function ServiceTechStack({ technologies, serviceTitle }: ServiceTechStackProps) {
  return (
    <section className="section" style={{ paddingTop: 'clamp(40px, 6vw, 80px)', paddingBottom: 'clamp(40px, 6vw, 80px)', background: 'rgba(248, 250, 253, 0.6)', borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <div className="section-head center" data-rv="up">
          <p className="eyebrow" style={{ justifyContent: 'center' }}>
            <span className="bars"><i></i><i></i><i></i></span>
            <span>Technology Ecosystem</span>
          </p>
          <h2 className="h-lg" style={{ marginTop: '12px' }}>
            Tools &amp; Frameworks We Leverage
          </h2>
          <p className="lead">
            Technologies, platforms, and industry-standard tools commonly orchestrated across our {serviceTitle} engagements.
          </p>
        </div>

        <div className="grid g2" style={{ gap: '20px', marginTop: '36px' }}>
          {technologies.map((cat, idx) => (
            <div
              key={idx}
              className="card card--flat"
              style={{
                padding: '24px 22px',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)',
                background: 'linear-gradient(160deg, #FFFFFF, rgba(248, 250, 253, 0.9))',
              }}
              data-rv="up"
              data-delay={String(idx * 60)}
            >
              <h3 className="h-sm" style={{ fontSize: '1.05rem', margin: '0 0 16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cyan)' }}></span>
                {cat.category}
              </h3>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {cat.items.map((tech, tIdx) => (
                  <span
                    key={tIdx}
                    style={{
                      fontFamily: 'var(--f-mono)',
                      fontSize: '0.82rem',
                      color: '#334155',
                      background: 'rgba(241, 245, 249, 0.9)',
                      border: '1px solid rgba(203, 213, 225, 0.8)',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontWeight: 500,
                    }}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
