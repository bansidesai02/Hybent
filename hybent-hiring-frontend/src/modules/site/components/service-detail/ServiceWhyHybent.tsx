import React from 'react'
import type { ServiceWhyPoint } from '../../data/servicesData'

interface ServiceWhyHybentProps {
  whyHybent: ServiceWhyPoint[]
  serviceTitle: string
}

export function ServiceWhyHybent({ whyHybent, serviceTitle }: ServiceWhyHybentProps) {
  return (
    <section className="section" style={{ paddingTop: 'clamp(40px, 6vw, 80px)', paddingBottom: 'clamp(40px, 6vw, 80px)', borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <div className="section-head center" data-rv="up">
          <p className="eyebrow" style={{ justifyContent: 'center' }}>
            <span className="bars"><i></i><i></i><i></i></span>
            <span>Why Choose HYBENT</span>
          </p>
          <h2 className="h-lg" style={{ marginTop: '12px' }}>
            The HYBENT Engineering Advantage
          </h2>
          <p className="lead">
            We operate as an extension of your leadership team — combining technical depth, rigorous security standards, and rapid commercial execution in {serviceTitle}.
          </p>
        </div>

        <div className="grid g2" style={{ gap: '20px', marginTop: '36px' }}>
          {whyHybent.map((item, idx) => (
            <div
              key={idx}
              className="card card--flat"
              style={{
                padding: '24px 22px',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)',
                background: 'linear-gradient(160deg, #FFFFFF, rgba(248, 250, 253, 0.9))',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
              }}
              data-rv="up"
              data-delay={String(idx * 60)}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'var(--grad)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#05060B',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  flexShrink: 0,
                  boxShadow: '0 6px 16px rgba(76, 111, 255, 0.25)',
                }}
              >
                0{idx + 1}
              </div>

              <div>
                <h3 className="h-sm" style={{ margin: '0 0 6px', fontSize: '1.15rem' }}>
                  {item.title}
                </h3>
                <p className="small" style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
