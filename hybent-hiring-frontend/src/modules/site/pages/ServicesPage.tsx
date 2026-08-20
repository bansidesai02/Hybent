import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SiteView } from '../components/SiteView'

interface ServiceItem {
  id: string
  slug: string
  title: string
  category: 'grow' | 'transform' | 'consulting' | 'engineering'
  categoryLabel: string
  description: string
  highlights: string[]
  iconSvg: React.ReactNode
}

const ALL_SERVICES: ServiceItem[] = [
  // GROW & SCALE
  {
    id: 'performance-marketing',
    slug: 'performance-marketing',
    title: 'Performance Marketing Services',
    category: 'grow',
    categoryLabel: 'Grow & Scale',
    description: 'Data-driven customer acquisition, conversion rate optimization, and multi-channel campaign scaling engineered for ROI.',
    highlights: ['Conversion Optimization', 'Predictive Bidding', 'Multi-Touch Attribution'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    id: 'ecommerce-growth',
    slug: 'ecommerce-growth',
    title: 'eCommerce Growth Solutions',
    category: 'grow',
    categoryLabel: 'Grow & Scale',
    description: 'High-conversion headless storefronts, custom checkout pipelines, catalog indexing, and automated retention funnels.',
    highlights: ['Headless Storefronts', 'Checkout Optimization', 'Retention Loops'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    id: 'ux-optimization',
    slug: 'ux-optimization-accessibility',
    title: 'UX Optimization & Accessibility',
    category: 'grow',
    categoryLabel: 'Grow & Scale',
    description: 'Human-centered user experience audits, WCAG 2.1 AA/AAA compliance validation, and interaction speedup.',
    highlights: ['WCAG Compliance', 'Speed Optimization', 'Friction Removal'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    ),
  },
  {
    id: 'it-strategy',
    slug: 'it-strategy-process-optimization',
    title: 'IT Strategy & Process Optimization',
    category: 'grow',
    categoryLabel: 'Grow & Scale',
    description: 'Digital transformation roadmaps, technical architecture audits, workflow modernization, and agile delivery frameworks.',
    highlights: ['Enterprise Roadmaps', 'Agile Delivery', 'Legacy Tech Audit'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    id: 'app-maintenance',
    slug: 'application-maintenance-support',
    title: 'Application Maintenance & Support',
    category: 'grow',
    categoryLabel: 'Grow & Scale',
    description: '24/7 SLA-backed system monitoring, rapid bug triage, zero-downtime security patching, and proactive capacity planning.',
    highlights: ['24/7 SLA Support', 'Zero-Downtime Patching', 'Health Monitoring'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: 'staff-augmentation',
    slug: 'it-staff-augmentation',
    title: 'IT Staff Augmentation Services',
    category: 'grow',
    categoryLabel: 'Grow & Scale',
    description: 'Pre-vetted top 1% engineering talent, on-demand skill matching, rapid onboarding, and seamless team integration.',
    highlights: ['Top 1% Talent', 'Rapid Onboarding', 'Timezone Aligned'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'b2b-lead-generation',
    slug: 'b2b-lead-generation',
    title: 'B2B Lead Generation Solutions',
    category: 'grow',
    categoryLabel: 'Grow & Scale',
    description: 'Automated outbound pipelines, CRM synchronization, intent data enrichment, and scalable qualification engines.',
    highlights: ['Automated Outbound', 'CRM Enrichment', 'Intent Routing'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    id: 'bi-data-analytics',
    slug: 'business-intelligence-analytics',
    title: 'Business Intelligence & Analytics',
    category: 'grow',
    categoryLabel: 'Grow & Scale',
    description: 'Unified data warehousing, interactive executive dashboards, automated metric reporting, and predictive business insights.',
    highlights: ['Executive BI Dashboards', 'Data Warehouses', 'Trend Analysis'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },

  // TRANSFORM & MODERNIZE
  {
    id: 'legacy-app-modernization',
    slug: 'legacy-app-modernization',
    title: 'Legacy App Modernization',
    category: 'transform',
    categoryLabel: 'Transform',
    description: 'Monolith-to-microservices decomposition, database replatforming, API encapsulation, and complete tech debt remediation.',
    highlights: ['Microservices', 'Zero-Downtime Migration', 'Cloud-Native'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <line x1="14" y1="2" x2="10" y2="22" />
      </svg>
    ),
  },
  {
    id: 'ai-advanced-tech',
    slug: 'ai-machine-learning',
    title: 'AI & Machine Learning Integration',
    category: 'transform',
    categoryLabel: 'Transform',
    description: 'Domain-tailored LLM fine-tuning, autonomous agentic workflows, RAG knowledge retrieval, and intelligent document parsing.',
    highlights: ['Custom LLM Tuning', 'AI Agents', 'Enterprise RAG'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="8" width="16" height="12" rx="3" />
        <path d="M12 4.4V8M9.4 13.4v1.6M14.6 13.4v1.6M2 13v3M22 13v3" />
        <circle cx="12" cy="3" r="1.4" />
      </svg>
    ),
  },
  {
    id: 'cloud-infrastructure',
    slug: 'cloud-infrastructure-devops',
    title: 'Cloud Infrastructure & DevOps',
    category: 'transform',
    categoryLabel: 'Transform',
    description: 'Multi-cloud architectures (AWS, GCP, Azure), Kubernetes orchestration, Infrastructure as Code with Terraform, and robust CI/CD.',
    highlights: ['Kubernetes & Docker', 'Terraform IaC', 'Automated CI/CD'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.1 11.2 3.9 3.9 0 0 0 6.5 19z" />
      </svg>
    ),
  },
  {
    id: 'iot-smart-solutions',
    slug: 'iot-smart-connected-solutions',
    title: 'IoT & Smart Connected Solutions',
    category: 'transform',
    categoryLabel: 'Transform',
    description: 'Embedded hardware interfaces, edge computing firmware, MQTT streaming protocols, and centralized device fleet management.',
    highlights: ['Edge Firmware', 'MQTT Streaming', 'Fleet Control'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
  },

  // STRATEGIC CONSULTING
  {
    id: 'product-consulting',
    slug: 'product-strategy-scoping',
    title: 'Product Strategy & Scoping',
    category: 'consulting',
    categoryLabel: 'Consulting',
    description: 'Discovery workshops, MVP definition, user validation cycles, technical feasibility analysis, and data-driven product roadmaps.',
    highlights: ['Product Discovery', 'MVP Scoping', 'Market Validation'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    id: 'tech-consulting',
    slug: 'technology-architecture-consulting',
    title: 'Technology & Architecture Consulting',
    category: 'consulting',
    categoryLabel: 'Consulting',
    description: 'High-level architectural assessments, security posture evaluations, technology stack selection, and scalability audits.',
    highlights: ['Architecture Blueprint', 'Scalability Audit', 'Tech Stack Advisory'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: 'design-consulting',
    slug: 'design-systems-ui-ux',
    title: 'Design Systems & UI/UX Consulting',
    category: 'consulting',
    categoryLabel: 'Consulting',
    description: 'Multi-brand design systems, tokenized UI components, micro-interactions, responsive design patterns, and prototype validation.',
    highlights: ['Design Tokens', 'Component Libraries', 'Prototypes'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    ),
  },
  {
    id: 'digital-marketing-consulting',
    slug: 'digital-marketing-growth',
    title: 'Digital Marketing & Growth Consulting',
    category: 'consulting',
    categoryLabel: 'Consulting',
    description: 'Go-to-market strategies, technical SEO architecture, organic search authority, and omnichannel conversion optimization.',
    highlights: ['GTM Blueprints', 'Technical SEO', 'Omnichannel Growth'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
        <path d="M22 12A10 10 0 0 0 12 2v10z" />
      </svg>
    ),
  },

  // CORE ENGINEERING
  {
    id: 'custom-software',
    slug: 'custom-enterprise-software',
    title: 'Custom Enterprise Software',
    category: 'engineering',
    categoryLabel: 'Engineering',
    description: 'Scalable backend architectures, distributed microservices, and robust business systems built for speed and strict security.',
    highlights: ['Microservices', 'High-Throughput APIs', 'Enterprise Grade'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2.6 2.8 7.3 12 12l9.2-4.7z" />
        <path d="M2.8 12.4 12 17l9.2-4.6M2.8 17 12 21.6 21.2 17" />
      </svg>
    ),
  },
  {
    id: 'web-mobile-dev',
    slug: 'web-mobile-engineering',
    title: 'Web & Mobile Engineering',
    category: 'engineering',
    categoryLabel: 'Engineering',
    description: 'Native iOS & Android apps and responsive modern web applications built using React, TypeScript, React Native, and Flutter.',
    highlights: ['React & TypeScript', 'React Native & Flutter', 'Fluid UX'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="2.4" />
        <rect x="9" y="9" width="6" height="6" rx="1.2" />
        <path d="M9 2.6v2.4M15 2.6v2.4M9 19v2.4M15 19v2.4M2.6 9H5M2.6 15H5M19 9h2.4M19 15h2.4" />
      </svg>
    ),
  },
  {
    id: 'it-security',
    slug: 'it-security-compliance',
    title: 'IT Security & Compliance',
    category: 'engineering',
    categoryLabel: 'Engineering',
    description: 'Role-based access control, SOC2 / ISO compliance alignment, penetration testing, and automated encryption at rest and in transit.',
    highlights: ['SOC2 & ISO Ready', 'End-to-End Encryption', 'RBAC & Audits'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-3.6 8-9.6V5.4L12 2 4 5.4v7c0 6 8 9.6 8 9.6z" />
        <path d="M9.2 12.2l2 2 3.6-3.9" />
      </svg>
    ),
  },
  {
    id: 'data-engineering',
    slug: 'data-engineering-pipelines',
    title: 'Data Engineering & Pipelines',
    category: 'engineering',
    categoryLabel: 'Engineering',
    description: 'High-throughput Kafka streaming pipelines, distributed data storage, real-time analytics aggregation, and system monitoring.',
    highlights: ['Kafka Streaming', 'ETL/ELT Warehouses', 'Sub-Second Analytics'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <ellipse cx="12" cy="5.6" rx="8" ry="3.2" />
        <path d="M4 5.6v12.8c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V5.6M4 12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" />
      </svg>
    ),
  },
]

type FilterCategory = 'all' | 'grow' | 'transform' | 'consulting' | 'engineering'

export default function ServicesPage() {
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredServices = useMemo(() => {
    return ALL_SERVICES.filter((svc) => {
      const matchesCategory = selectedCategory === 'all' || svc.category === selectedCategory
      const matchesSearch =
        searchQuery.trim() === '' ||
        svc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        svc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        svc.highlights.some((h) => h.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  const counts = useMemo(() => {
    return {
      all: ALL_SERVICES.length,
      grow: ALL_SERVICES.filter((s) => s.category === 'grow').length,
      transform: ALL_SERVICES.filter((s) => s.category === 'transform').length,
      consulting: ALL_SERVICES.filter((s) => s.category === 'consulting').length,
      engineering: ALL_SERVICES.filter((s) => s.category === 'engineering').length,
    }
  }, [])

  return (
    <SiteView route="services">
      {/* ── EMBEDDED STYLES FOR 5-COLUMN RESPONSIVE GRID & CLEAN CONTROLS ── */}
      <style>{`
        .services-5col-wrap {
          width: 100%;
          max-width: min(1540px, 95vw);
          margin-inline: auto;
          padding-inline: clamp(16px, 3vw, 36px);
        }
        .services-5col-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
        }
        @media (max-width: 1400px) {
          .services-5col-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }
        }
        @media (max-width: 1100px) {
          .services-5col-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
          }
        }
        @media (max-width: 780px) {
          .services-5col-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
        }
        @media (max-width: 480px) {
          .services-5col-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      `}</style>

      {/* ── HERO SECTION ────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up">
            <span className="bars"><i></i><i></i><i></i></span>
            <span>Enterprise Services</span>
          </p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">
            End-to-end software engineering &amp; IT solutions
          </h1>
          <p className="hero__sub" data-rv="up" data-delay="160">
            From enterprise software development to cloud architecture, AI integration, and growth consulting, we deliver high-impact digital solutions tailored to your business goals.
          </p>

          {/* Quick Metrics Bar */}
          <div
            className="grid g4"
            style={{ marginTop: "40px", gap: "16px" }}
            data-rv="up"
            data-delay="220"
          >
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>20+</b>
              <span>Specialized Offerings</span>
              <em>Grow, Transform &amp; Consult</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>99.9%</b>
              <span>Uptime &amp; SLA Commitment</span>
              <em>Enterprise Reliability</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>Top 1%</b>
              <span>Senior Talent</span>
              <em>Engineers &amp; Architects</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>100%</b>
              <span>IP &amp; Code Ownership</span>
              <em>Clean Transparent Delivery</em>
            </div>
          </div>
        </div>
      </section>

      {/* ── FILTER & SEARCH SECTION (CLEAN FROSTED CAPSULE BAR) ──────── */}
      <section className="section" style={{ paddingTop: "24px", paddingBottom: "20px" }}>
        <div className="services-5col-wrap">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              background: "rgba(255, 255, 255, 0.88)",
              border: "1px solid rgba(226, 232, 240, 0.95)",
              borderRadius: "50px",
              padding: "10px 14px",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 10px 30px -8px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.03)",
            }}
          >
            {/* Category tabs */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
              }}
            >
              {[
                { key: 'all', label: 'All Services', count: counts.all },
                { key: 'grow', label: 'Grow & Scale', count: counts.grow },
                { key: 'transform', label: 'Transform & Modernize', count: counts.transform },
                { key: 'consulting', label: 'Strategic Consulting', count: counts.consulting },
                { key: 'engineering', label: 'Core Engineering', count: counts.engineering },
              ].map((tab) => {
                const isActive = selectedCategory === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedCategory(tab.key as FilterCategory)}
                    style={{
                      height: "38px",
                      padding: "0 18px",
                      borderRadius: "50px",
                      fontSize: "0.88rem",
                      fontWeight: isActive ? 700 : 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.25s cubic-bezier(0.2, 0.8, 0.3, 1)",
                      outline: "none",
                      border: isActive ? "1px solid transparent" : "1px solid rgba(203, 213, 225, 0.7)",
                      background: isActive ? "var(--grad)" : "rgba(241, 245, 249, 0.85)",
                      color: isActive ? "#05060B" : "#334155",
                      boxShadow: isActive
                        ? "0 4px 14px rgba(76, 111, 255, 0.35)"
                        : "0 1px 2px rgba(0, 0, 0, 0.03)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "#FFFFFF"
                        e.currentTarget.style.color = "#0F172A"
                        e.currentTarget.style.borderColor = "#94A3B8"
                        e.currentTarget.style.transform = "translateY(-1px)"
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.08)"
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "rgba(241, 245, 249, 0.85)"
                        e.currentTarget.style.color = "#334155"
                        e.currentTarget.style.borderColor = "rgba(203, 213, 225, 0.7)"
                        e.currentTarget.style.transform = "none"
                        e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.03)"
                      }
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        padding: "1px 7px",
                        borderRadius: "10px",
                        background: isActive ? "rgba(0, 0, 0, 0.22)" : "rgba(203, 213, 225, 0.7)",
                        color: isActive ? "#05060B" : "#475569",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Search input */}
            <div style={{ position: "relative", minWidth: "260px", flex: "1 1 260px", maxWidth: "340px" }}>
              <input
                type="text"
                placeholder="Search services or capabilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: "38px",
                  padding: "0 16px 0 38px",
                  background: "#FFFFFF",
                  border: "1px solid rgba(203, 213, 225, 0.9)",
                  borderRadius: "50px",
                  color: "#0F172A",
                  fontSize: "0.88rem",
                  fontWeight: 500,
                  outline: "none",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--blue)"
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(76, 111, 255, 0.15)"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(203, 213, 225, 0.9)"
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.04)"
                }}
              />
              <svg
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "15px",
                  height: "15px",
                  color: "#64748B",
                  pointerEvents: "none",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "#64748B",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: "4px",
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5 CARDS PER ROW HORIZONTAL GRID ─────────────────────────── */}
      <section className="section" id="services" style={{ paddingTop: "24px" }}>
        <div className="services-5col-wrap">
          {filteredServices.length === 0 ? (
            <div
              className="card card--flat"
              style={{
                textAlign: "center",
                padding: "60px 20px",
                display: "grid",
                placeItems: "center",
                gap: "12px",
              }}
            >
              <p className="eyebrow" style={{ margin: 0 }}>
                <span className="bars"><i></i><i></i><i></i></span>
                <span>No results</span>
              </p>
              <h3 className="h-sm">No services match &ldquo;{searchQuery}&rdquo;</h3>
              <p className="small" style={{ color: "var(--muted)", maxWidth: "420px" }}>
                Try searching for another keyword like &ldquo;Cloud&rdquo;, &ldquo;AI&rdquo;, &ldquo;Engineering&rdquo;, or reset your filters.
              </p>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setSelectedCategory('all')
                  setSearchQuery('')
                }}
                style={{
                  marginTop: "12px",
                  height: "38px",
                  padding: "0 20px",
                  borderRadius: "var(--r-full)",
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--text)",
                  border: "1px solid var(--border-strong)",
                  cursor: "pointer",
                }}
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="services-5col-grid">
              {filteredServices.map((svc) => (
                <article
                  key={svc.id}
                  className="card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "18px 16px",
                    borderRadius: "var(--r-md)",
                    position: "relative",
                  }}
                >
                  <div className="card__glow" style={{ top: "-40px", right: "-40px", width: "160px", height: "160px" }}></div>

                  <div>
                    {/* Top Row: Icon & Category Badge */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <span className="icon-tile" style={{ width: "36px", height: "36px", borderRadius: "10px" }}>
                        {svc.iconSvg}
                      </span>
                      <span
                        className="badge"
                        style={{
                          fontSize: "9px",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          padding: "2px 8px",
                          height: "auto",
                        }}
                      >
                        {svc.categoryLabel}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h3
                      className="h-sm"
                      style={{
                        margin: "0 0 8px",
                        fontSize: "0.98rem",
                        lineHeight: "1.3",
                        minHeight: "2.6rem",
                        display: "flex",
                        alignItems: "flex-start",
                      }}
                    >
                      <Link
                        to={`/services/${svc.slug}`}
                        style={{
                          color: "inherit",
                          textDecoration: "none",
                          transition: "color 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cyan)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "inherit")}
                      >
                        {svc.title}
                      </Link>
                    </h3>
                    <p
                      className="small"
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.8rem",
                        lineHeight: "1.48",
                        marginBottom: "14px",
                        minHeight: "3.5rem",
                      }}
                    >
                      {svc.description}
                    </p>

                    {/* Feature Highlight Pills */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "16px" }}>
                      {svc.highlights.map((h, i) => (
                        <span
                          key={i}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: "0.68rem",
                            fontFamily: "var(--f-mono)",
                            padding: "2px 7px",
                            borderRadius: "5px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid var(--border)",
                            color: "var(--dim)",
                          }}
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer: Action Links */}
                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      paddingTop: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Link
                      to={`/services/${svc.slug}`}
                      className="link-arrow"
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "var(--blue)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span>Explore</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </Link>

                    <Link
                      to={`/contact?service=${encodeURIComponent(svc.title)}`}
                      style={{
                        fontSize: "0.75rem",
                        fontFamily: "var(--f-mono)",
                        color: "var(--dim)",
                        textDecoration: "none",
                        transition: "color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cyan)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--dim)")}
                    >
                      Inquire →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── ENGAGEMENT & DELIVERY MODELS ─────────────────────────────── */}
      <section className="section" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: "680px", margin: "0 auto 44px" }}>
            <p className="eyebrow" style={{ justifyContent: "center" }}>
              <span className="bars"><i></i><i></i><i></i></span>
              <span>Flexible Engagement</span>
            </p>
            <h2 className="h-lg" style={{ marginTop: "12px" }}>
              Tailored delivery models built for velocity
            </h2>
            <p className="lead" style={{ marginTop: "14px", fontSize: "1.05rem" }}>
              Whether you need a dedicated engineering squad or specialized consulting on demand, our engagement models adapt to your product lifecycle.
            </p>
          </div>

          <div className="grid g4" style={{ gap: "16px" }}>
            <article className="card card--flat" style={{ padding: "clamp(20px, 2.5vw, 28px)" }}>
              <span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "10px", marginBottom: "14px" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </span>
              <h4 style={{ fontSize: "1.05rem", marginBottom: "8px" }}>Dedicated Squads</h4>
              <p className="small" style={{ color: "var(--muted)" }}>
                Full-lifecycle engineering squads (tech leads, senior devs, QA, DevOps) embedded into your organization.
              </p>
            </article>

            <article className="card card--flat" style={{ padding: "clamp(20px, 2.5vw, 28px)" }}>
              <span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "10px", marginBottom: "14px" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </span>
              <h4 style={{ fontSize: "1.05rem", marginBottom: "8px" }}>Staff Augmentation</h4>
              <p className="small" style={{ color: "var(--muted)" }}>
                Scale individual skill gaps rapidly with vetted senior software architects and specialist engineers.
              </p>
            </article>

            <article className="card card--flat" style={{ padding: "clamp(20px, 2.5vw, 28px)" }}>
              <span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "10px", marginBottom: "14px" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
              </span>
              <h4 style={{ fontSize: "1.05rem", marginBottom: "8px" }}>Milestone / Fixed Scope</h4>
              <p className="small" style={{ color: "var(--muted)" }}>
                Defined timelines, clear milestones, predictable budgeting, and transparent deliverables for MVPs and modernizations.
              </p>
            </article>

            <article className="card card--flat" style={{ padding: "clamp(20px, 2.5vw, 28px)" }}>
              <span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "10px", marginBottom: "14px" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-3.6 8-9.6V5.4L12 2 4 5.4v7c0 6 8 9.6 8 9.6z"></path>
                </svg>
              </span>
              <h4 style={{ fontSize: "1.05rem", marginBottom: "8px" }}>Managed 24/7 Support</h4>
              <p className="small" style={{ color: "var(--muted)" }}>
                Proactive maintenance, 99.9% uptime SLA, security compliance monitoring, and continuous performance tuning.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION BANNER ───────────────────────────────────── */}
      <section className="section" style={{ paddingTop: "20px", paddingBottom: "80px" }}>
        <div className="wrap">
          <div className="cta-band" data-rv="scale" style={{ textAlign: "center" }}>
            <p className="eyebrow" style={{ justifyContent: "center" }}>
              <span className="bars"><i></i><i></i><i></i></span>
              <span>Let&apos;s Build Together</span>
            </p>
            <h2 className="h-lg" style={{ marginTop: "14px", maxWidth: "680px", margin: "14px auto 0" }}>
              Ready to accelerate your engineering roadmap?
            </h2>
            <p className="lead" style={{ marginTop: "16px", maxWidth: "580px", margin: "16px auto 32px" }}>
              Schedule a strategy session with our technical leads. We will audit your requirements and propose the optimal execution architecture.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", justifyContent: "center" }}>
              <Link to="/contact" className="btn btn-primary btn-lg">
                <span>Schedule a Consultation</span>
                <svg className="arw" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
              <Link to="/hire-talent" className="btn btn-ghost btn-lg">
                <span>Explore Talent Network</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
