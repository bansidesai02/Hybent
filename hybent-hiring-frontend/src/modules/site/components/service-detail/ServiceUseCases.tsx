import React from 'react'
import type { ServiceUseCase } from '../../data/servicesData'

interface ServiceUseCasesProps {
  useCases: ServiceUseCase[]
  serviceTitle: string
}

export function ServiceUseCases({ useCases, serviceTitle }: ServiceUseCasesProps) {
  // Show top 3 use cases
  const displayUseCases = useCases.slice(0, 3)

  return (
    <section className="section" style={{ paddingTop: 'clamp(48px, 6vw, 80px)', paddingBottom: 'clamp(48px, 6vw, 80px)', background: 'rgba(248, 250, 253, 0.6)', borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <div className="section-head center" data-rv="up">
          <p className="eyebrow" style={{ justifyContent: 'center' }}>
            <span className="bars"><i></i><i></i><i></i></span>
            <span>Proven Outcomes</span>
          </p>
          <h2 className="h-lg" style={{ marginTop: '12px', fontSize: 'clamp(1.8rem, 3.2vw, 2.4rem)' }}>
            Real-World Impact &amp; Results
          </h2>
          <p className="lead" style={{ maxWidth: '600px', marginInline: 'auto' }}>
            See how enterprise leaders leverage {serviceTitle} to drive efficiency and top-line growth.
          </p>
        </div>

        <div className="grid g3" style={{ gap: '18px', marginTop: '36px' }}>
          {displayUseCases.map((uc, i) => (
            <div
              key={i}
              className="card card--flat"
              style={{
                padding: '24px 20px',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)',
                background: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              data-rv="up"
              data-delay={String(i * 50)}
            >
              <div>
                <span className="badge" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', background: 'rgba(241, 245, 249, 0.9)' }}>
                  {uc.industry}
                </span>

                <h3 className="h-sm" style={{ margin: '0 0 10px', fontSize: '1.08rem', lineHeight: 1.3, fontWeight: 700, color: '#0F172A' }}>
                  {uc.title}
                </h3>

                <p className="small" style={{ color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5, fontSize: '0.86rem' }}>
                  {uc.solution}
                </p>
              </div>

              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--r-sm)',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: '0.68rem', fontFamily: 'var(--f-mono)', color: '#059669', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '2px' }}>
                  Key Result
                </div>
                <div style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 600, lineHeight: 1.4 }}>
                  {uc.outcome}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
