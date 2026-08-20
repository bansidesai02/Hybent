export interface SolutionItem {
  label: string;
  href: string;
}

export interface SolutionGroup {
  title: string;
  items: SolutionItem[];
}

export interface SolutionSection {
  key: string;
  label: string;
  blurb: string;
  href: string;
  groups: SolutionGroup[];
}

export const SOLUTIONS_SECTIONS: SolutionSection[] = [
  {
    key: "services",
    label: "Services",
    blurb: "What we build, run, and improve for you.",
    href: "/services",
    groups: [
      {
        title: "GROW & SCALE",
        items: [
          { label: "Performance Marketing Services", href: "/services/performance-marketing" },
          { label: "eCommerce Growth Solutions", href: "/services/ecommerce-growth" },
          { label: "UX Optimization & Accessibility", href: "/services/ux-optimization-accessibility" },
          { label: "IT Strategy & Process Optimization", href: "/services/it-strategy-process-optimization" },
          { label: "Application Maintenance & Support", href: "/services/application-maintenance-support" },
          { label: "IT Staff Augmentation Services", href: "/services/it-staff-augmentation" },
          { label: "B2B Lead Generation Solutions", href: "/services/b2b-lead-generation" },
          { label: "Business Intelligence & Analytics", href: "/services/business-intelligence-analytics" },
        ],
      },
      {
        title: "TRANSFORM",
        items: [
          { label: "Legacy App Modernization", href: "/services/legacy-app-modernization" },
          { label: "AI & Machine Learning Integration", href: "/services/ai-machine-learning" },
          { label: "Cloud Infrastructure & DevOps", href: "/services/cloud-infrastructure-devops" },
          { label: "IoT & Smart Connected Solutions", href: "/services/iot-smart-connected-solutions" },
        ],
      },
      {
        title: "STRATEGIC CONSULTING",
        items: [
          { label: "Product Strategy & Scoping", href: "/services/product-strategy-scoping" },
          { label: "Technology & Architecture Consulting", href: "/services/technology-architecture-consulting" },
          { label: "Design Systems & UI/UX Consulting", href: "/services/design-systems-ui-ux" },
          { label: "Digital Marketing & Growth Consulting", href: "/services/digital-marketing-growth" },
        ],
      },
      {
        title: "CORE ENGINEERING",
        items: [
          { label: "Custom Enterprise Software", href: "/services/custom-enterprise-software" },
          { label: "Web & Mobile Engineering", href: "/services/web-mobile-engineering" },
          { label: "IT Security & Compliance", href: "/services/it-security-compliance" },
          { label: "Data Engineering & Pipelines", href: "/services/data-engineering-pipelines" },
        ],
      },
    ],
  },
  {
    key: "industries",
    label: "Industries",
    blurb: "Sectors we already know the constraints of.",
    href: "/industries",
    groups: [
      {
        title: "INDUSTRIAL, MOBILITY & INFRASTRUCTURE",
        items: [
          { label: "Manufacturing", href: "/industries/manufacturing" },
          { label: "Real Estate & Construction", href: "/industries/real-estate" },
          { label: "Mobility & Automotive", href: "/industries/automotive" },
          { label: "Travel & Hospitality", href: "/industries/travel" },
        ],
      },
      {
        title: "DIGITAL, CONSUMER & MEDIA",
        items: [
          { label: "Ecommerce & Retail", href: "/industries/ecommerce" },
          { label: "B2B SaaS", href: "/industries/saas" },
          { label: "Technology & Software", href: "/industries/technology" },
          { label: "Telecommunications", href: "/industries/telecom" },
          { label: "Media & Entertainment", href: "/industries/media" },
        ],
      },
      {
        title: "REGULATED & PUBLIC SERVICES",
        items: [
          { label: "Banking & Finance", href: "/industries/banking-finance" },
          { label: "Government & Public Sector", href: "/industries/government" },
          { label: "Healthcare & Wellness", href: "/industries/healthcare" },
          { label: "Professional Services", href: "/industries/professional-services" },
          { label: "Education", href: "/industries/education" },
        ],
      },
    ],
  },
  {
    key: "hire-talent",
    label: "Hire Talent",
    blurb: "Vetted engineers, ready to start on your stack.",
    href: "/hire-talent",
    groups: [
      {
        title: "FRONTEND",
        items: [
          { label: "JavaScript Developers", href: "/hire-talent/javascript" },
          { label: "TypeScript Developers", href: "/hire-talent/typescript" },
          { label: "React Developers", href: "/hire-talent/react" },
          { label: "Nuxt JS Developers", href: "/hire-talent/nuxt" },
          { label: "Next JS Developers", href: "/hire-talent/nextjs" },
          { label: "Vue JS Developers", href: "/hire-talent/vue" },
        ],
      },
      {
        title: "BACKEND",
        items: [
          { label: "GraphQL Developers", href: "/hire-talent/graphql" },
          { label: "Java Developers", href: "/hire-talent/java" },
          { label: "Laravel Developers", href: "/hire-talent/laravel" },
          { label: "Liferay Developers", href: "/hire-talent/liferay" },
          { label: "Node JS Developers", href: "/hire-talent/nodejs" },
          { label: "Nest JS Developers", href: "/hire-talent/nestjs" },
          { label: "PHP Developers", href: "/hire-talent/php" },
        ],
      },
      {
        title: "MOBILE",
        items: [
          { label: "Flutter Developers", href: "/hire-talent/flutter" },
          { label: "React Native Developers", href: "/hire-talent/react-native" },
          { label: "iOS Developers", href: "/hire-talent/ios" },
          { label: "Kotlin Developers", href: "/hire-talent/kotlin" },
          { label: "Android Developers", href: "/hire-talent/android" },
          { label: "Swift Developers", href: "/hire-talent/swift" },
        ],
      },
      {
        title: "CMS",
        items: [
          { label: "Webflow Developers", href: "/hire-talent/webflow" },
          { label: "Directus Developers", href: "/hire-talent/directus" },
          { label: "dotCMS Developers", href: "/hire-talent/dotcms" },
          { label: "Strapi Developers", href: "/hire-talent/strapi" },
          { label: "Contentful Developers", href: "/hire-talent/contentful" },
        ],
      },
      {
        title: "DESIGN",
        items: [
          { label: "Figma Designers", href: "/hire-talent/figma" },
          { label: "Framer Developers", href: "/hire-talent/framer" },
        ],
      },
      {
        title: "E-COMMERCE",
        items: [
          { label: "Shopify Developers", href: "/hire-talent/shopify" },
        ],
      },
    ],
  },
];
