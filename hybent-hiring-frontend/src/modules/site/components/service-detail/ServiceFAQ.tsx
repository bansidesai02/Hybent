import React, { useState } from 'react'
import type { ServiceFAQ as ServiceFAQType } from '../../data/servicesData'

interface ServiceFAQProps {
  faqs: ServiceFAQType[]
  serviceTitle: string
}

export function ServiceFAQ({ faqs, serviceTitle }: ServiceFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  // Show top 4 most critical questions for clients
  const displayFaqs = faqs.slice(0, 4)

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index))
  }

  return (
    <section className="section" style={{ paddingTop: 'clamp(48px, 6vw, 80px)', paddingBottom: 'clamp(48px, 6vw, 80px)', borderTop: '1px solid var(--border)' }}>
      <div className="wrap" style={{ maxWidth: '800px' }}>
        <div className="section-head center" data-rv="up">
          <p className="eyebrow" style={{ justifyContent: 'center' }}>
            <span className="bars"><i></i><i></i><i></i></span>
            <span>Frequently Asked Questions</span>
          </p>
          <h2 className="h-lg" style={{ marginTop: '12px', fontSize: 'clamp(1.8rem, 3.2vw, 2.4rem)' }}>
            Key Questions &amp; Answers
          </h2>
          <p className="lead" style={{ maxWidth: '540px', marginInline: 'auto' }}>
            Quick answers about scoping, engagement models, timelines, and IP ownership.
          </p>
        </div>

        <div style={{ display: 'grid', gap: '10px', marginTop: '32px' }}>
          {displayFaqs.map((faq, index) => {
            const isOpen = openIndex === index
            return (
              <div
                key={index}
                className="card card--flat"
                style={{
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)',
                  background: '#FFFFFF',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                data-rv="up"
                data-delay={String(index * 30)}
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: '#0F172A',
                    fontWeight: 600,
                    fontSize: '0.98rem',
                  }}
                  aria-expanded={isOpen}
                >
                  <span style={{ flex: 1, lineHeight: 1.4 }}>{faq.question}</span>
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: isOpen ? 'rgba(76, 111, 255, 0.12)' : 'rgba(241, 245, 249, 0.8)',
                      color: isOpen ? 'var(--blue)' : '#64748B',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '1rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease, background 0.2s ease, color 0.2s ease',
                    }}
                  >
                    +
                  </span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: '0 20px 18px 20px',
                      color: 'var(--muted)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      borderTop: '1px solid rgba(241, 245, 249, 0.9)',
                      paddingTop: '12px',
                    }}
                  >
                    {faq.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
