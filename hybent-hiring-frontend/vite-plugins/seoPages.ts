import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { SHOW_CUSTOMERS } from '../src/app/paths'
import { ROUTE_META } from '../src/app/routeMeta'
import { SITE_ORIGIN, routeMetaPath, serviceMeta, type PageMeta } from '../src/app/seo'
import { SERVICES_DATA } from '../src/modules/site/data/servicesData'

/**
 * The site is a static SPA on Hostinger, so every URL used to be answered with
 * the same index.html — one title, one description, no canonical — and search
 * engines saw every page as a duplicate of the homepage. After the build this
 * writes a copy of index.html per public page into dist/_seo/ with that page's
 * head filled in, plus a sitemap.xml listing the same pages. public/.htaccess
 * (and nginx.conf.template) serve the copy when one exists for the request.
 */

const SEO_DIR = '_seo'

function publicPages(): PageMeta[] {
  const sitePages = Object.entries(ROUTE_META)
    .filter(([key]) => SHOW_CUSTOMERS || key !== 'customers')
    .map(([key, meta]) => ({ ...meta, path: routeMetaPath(key) }))
  const servicePages = Object.values(SERVICES_DATA).map(serviceMeta)
  return [...sitePages, ...servicePages]
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pageHtml(template: string, page: PageMeta): string {
  const url = SITE_ORIGIN + page.path
  let html = template

  // Throw rather than skip: a silently unmatched tag would ship the homepage's
  // value on every page, which is the exact bug this plugin exists to fix.
  const replace = (pattern: RegExp, value: string, label: string) => {
    if (!pattern.test(html)) throw new Error(`[seo-pages] index.html is missing ${label}`)
    html = html.replace(pattern, (_match, open: string, close: string) => open + value + close)
  }
  const setMeta = (attr: string, value: string) =>
    replace(new RegExp(`(<meta ${attr} content=")[^"]*(")`), escapeAttr(value), `<meta ${attr}>`)

  replace(/(<title>)[^<]*(<\/title>)/, escapeAttr(page.title), '<title>')
  setMeta('name="description"', page.description)
  setMeta('property="og:url"', url)
  setMeta('property="og:title"', page.title)
  setMeta('property="og:description"', page.description)
  setMeta('name="twitter:title"', page.title)
  setMeta('name="twitter:description"', page.description)
  replace(/()(<\/head>)/, `  <link rel="canonical" href="${url}" />\n  `, '</head>')
  return html
}

function sitemapXml(pages: PageMeta[], lastmod: string): string {
  const urls = pages.map((page) => {
    const priority = page.path === '/' ? '1.0' : page.path.startsWith('/services/') ? '0.7' : '0.8'
    return `  <url>\n    <loc>${SITE_ORIGIN}${page.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n  </url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function seoPages(): Plugin {
  let outDir = ''
  return {
    name: 'hybent-seo-pages',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    writeBundle() {
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8')
      const pages = publicPages()
      for (const page of pages) {
        const file = path.join(outDir, SEO_DIR, page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, pageHtml(template, page))
      }
      const lastmod = new Date().toISOString().slice(0, 10)
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemapXml(pages, lastmod))
    },
  }
}
