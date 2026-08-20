import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SiteView } from '../components/SiteView'

interface IndustryItem {
  id: string
  title: string
  category: 'industrial' | 'digital' | 'regulated'
  categoryLabel: string
  description: string
  highlights: string[]
  iconSvg: React.ReactNode
}

const ALL_INDUSTRIES: IndustryItem[] = [
  // INDUSTRIAL, MOBILITY & INFRASTRUCTURE
  {
    id: 'manufacturing',
    title: 'Manufacturing & Industry 4.0',
    category: 'industrial',
    categoryLabel: 'Industrial & Infra',
    description: 'High-volume plant operations, equipment telemetry, predictive maintenance, and shift-based workforce tracking.',
    highlights: ['Plant Operations', 'Predictive Maintenance', 'Shift Tracking'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      </svg>
    ),
  },
  {
    id: 'real-estate',
    title: 'Real Estate & Construction',
    category: 'industrial',
    categoryLabel: 'Industrial & Infra',
    description: 'Property management portals, project milestone monitoring, contractor compliance, and lease workflow automation.',
    highlights: ['Property Portals', 'Project Milestones', 'Contractor Compliance'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
      </svg>
    ),
  },
  {
    id: 'automotive',
    title: 'Mobility, Automotive & EV',
    category: 'industrial',
    categoryLabel: 'Industrial & Infra',
    description: 'Connected vehicle telemetry, fleet routing optimization, EV charging station management, and parts logistics.',
    highlights: ['Fleet Telemetry', 'EV Infrastructure', 'Routing Optimization'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    ),
  },
  {
    id: 'travel',
    title: 'Travel & Hospitality',
    category: 'industrial',
    categoryLabel: 'Industrial & Infra',
    description: 'Dynamic reservation booking engines, guest loyalty systems, staff shift scheduling, and multi-currency billing.',
    highlights: ['Booking Engines', 'Guest Loyalty', 'Shift Scheduling'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    ),
  },
  {
    id: 'logistics',
    title: 'Logistics & Supply Chain',
    category: 'industrial',
    categoryLabel: 'Industrial & Infra',
    description: 'Real-time cargo tracking, automated warehouse dispatch, freight rate quoting, and cross-border customs sync.',
    highlights: ['Cargo Tracking', 'Warehouse Dispatch', 'Freight Quoting'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    id: 'energy',
    title: 'Energy & Cleantech',
    category: 'industrial',
    categoryLabel: 'Industrial & Infra',
    description: 'Smart grid energy distribution, solar / wind sensor monitoring, ESG carbon reporting, and field maintenance dispatch.',
    highlights: ['Smart Grid IoT', 'ESG & Carbon Reporting', 'Field Dispatch'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },

  // DIGITAL, CONSUMER & MEDIA
  {
    id: 'ecommerce',
    title: 'Ecommerce & Retail',
    category: 'digital',
    categoryLabel: 'Digital & Consumer',
    description: 'Omnichannel retail platforms, high-speed headless checkout, inventory sync, and localized payment gateways.',
    highlights: ['Headless Checkout', 'Inventory Sync', 'Omnichannel Sales'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    id: 'saas',
    title: 'B2B SaaS & Cloud Platforms',
    category: 'digital',
    categoryLabel: 'Digital & Consumer',
    description: 'Multi-tenant database architectures, subscription billing, RBAC permissions, and high-frequency webhook pipelines.',
    highlights: ['Multi-Tenancy', 'Subscription Billing', 'Webhook Pipelines'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
  {
    id: 'technology',
    title: 'Technology & Software',
    category: 'digital',
    categoryLabel: 'Digital & Consumer',
    description: 'Developer tooling, CI/CD infrastructure, distributed APIs, and scalable software product engineering for tech enterprises.',
    highlights: ['Developer Tooling', 'Distributed APIs', 'CI/CD Automation'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    id: 'telecom',
    title: 'Telecommunications & Networks',
    category: 'digital',
    categoryLabel: 'Digital & Consumer',
    description: 'Network provisioning pipelines, subscriber billing portals, 5G device orchestration, and OSS/BSS modernization.',
    highlights: ['Subscriber Billing', '5G Orchestration', 'OSS/BSS Modernization'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12h20" />
        <path d="M20 12v8H4v-8" />
        <path d="m4 4 8 8 8-8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: 'media',
    title: 'Media & Entertainment',
    category: 'digital',
    categoryLabel: 'Digital & Consumer',
    description: 'Low-latency video streaming, digital asset management (DAM), creator monetisation, and personalized content feeds.',
    highlights: ['Low-Latency Streaming', 'Asset Management', 'Creator Monetisation'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },

  // REGULATED & PUBLIC SERVICES
  {
    id: 'banking-finance',
    title: 'Banking & Financial Services',
    category: 'regulated',
    categoryLabel: 'Regulated & Public',
    description: 'PCI-DSS compliant payment processing, AML/KYC verification, open banking APIs, and algorithmic fraud detection.',
    highlights: ['PCI-DSS Compliance', 'AML/KYC Verification', 'Fraud Detection'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    id: 'government',
    title: 'Government & Public Sector',
    category: 'regulated',
    categoryLabel: 'Regulated & Public',
    description: 'Citizen digital service portals, secure identity verification, open data disclosure, and strict compliance audit trails.',
    highlights: ['Citizen Portals', 'Identity Verification', 'Audit Disclosures'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2 2 7h20L12 2z" />
      </svg>
    ),
  },
  {
    id: 'healthcare',
    title: 'Healthcare & Life Sciences',
    category: 'regulated',
    categoryLabel: 'Regulated & Public',
    description: 'HIPAA-compliant patient portals, EHR / FHIR interoperability, clinical telemetry data, and medical credentialing.',
    highlights: ['HIPAA & FHIR Ready', 'Patient Portals', 'Clinical Telemetry'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
  },
  {
    id: 'professional-services',
    title: 'Professional Services & Legal',
    category: 'regulated',
    categoryLabel: 'Regulated & Public',
    description: 'Bench allocation, client matter tracking, secure e-signatures, document automation, and automated time billing.',
    highlights: ['Resource Planning', 'Matter Tracking', 'Secure E-Signatures'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    id: 'education',
    title: 'Education & EdTech',
    category: 'regulated',
    categoryLabel: 'Regulated & Public',
    description: 'Learning management systems (LMS), virtual classroom streaming, student assessment rubrics, and automated grading.',
    highlights: ['LMS Platforms', 'Virtual Classrooms', 'Assessment Rubrics'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
      </svg>
    ),
  },
]

type IndustryCategory = 'all' | 'industrial' | 'digital' | 'regulated'

export default function IndustriesPage() {
  const [selectedCategory, setSelectedCategory] = useState<IndustryCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredIndustries = useMemo(() => {
    return ALL_INDUSTRIES.filter((ind) => {
      const matchesCategory = selectedCategory === 'all' || ind.category === selectedCategory
      const matchesSearch =
        searchQuery.trim() === '' ||
        ind.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ind.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ind.highlights.some((h) => h.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  const counts = useMemo(() => {
    return {
      all: ALL_INDUSTRIES.length,
      industrial: ALL_INDUSTRIES.filter((i) => i.category === 'industrial').length,
      digital: ALL_INDUSTRIES.filter((i) => i.category === 'digital').length,
      regulated: ALL_INDUSTRIES.filter((i) => i.category === 'regulated').length,
    }
  }, [])

  return (
    <SiteView route="industries">
      {/* ── EMBEDDED STYLES FOR 5-COLUMN RESPONSIVE GRID ── */}
      <style>{`
        .industries-5col-wrap {
          width: 100%;
          max-width: min(1540px, 95vw);
          margin-inline: auto;
          padding-inline: clamp(16px, 3vw, 36px);
        }
        .industries-5col-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
        }
        @media (max-width: 1400px) {
          .industries-5col-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }
        }
        @media (max-width: 1100px) {
          .industries-5col-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
          }
        }
        @media (max-width: 780px) {
          .industries-5col-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
        }
        @media (max-width: 480px) {
          .industries-5col-grid {
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
            <span>Industry Solutions</span>
          </p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">
            Configured for how your sector actually builds &amp; hires
          </h1>
          <p className="hero__sub" data-rv="up" data-delay="160">
            Domain-specific architecture templates, compliance standards, and workflows tuned by sector — every one of them customizable, none of them locked.
          </p>

          {/* Metrics bar */}
          <div
            className="grid g4"
            style={{ marginTop: "40px", gap: "16px" }}
            data-rv="up"
            data-delay="220"
          >
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>16+</b>
              <span>Industry Sectors</span>
              <em>Full Ecosystem Coverage</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>SOC2 &amp; ISO</b>
              <span>Compliance Pre-Built</span>
              <em>Audit-Ready Workflows</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>0 Sec</b>
              <span>Vendor Lock-In</span>
              <em>Full Data Portability</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>Custom</b>
              <span>Domain Integrations</span>
              <em>REST, GraphQL &amp; Event Bus</em>
            </div>
          </div>
        </div>
      </section>

      {/* ── FILTER & SEARCH SECTION (CLEAN FROSTED CAPSULE BAR) ──────── */}
      <section className="section" style={{ paddingTop: "24px", paddingBottom: "20px" }}>
        <div className="industries-5col-wrap">
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
                { key: 'all', label: 'All Industries', count: counts.all },
                { key: 'industrial', label: 'Industrial, Mobility & Infra', count: counts.industrial },
                { key: 'digital', label: 'Digital, Consumer & Media', count: counts.digital },
                { key: 'regulated', label: 'Regulated & Public Services', count: counts.regulated },
              ].map((tab) => {
                const isActive = selectedCategory === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedCategory(tab.key as IndustryCategory)}
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

            {/* Live Search input */}
            <div style={{ position: "relative", minWidth: "260px", flex: "1 1 260px", maxWidth: "340px" }}>
              <input
                type="text"
                placeholder="Search industries or sectors..."
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
      <section className="section" id="industries" style={{ paddingTop: "24px" }}>
        <div className="industries-5col-wrap">
          {filteredIndustries.length === 0 ? (
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
              <h3 className="h-sm">No industries match &ldquo;{searchQuery}&rdquo;</h3>
              <p className="small" style={{ color: "var(--muted)", maxWidth: "420px" }}>
                Try searching for another sector like &ldquo;Healthcare&rdquo;, &ldquo;Fintech&rdquo;, &ldquo;SaaS&rdquo;, or reset your filters.
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
            <div className="industries-5col-grid">
              {filteredIndustries.map((ind) => (
                <article
                  key={ind.id}
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
                        {ind.iconSvg}
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
                        {ind.categoryLabel}
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
                      {ind.title}
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
                      {ind.description}
                    </p>

                    {/* Feature Highlight Pills */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "16px" }}>
                      {ind.highlights.map((h, i) => (
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

                  {/* Card Footer: Action Link */}
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
                      to={`/contact?industry=${encodeURIComponent(ind.title)}`}
                      className="link-arrow"
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "var(--cyan)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <span>Explore</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </Link>
                    <span style={{ fontFamily: "var(--f-mono)", fontSize: "9px", color: "var(--dim)", textTransform: "uppercase" }}>
                      HYBENT
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CALL TO ACTION BANNER ───────────────────────────────────── */}
      <section className="section" style={{ paddingTop: "20px", paddingBottom: "80px" }}>
        <div className="wrap">
          <div className="cta-band" data-rv="scale" style={{ textAlign: "center" }}>
            <p className="eyebrow" style={{ justifyContent: "center" }}>
              <span className="bars"><i></i><i></i><i></i></span>
              <span>Tailored Solutions</span>
            </p>
            <h2 className="h-lg" style={{ marginTop: "14px", maxWidth: "680px", margin: "14px auto 0" }}>
              Need a custom solution for your sector?
            </h2>
            <p className="lead" style={{ marginTop: "16px", maxWidth: "580px", margin: "16px auto 32px" }}>
              Talk to our industry specialists. We will analyze your workflows, regulatory requirements, and technical stack to deliver tailored software.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", justifyContent: "center" }}>
              <Link to="/contact" className="btn btn-primary btn-lg">
                <span>Speak with an Expert</span>
                <svg className="arw" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
              <Link to="/services" className="btn btn-ghost btn-lg">
                <span>Browse All Services</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
