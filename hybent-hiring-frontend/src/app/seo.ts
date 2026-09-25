import type { ServiceDetail } from '@/modules/site/data/servicesData'

/**
 * Head metadata for public pages. The same values are applied twice: at build
 * time into a per-page copy of index.html (vite-plugins/seoPages.ts), so
 * crawlers and link previews get the right head without running JS, and at
 * runtime by applyPageMeta as the SPA navigates between pages.
 */
export const SITE_ORIGIN = 'https://hybent.com'

export interface PageMeta {
  path: string
  title: string
  description: string
}

/** The path each ROUTE_META key is served at. */
export function routeMetaPath(key: string): string {
  if (key === 'index') return '/'
  if (key === 'hiring') return '/products/hiring'
  return `/${key}`
}

export function serviceMeta(service: ServiceDetail): PageMeta {
  return {
    path: `/services/${service.slug}`,
    title: service.seo?.title || `${service.title} | HYBENT Services`,
    description: service.seo?.description || service.summary,
  }
}

export function applyPageMeta({ path, title, description }: PageMeta) {
  document.title = title
  const setContent = (selector: string, value: string) =>
    document.querySelector(selector)?.setAttribute('content', value)
  setContent('meta[name="description"]', description)
  setContent('meta[property="og:title"]', title)
  setContent('meta[property="og:description"]', description)
  setContent('meta[property="og:url"]', SITE_ORIGIN + path)
  setContent('meta[name="twitter:title"]', title)
  setContent('meta[name="twitter:description"]', description)

  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = SITE_ORIGIN + path
}
