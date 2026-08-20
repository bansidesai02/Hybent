import React from 'react'
import type { ServiceCapability, ServiceValueProp } from '../../data/servicesData'

interface ServiceCapabilitiesProps {
  capabilities: ServiceCapability[]
  valueProps: ServiceValueProp[]
  serviceTitle: string
}

export function ServiceCapabilities({ capabilities, valueProps, serviceTitle }: ServiceCapabilitiesProps) {
  // Take top 6 capabilities to keep it crisp and high-impact
  const displayCapabilities = capabilities.slice(0, 6)

  return (
    <section className="section" id="capabilities" style={{ paddingTop: 'clamp(48px, 6vw, 80px)', paddingBottom: 'clamp(48px, 6vw, 80px)', background: 'rgba(248, 250, 253, 0.6)', borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        {/* Value Metrics / Highlights Bar */}
        {valueProps && valueProps.length > 0 && (
          <div className="grid g3" style={{ gap: '16px', marginBottom: 'clamp(40px, 5vw, 60px)' }} data-rv="up">
            {valueProps.map((vp, idx) => (
              <div
                key={idx}
                className="card card--flat"
                style={{
                  padding: '24px 22px',
                  borderRadius: 'var(--r-lg)',
                  border: '1px solid rgba(76, 111, 255, 0.18)',
                  background: 'linear-gradient(160deg, #FFFFFF, rgba(241, 245, 249, 0.85))',
                  boxShadow: '0 10px 25px -15px rgba(76, 111, 255, 0.12)',
                }}
              >
                {vp.metric && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--f-display)', background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {vp.metric}
                    </span>
                    {vp.metricLabel && (
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--f-mono)', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                        {vp.metricLabel}
                      </span>
                    )}
                  </div>
                )}
                <h3 className="h-sm" style={{ fontSize: '1.05rem', margin: '0 0 6px', color: '#0F172A', fontWeight: 700 }}>
                  {vp.title}
                </h3>
                <p className="small" style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.5, fontSize: '0.86rem' }}>
                  {vp.description}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Section Head */}
        <div className="section-head center" data-rv="up">
          <p className="eyebrow" style={{ justifyContent: 'center' }}>
            <span className="bars"><i></i><i></i><i></i></span>
            <span>Core Capabilities</span>
          </p>
          <h2 className="h-lg" style={{ marginTop: '12px', fontSize: 'clamp(1.8rem, 3.2vw, 2.4rem)' }}>
            What We Deliver in {serviceTitle}
          </h2>
          <p className="lead" style={{ maxWidth: '600px', marginInline: 'auto' }}>
            Modular, high-leverage engineering and strategic solutions tailored to your operational goals.
          </p>
        </div>

        {/* Capabilities Grid: Crisp 6 Cards */}
        <div className="grid g3" style={{ gap: '18px', marginTop: '36px' }}>
          {displayCapabilities.map((cap, i) => (
            <div
              key={i}
              className="card card--flat"
              style={{
                padding: '24px 20px',
                borderRadius: 'var(--r-md)',
                background: '#FFFFFF',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              }}
              data-rv="up"
              data-delay={String((i % 3) * 50)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(76, 111, 255, 0.08)',
                      color: 'var(--blue)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                  {cap.tag && (
                    <span className="badge" style={{ fontSize: '9px', letterSpacing: '0.08em', padding: '2px 8px', height: 'auto', background: 'rgba(241, 245, 249, 0.9)' }}>
                      {cap.tag}
                    </span>
                  )}
                </div>

                <h3 className="h-sm" style={{ margin: '0 0 8px', fontSize: '1.05rem', lineHeight: 1.3, fontWeight: 700, color: '#0F172A' }}>
                  {cap.title}
                </h3>
                <p className="small" style={{ color: 'var(--muted)', lineHeight: 1.55, margin: 0, fontSize: '0.86rem' }}>
                  {cap.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
