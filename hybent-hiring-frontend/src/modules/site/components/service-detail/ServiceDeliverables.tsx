import React from 'react'
import type { ServiceDeliverable } from '../../data/servicesData'

interface ServiceDeliverablesProps {
  deliverables: ServiceDeliverable[]
  serviceTitle: string
}

export function ServiceDeliverables({ deliverables, serviceTitle }: ServiceDeliverablesProps) {
  return (
    <section className="section" style={{ paddingTop: 'clamp(40px, 6vw, 80px)', paddingBottom: 'clamp(40px, 6vw, 80px)', background: 'rgba(248, 250, 253, 0.6)', borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <div className="section-head center" data-rv="up">
          <p className="eyebrow" style={{ justifyContent: 'center' }}>
            <span className="bars"><i></i><i></i><i></i></span>
            <span>Tangible Outputs</span>
          </p>
          <h2 className="h-lg" style={{ marginTop: '12px' }}>
            What You Receive
          </h2>
          <p className="lead">
            Concrete, documented, and production-tested deliverables that provide lasting institutional value for {serviceTitle}.
          </p>
        </div>

        <div className="grid g3" style={{ gap: '18px', marginTop: '36px' }}>
          {deliverables.map((item, idx) => (
            <div
              key={idx}
              className="card card--flat"
              style={{
                padding: '24px 22px',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)',
                background: 'linear-gradient(160deg, #FFFFFF, rgba(248, 250, 253, 0.9))',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              data-rv="up"
              data-delay={String((idx % 3) * 60)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'rgba(34, 207, 255, 0.12)',
                      color: 'var(--cyan)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                  <h3 className="h-sm" style={{ margin: 0, fontSize: '1.05rem' }}>
                    {item.title}
                  </h3>
                </div>
                <p className="small" style={{ color: 'var(--muted)', lineHeight: 1.55, marginBottom: '16px' }}>
                  {item.description}
                </p>
              </div>

              <div
                style={{
                  borderTop: '1px dashed var(--border)',
                  paddingTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--f-mono)',
                  color: 'var(--dim)',
                }}
              >
                <span>Format</span>
                <span style={{ color: 'var(--blue)', fontWeight: 600 }}>{item.format}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
