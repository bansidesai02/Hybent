import React from 'react'
import type { ServiceChallenge } from '../../data/servicesData'

interface ServiceChallengesProps {
  challenges: ServiceChallenge[]
  serviceTitle: string
}

export function ServiceChallenges({ challenges, serviceTitle }: ServiceChallengesProps) {
  return (
    <section className="section" style={{ paddingTop: 'clamp(40px, 6vw, 80px)', paddingBottom: 'clamp(40px, 6vw, 80px)', borderTop: '1px solid var(--border)' }}>
      <div className="wrap">
        <div className="section-head center" data-rv="up">
          <p className="eyebrow" style={{ justifyContent: 'center' }}>
            <span className="bars"><i></i><i></i><i></i></span>
            <span>The Challenges We Solve</span>
          </p>
          <h2 className="h-lg" style={{ marginTop: '12px' }}>
            Common Bottlenecks in {serviceTitle}
          </h2>
          <p className="lead">
            Organizations often encounter critical operational and technical friction that degrades efficiency, burns budget, and stalls growth.
          </p>
        </div>

        <div className="grid g2" style={{ gap: '20px', marginTop: '36px' }}>
          {challenges.map((item, index) => (
            <div
              key={index}
              className="card card--flat"
              style={{
                padding: 'clamp(22px, 3vw, 32px)',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)',
                background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 253, 0.85))',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              data-rv="up"
              data-delay={String(index * 60)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <span
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#EF4444',
                      fontWeight: 700,
                      fontFamily: 'var(--f-mono)',
                      fontSize: '0.8rem',
                      flexShrink: 0,
                    }}
                  >
                    0{index + 1}
                  </span>
                  <h3 className="h-sm" style={{ margin: 0, fontSize: '1.15rem' }}>
                    {item.title}
                  </h3>
                </div>

                <p className="small" style={{ color: 'var(--muted)', lineHeight: 1.6, marginBottom: '16px' }}>
                  {item.description}
                </p>
              </div>

              <div
                style={{
                  background: 'rgba(241, 245, 249, 0.7)',
                  borderRadius: 'var(--r-sm)',
                  padding: '10px 14px',
                  borderLeft: '3px solid #EF4444',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontFamily: 'var(--f-mono)', color: '#EF4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                  Business Impact
                </div>
                <div style={{ fontSize: '0.86rem', color: '#334155', fontWeight: 500 }}>
                  {item.impact}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
