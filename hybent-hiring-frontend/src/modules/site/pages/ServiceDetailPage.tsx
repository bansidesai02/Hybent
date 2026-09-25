import React, { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { SiteView } from '../components/SiteView'
import { getServiceBySlug } from '../data/servicesData'
import { applyPageMeta, serviceMeta } from '@/app/seo'

import { ServiceHero } from '../components/service-detail/ServiceHero'
import { ServiceCapabilities } from '../components/service-detail/ServiceCapabilities'
import { ServiceProcess } from '../components/service-detail/ServiceProcess'
import { ServiceUseCases } from '../components/service-detail/ServiceUseCases'
import { ServiceFAQ } from '../components/service-detail/ServiceFAQ'
import { ServiceCTA } from '../components/service-detail/ServiceCTA'
import { ServiceRelated } from '../components/service-detail/ServiceRelated'

export default function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const service = slug ? getServiceBySlug(slug) : undefined

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })

    if (service) applyPageMeta(serviceMeta(service))
  }, [slug, service])

  if (!service) {
    return (
      <SiteView route="services">
        <main id="main-content">
          <section className="section" style={{ paddingTop: 'calc(var(--nav-h) + 60px)', paddingBottom: '100px', textAlign: 'center' }}>
            <div className="wrap" style={{ maxWidth: '600px' }}>
              <span className="badge" style={{ marginBottom: '16px' }}>Service Not Found</span>
              <h1 className="h-lg" style={{ marginBottom: '16px' }}>
                Looking for a Specific Service?
              </h1>
              <p className="lead" style={{ marginBottom: '32px' }}>
                The service you requested could not be located or may have been moved. Explore all 20 of our core engineering and strategic solutions below.
              </p>
              <Link to="/services" className="btn btn-primary btn-lg">
                <span>View All 20 Services</span>
                <svg className="arw" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
            </div>
          </section>
        </main>
      </SiteView>
    )
  }

  return (
    <SiteView route="services">
      <main id="main-content">
        {/* 1. High-Impact Hero with Tech Schematic Visual */}
        <ServiceHero service={service} />

        {/* 2. Key Value Metrics & 6 Core Capabilities */}
        <ServiceCapabilities
          capabilities={service.capabilities}
          valueProps={service.valueProps}
          serviceTitle={service.title}
        />

        {/* 3. Phased Execution & Delivery Process */}
        <ServiceProcess process={service.process} serviceTitle={service.title} />

        {/* 4. Real-World Case Studies & Proven Results */}
        <ServiceUseCases useCases={service.useCases} serviceTitle={service.title} />

        {/* 5. Essential FAQs */}
        <ServiceFAQ faqs={service.faqs} serviceTitle={service.title} />

        {/* 6. High-Conversion Consultation CTA */}
        <ServiceCTA serviceTitle={service.title} primaryCta={service.primaryCta} />

        {/* 7. Compact Related Solutions */}
        <ServiceRelated relatedSlugs={service.relatedServiceSlugs} currentTitle={service.title} />
      </main>
    </SiteView>
  )
}
