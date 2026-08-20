import React from 'react'
import type { ServiceProcessStep } from '../../data/servicesData'

interface ServiceProcessProps {
  process: ServiceProcessStep[]
  serviceTitle: string
}

export function ServiceProcess({ process, serviceTitle }: ServiceProcessProps) {
  return (
    <section className="section" style={{ paddingTop: 'clamp(48px, 6vw, 80px)', paddingBottom: 'clamp(48px, 6vw, 80px)', borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <div className="section-head center" data-rv="up">
          <p className="eyebrow" style={{ justifyContent: 'center' }}>
            <span className="bars"><i></i><i></i><i></i></span>
            <span>Execution Process</span>
          </p>
          <h2 className="h-lg" style={{ marginTop: '12px', fontSize: 'clamp(1.8rem, 3.2vw, 2.4rem)' }}>
            How We Deliver &amp; Scale
          </h2>
          <p className="lead" style={{ maxWidth: '600px', marginInline: 'auto' }}>
            A transparent, sprint-based delivery methodology with weekly working demos and zero surprises.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginTop: '36px',
          }}
        >
          {process.map((step, idx) => (
            <div
              key={idx}
              className="card card--flat"
              style={{
                padding: '22px 18px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                background: 'linear-gradient(160deg, #FFFFFF, rgba(248, 250, 253, 0.9))',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              data-rv="up"
              data-delay={String(idx * 50)}
            >
              <div>
                <span
                  style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--blue)',
                    background: 'rgba(76, 111, 255, 0.08)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    display: 'inline-block',
                    marginBottom: '12px',
                  }}
                >
                  PHASE {step.number}
                </span>

                <h3 className="h-sm" style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#0F172A', fontWeight: 700 }}>
                  {step.title}
                </h3>
                <p className="small" style={{ color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5, fontSize: '0.84rem' }}>
                  {step.description}
                </p>
              </div>

              <div
                style={{
                  background: 'rgba(241, 245, 249, 0.8)',
                  borderLeft: '3px solid var(--cyan)',
                  borderRadius: '0 6px 6px 0',
                  padding: '8px 10px',
                  fontSize: '0.78rem',
                  color: '#334155',
                  fontWeight: 600,
                }}
              >
                {step.deliverableSummary}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
