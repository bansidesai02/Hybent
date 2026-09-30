import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SiteView } from '../components/SiteView'

interface TalentRole {
  id: string
  title: string
  category: 'frontend' | 'backend' | 'mobile' | 'ai-data' | 'cms-ecommerce' | 'design'
  categoryLabel: string
  description: string
  skills: string[]
  iconSvg: React.ReactNode
}

const ALL_TALENT_ROLES: TalentRole[] = [
  // FRONTEND
  {
    id: 'react-dev',
    title: 'React Developers',
    category: 'frontend',
    categoryLabel: 'Frontend',
    description: 'Expert React developers building reactive SPAs, stateful enterprise frontends, and modular UI architectures.',
    skills: ['React 18', 'Redux / Zustand', 'TypeScript', 'Component Systems'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(0 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'nextjs-dev',
    title: 'Next.js Developers',
    category: 'frontend',
    categoryLabel: 'Frontend',
    description: 'Specialists in server-side rendering (SSR), static site generation (SSG), App Router, and Vercel edge deployment.',
    skills: ['Next.js 14/15', 'App Router', 'Server Actions', 'Edge APIs'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 16 6-8" />
        <path d="M15 16V8" />
      </svg>
    ),
  },
  {
    id: 'typescript-dev',
    title: 'TypeScript Developers',
    category: 'frontend',
    categoryLabel: 'Frontend',
    description: 'Engineers crafting strictly-typed, scalable frontend codebases and fullstack TypeScript architectures.',
    skills: ['Strict Typing', 'Generics', 'AST / Tooling', 'Clean Architecture'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 8h8M12 8v8M16 16v-5" />
      </svg>
    ),
  },
  {
    id: 'vue-dev',
    title: 'Vue & Nuxt Developers',
    category: 'frontend',
    categoryLabel: 'Frontend',
    description: 'Senior engineers in Vue 3, Composition API, Pinia state management, and Nuxt fullstack web applications.',
    skills: ['Vue 3', 'Nuxt 3', 'Composition API', 'Pinia'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="2 3 12 21 22 3 17 3 12 12 7 3 2 3" />
      </svg>
    ),
  },
  {
    id: 'javascript-dev',
    title: 'Core JavaScript Engineers',
    category: 'frontend',
    categoryLabel: 'Frontend',
    description: 'Modern ES6+ frontend engineers proficient in DOM performance tuning, Web APIs, and micro-frontends.',
    skills: ['ESNext', 'Web Performance', 'Micro-Frontends', 'Wasm'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M16 8v8a2 2 0 0 1-2 2h-1M8 12a2 2 0 0 1 2-2h1v6a2 2 0 0 1-2 2H8" />
      </svg>
    ),
  },
  {
    id: 'angular-dev',
    title: 'Angular Specialists',
    category: 'frontend',
    categoryLabel: 'Frontend',
    description: 'Enterprise Angular developers experienced in RxJS reactive pipelines, NgRx, and large-scale ERP interfaces.',
    skills: ['Angular 17+', 'RxJS', 'NgRx', 'Enterprise ERP'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 2 6 4 18 12 22 20 18 22 6 12 2" />
        <polygon points="12 6 7 17 9 17 10 14 14 14 15 17 17 17 12 6" />
      </svg>
    ),
  },

  // BACKEND & CLOUD
  {
    id: 'nodejs-dev',
    title: 'Node.js & NestJS Developers',
    category: 'backend',
    categoryLabel: 'Backend',
    description: 'High-throughput event-driven microservices, REST/GraphQL APIs, Express, and enterprise NestJS backend systems.',
    skills: ['Node.js', 'NestJS', 'Microservices', 'PostgreSQL'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2 3 7v10l9 5 9-5V7l-9-5z" />
        <path d="M12 22V12M12 12 3 7M12 12l9-5" />
      </svg>
    ),
  },
  {
    id: 'python-dev',
    title: 'Python & FastAPI Developers',
    category: 'backend',
    categoryLabel: 'Backend',
    description: 'High-performance async Python backends, FastAPI microservices, Django web platforms, and data pipeline orchestration.',
    skills: ['Python 3.12', 'FastAPI', 'Celery / Redis', 'AsyncIO'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 9H7a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h1v-2a3 3 0 0 1 3-3h3a2 2 0 0 0 2-2V7a4 4 0 0 0-4-4h-2a4 4 0 0 0-4 4v1h7a2 2 0 0 1 2 2v1z" />
      </svg>
    ),
  },
  {
    id: 'java-dev',
    title: 'Java & Spring Boot Developers',
    category: 'backend',
    categoryLabel: 'Backend',
    description: 'Mission-critical enterprise applications, Spring Cloud distributed systems, multithreading, and banking integrations.',
    skills: ['Java 21', 'Spring Boot 3', 'Hibernate', 'Kafka'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 19c0 1.5 2.5 3 6 3s6-1.5 6-3M6 15c0 1.5 2.5 3 6 3s6-1.5 6-3M4 11h16M12 3v8" />
      </svg>
    ),
  },
  {
    id: 'golang-dev',
    title: 'Go (Golang) Developers',
    category: 'backend',
    categoryLabel: 'Backend',
    description: 'Low-latency backend services, gRPC pipelines, concurrent network services, and Kubernetes cloud infrastructure.',
    skills: ['Golang', 'Goroutines', 'gRPC & Protobuf', 'Docker'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="12" r="3" />
        <path d="M9 12h6M12 9v6" />
      </svg>
    ),
  },
  {
    id: 'laravel-dev',
    title: 'PHP & Laravel Developers',
    category: 'backend',
    categoryLabel: 'Backend',
    description: 'Modern PHP 8+ architects, Laravel Livewire, Inertia.js, payment gateway integration, and relational database tuning.',
    skills: ['PHP 8.3', 'Laravel 11', 'MySQL', 'REST APIs'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    id: 'graphql-dev',
    title: 'GraphQL & API Engineers',
    category: 'backend',
    categoryLabel: 'Backend',
    description: 'Apollo Federation, GraphQL schema stitching, subgraphs, query caching, and seamless multi-client data fetching.',
    skills: ['GraphQL', 'Apollo Server', 'Federation', 'Rate Limiting'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      </svg>
    ),
  },
  {
    id: 'devops-dev',
    title: 'DevOps & Cloud Engineers',
    category: 'backend',
    categoryLabel: 'Backend',
    description: 'AWS, GCP, Azure certified engineers, Kubernetes clusters, Terraform IaC, and zero-downtime CI/CD automation.',
    skills: ['Kubernetes', 'Terraform', 'AWS / GCP', 'CI/CD Pipelines'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.1 11.2 3.9 3.9 0 0 0 6.5 19z" />
      </svg>
    ),
  },

  // MOBILE
  {
    id: 'react-native-dev',
    title: 'React Native Developers',
    category: 'mobile',
    categoryLabel: 'Mobile',
    description: 'Cross-platform mobile apps for iOS and Android with native bridging, Expo, offline storage, and smooth 60fps animations.',
    skills: ['React Native', 'Expo', 'Native Bridges', 'Reanimated'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
  },
  {
    id: 'flutter-dev',
    title: 'Flutter Developers',
    category: 'mobile',
    categoryLabel: 'Mobile',
    description: 'Dart specialists crafting high-performance, single-codebase mobile and web apps with custom skia graphics.',
    skills: ['Flutter 3', 'Dart', 'Bloc / Riverpod', 'Clean Architecture'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m14 2-8 8 8 8 5-5-3-3 3-3-5-5z" />
      </svg>
    ),
  },
  {
    id: 'ios-dev',
    title: 'iOS & Swift Developers',
    category: 'mobile',
    categoryLabel: 'Mobile',
    description: 'Native iOS experts proficient in Swift, SwiftUI, Combine, CoreData, and Apple App Store guidelines.',
    skills: ['Swift 5.9', 'SwiftUI', 'Combine', 'Apple Pay / IAP'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20.94c1.5 0 2.75-.5 3.75-1.5 1-1 1.5-2.25 1.5-3.75s-.5-2.75-1.5-3.75c-1-1-2.25-1.5-3.75-1.5s-2.75.5-3.75 1.5c-1 1-1.5 2.25-1.5 3.75s.5 2.75 1.5 3.75c1 1 2.25 1.5 3.75 1.5z" />
        <path d="M12 10.44V3.06" />
      </svg>
    ),
  },
  {
    id: 'android-dev',
    title: 'Android & Kotlin Developers',
    category: 'mobile',
    categoryLabel: 'Mobile',
    description: 'Native Android developers with Jetpack Compose, Kotlin Coroutines, Room DB, and modular multi-module architectures.',
    skills: ['Kotlin', 'Jetpack Compose', 'Coroutines', 'Material 3'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 10h16v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-8Z" />
        <path d="M8 6l-2-3M16 6l2-3" />
        <circle cx="8" cy="14" r="1" />
        <circle cx="16" cy="14" r="1" />
      </svg>
    ),
  },
  {
    id: 'mobile-qa',
    title: 'Mobile QA Automation Engineers',
    category: 'mobile',
    categoryLabel: 'Mobile',
    description: 'Appium, Maestro, and Detox automation specialists testing across physical device farms and CI testing pipelines.',
    skills: ['Appium', 'Maestro', 'Detox', 'Device Farm CI'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 12 2 2 4-4" />
        <rect x="5" y="2" width="14" height="20" rx="2" />
      </svg>
    ),
  },
  {
    id: 'liferay-dev',
    title: 'Liferay Enterprise Developers',
    category: 'mobile',
    categoryLabel: 'Mobile',
    description: 'Enterprise portal customization, OSGi modules, service builder pipelines, and corporate intranet solutions.',
    skills: ['Liferay DXP', 'OSGi Modules', 'Service Builder', 'SSO & SAML'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },

  // AI & DATA
  {
    id: 'ai-ml-engineer',
    title: 'AI & ML Engineers',
    category: 'ai-data',
    categoryLabel: 'AI & Data',
    description: 'Custom LLM fine-tuning, LangChain / LlamaIndex workflows, vector databases (Pinecone, Qdrant), and agentic pipelines.',
    skills: ['LLM Fine-Tuning', 'LangChain / RAG', 'Vector DBs', 'PyTorch'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="8" width="16" height="12" rx="3" />
        <path d="M12 4.4V8M9.4 13.4v1.6M14.6 13.4v1.6M2 13v3M22 13v3" />
        <circle cx="12" cy="3" r="1.4" />
      </svg>
    ),
  },
  {
    id: 'data-engineer',
    title: 'Data Platform Engineers',
    category: 'ai-data',
    categoryLabel: 'AI & Data',
    description: 'Streaming data pipelines with Apache Kafka, Spark, Snowflake, BigQuery, dbt, and modern data warehouses.',
    skills: ['Apache Kafka', 'Snowflake / BigQuery', 'dbt', 'Airflow'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <ellipse cx="12" cy="5.6" rx="8" ry="3.2" />
        <path d="M4 5.6v12.8c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V5.6M4 12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" />
      </svg>
    ),
  },
  {
    id: 'prompt-engineer',
    title: 'Generative AI & Prompt Engineers',
    category: 'ai-data',
    categoryLabel: 'AI & Data',
    description: 'Optimized system prompts, automated synthetic evaluation harnesses, guardrails, and agentic cognitive workflows.',
    skills: ['Prompt Optimization', 'Guardrails', 'Autonomous Agents', 'Eval Harness'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      </svg>
    ),
  },

  // CMS & E-COMMERCE
  {
    id: 'shopify-dev',
    title: 'Shopify & Liquid Developers',
    category: 'cms-ecommerce',
    categoryLabel: 'CMS & Store',
    description: 'Custom Shopify Plus themes, private apps, Hydrogen headless storefronts, and checkout extension integrations.',
    skills: ['Shopify Plus', 'Hydrogen / Oxygen', 'Liquid', 'Custom Apps'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    id: 'webflow-dev',
    title: 'Webflow & Headless CMS Devs',
    category: 'cms-ecommerce',
    categoryLabel: 'CMS & Store',
    description: 'Custom Webflow interactions, Client-First style systems, Memberstack, custom JavaScript hooks, and CMS collections.',
    skills: ['Webflow', 'Client-First', 'Custom JS APIs', 'SEO Tuning'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
      </svg>
    ),
  },
  {
    id: 'strapi-directus-dev',
    title: 'Strapi & Directus Specialists',
    category: 'cms-ecommerce',
    categoryLabel: 'CMS & Store',
    description: 'Headless CMS schema modeling, custom plugin development, webhook integrations, and multi-channel content APIs.',
    skills: ['Strapi v4/v5', 'Directus', 'Contentful', 'GraphQL APIs'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <line x1="8" y1="12" x2="16" y2="12" />
        <line x1="12" y1="8" x2="12" y2="16" />
      </svg>
    ),
  },

  // DESIGN & UI/UX
  {
    id: 'figma-designer',
    title: 'Figma UI/UX Designers',
    category: 'design',
    categoryLabel: 'Design',
    description: 'Design system architects crafting scalable token libraries, auto-layout components, user flows, and high-fidelity prototypes.',
    skills: ['Figma Variables', 'Design Tokens', 'User Journey Mapping', 'Prototypes'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
        <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
        <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
        <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" />
        <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
      </svg>
    ),
  },
  {
    id: 'framer-developer',
    title: 'Framer & Interactive Designers',
    category: 'design',
    categoryLabel: 'Design',
    description: 'Interactive Framer developers creating fluid micro-animations, 3D Canvas elements, and responsive marketing experiences.',
    skills: ['Framer', 'React Animation', 'Fluid Micro-Interactions', 'CMS Sync'],
    iconSvg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 2h14v7H5zM5 9h14l-7 7H5zM5 16l7 7v-7H5z" />
      </svg>
    ),
  },
]

type TalentCategory = 'all' | 'frontend' | 'backend' | 'mobile' | 'ai-data' | 'cms-ecommerce' | 'design'

export default function HireTalentPage() {
  const [selectedCategory, setSelectedCategory] = useState<TalentCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredRoles = useMemo(() => {
    return ALL_TALENT_ROLES.filter((role) => {
      const matchesCategory = selectedCategory === 'all' || role.category === selectedCategory
      const matchesSearch =
        searchQuery.trim() === '' ||
        role.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  const counts = useMemo(() => {
    return {
      all: ALL_TALENT_ROLES.length,
      frontend: ALL_TALENT_ROLES.filter((r) => r.category === 'frontend').length,
      backend: ALL_TALENT_ROLES.filter((r) => r.category === 'backend').length,
      mobile: ALL_TALENT_ROLES.filter((r) => r.category === 'mobile').length,
      'ai-data': ALL_TALENT_ROLES.filter((r) => r.category === 'ai-data').length,
      'cms-ecommerce': ALL_TALENT_ROLES.filter((r) => r.category === 'cms-ecommerce').length,
      design: ALL_TALENT_ROLES.filter((r) => r.category === 'design').length,
    }
  }, [])

  return (
    <SiteView route="hire-talent">
      {/* ── EMBEDDED STYLES FOR 5-COLUMN RESPONSIVE GRID ── */}
      <style>{`
        .talent-5col-wrap {
          width: 100%;
          max-width: min(1540px, 95vw);
          margin-inline: auto;
          padding-inline: clamp(16px, 3vw, 36px);
        }
        .talent-5col-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
        }
        @media (max-width: 1400px) {
          .talent-5col-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }
        }
        @media (max-width: 1100px) {
          .talent-5col-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
          }
        }
        @media (max-width: 780px) {
          .talent-5col-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
        }
        @media (max-width: 480px) {
          .talent-5col-grid {
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
            <span>Hire Dedicated Talent</span>
          </p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">
            Build your team with pre-vetted tech experts
          </h1>
          <p className="hero__sub" data-rv="up" data-delay="160">
            Scale your engineering organization instantly with top software developers, AI engineers, and technical leads matched specifically for your tech stack.
          </p>

          {/* Quick Metrics Bar */}
          <div
            className="grid g4"
            style={{ marginTop: "40px", gap: "16px" }}
            data-rv="up"
            data-delay="220"
          >
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>Vetted</b>
              <span>Pre-Screened Senior Engineers</span>
              <em>Rigorous Assessment</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>Fast</b>
              <span>Shortlists After a Discovery Call</span>
              <em>No Long Hiring Cycles</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>Aligned</b>
              <span>Overlapping Working Hours</span>
              <em>Seamless Daily Collaboration</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>Flexible</b>
              <span>Engagement Terms</span>
              <em>Scale Up or Down</em>
            </div>
          </div>
        </div>
      </section>

      {/* ── FILTER & SEARCH SECTION (CLEAN FROSTED CAPSULE BAR) ──────── */}
      <section className="section" style={{ paddingTop: "24px", paddingBottom: "20px" }}>
        <div className="talent-5col-wrap">
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
                { key: 'all', label: 'All Talent', count: counts.all },
                { key: 'frontend', label: 'Frontend', count: counts.frontend },
                { key: 'backend', label: 'Backend & Cloud', count: counts.backend },
                { key: 'mobile', label: 'Mobile', count: counts.mobile },
                { key: 'ai-data', label: 'AI & Data', count: counts['ai-data'] },
                { key: 'cms-ecommerce', label: 'CMS & Store', count: counts['cms-ecommerce'] },
                { key: 'design', label: 'Design & UX', count: counts.design },
              ].map((tab) => {
                const isActive = selectedCategory === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedCategory(tab.key as TalentCategory)}
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
                placeholder="Search skills (e.g., React, Python, Flutter)..."
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
      <section className="section" id="hire-talent" style={{ paddingTop: "24px" }}>
        <div className="talent-5col-wrap">
          {filteredRoles.length === 0 ? (
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
              <h3 className="h-sm">No talent profiles match &ldquo;{searchQuery}&rdquo;</h3>
              <p className="small" style={{ color: "var(--muted)", maxWidth: "420px" }}>
                Try searching for another skill like &ldquo;React&rdquo;, &ldquo;Python&rdquo;, &ldquo;Golang&rdquo;, or reset your filters.
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
            <div className="talent-5col-grid">
              {filteredRoles.map((role) => (
                <article
                  key={role.id}
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
                        {role.iconSvg}
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
                        {role.categoryLabel}
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
                      {role.title}
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
                      {role.description}
                    </p>

                    {/* Skills Pills */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "16px" }}>
                      {role.skills.map((s, i) => (
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
                          {s}
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
                      to={`/contact?role=${encodeURIComponent(role.title)}`}
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
                      <span>Hire now</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </Link>
                    <span style={{ fontFamily: "var(--f-mono)", fontSize: "9px", color: "var(--dim)", textTransform: "uppercase" }}>
                      VETTED
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 4-STEP VETTING PROCESS SECTION ──────────────────────────── */}
      <section className="section" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: "680px", margin: "0 auto 44px" }}>
            <p className="eyebrow" style={{ justifyContent: "center" }}>
              <span className="bars"><i></i><i></i><i></i></span>
              <span>Our Vetting Standard</span>
            </p>
            <h2 className="h-lg" style={{ marginTop: "12px" }}>
              Only vetted engineers make it through
            </h2>
            <p className="lead" style={{ marginTop: "14px", fontSize: "1.05rem" }}>
              We do the evaluation so you don&apos;t have to. Every engineer is pre-screened for technical depth, code quality, and fast communication.
            </p>
          </div>

          <div className="grid g4" style={{ gap: "16px" }}>
            <article className="card card--flat" style={{ padding: "clamp(20px, 2.5vw, 28px)" }}>
              <span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "10px", marginBottom: "14px" }}>
                <span style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: "15px" }}>01</span>
              </span>
              <h4 style={{ fontSize: "1.05rem", marginBottom: "8px" }}>Language &amp; Cultural Fit</h4>
              <p className="small" style={{ color: "var(--muted)" }}>
                Fluent English communication, proactive problem solving, and timezone-aligned collaboration.
              </p>
            </article>

            <article className="card card--flat" style={{ padding: "clamp(20px, 2.5vw, 28px)" }}>
              <span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "10px", marginBottom: "14px" }}>
                <span style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: "15px" }}>02</span>
              </span>
              <h4 style={{ fontSize: "1.05rem", marginBottom: "8px" }}>Algorithms &amp; Coding</h4>
              <p className="small" style={{ color: "var(--muted)" }}>
                Live pair-programming tests and algorithmic problem solving under realistic conditions.
              </p>
            </article>

            <article className="card card--flat" style={{ padding: "clamp(20px, 2.5vw, 28px)" }}>
              <span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "10px", marginBottom: "14px" }}>
                <span style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: "15px" }}>03</span>
              </span>
              <h4 style={{ fontSize: "1.05rem", marginBottom: "8px" }}>System Architecture</h4>
              <p className="small" style={{ color: "var(--muted)" }}>
                Deep-dive architectural reviews, database schema design, and production readiness evaluation.
              </p>
            </article>

            <article className="card card--flat" style={{ padding: "clamp(20px, 2.5vw, 28px)" }}>
              <span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "10px", marginBottom: "14px" }}>
                <span style={{ fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: "15px" }}>04</span>
              </span>
              <h4 style={{ fontSize: "1.05rem", marginBottom: "8px" }}>Start Small, Then Scale</h4>
              <p className="small" style={{ color: "var(--muted)" }}>
                Begin with one engineer on a well-scoped piece of work and grow the team once it is working for you.
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
              <span>Instant Engineering Scale</span>
            </p>
            <h2 className="h-lg" style={{ marginTop: "14px", maxWidth: "680px", margin: "14px auto 0" }}>
              Ready to hire top engineers for your stack?
            </h2>
            <p className="lead" style={{ marginTop: "16px", maxWidth: "580px", margin: "16px auto 32px" }}>
              Tell us what skills you need. We will match you with shortlisted, ready-to-interview candidates after a short discovery call.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", justifyContent: "center" }}>
              <Link to="/contact" className="btn btn-primary btn-lg">
                <span>Request Engineer Profiles</span>
                <svg className="arw" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
              <Link to="/services" className="btn btn-ghost btn-lg">
                <span>Explore Managed Services</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
