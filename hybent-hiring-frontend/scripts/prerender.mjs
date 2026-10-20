/**
 * Fills each per-page SEO copy (dist/_seo/*.html, written by
 * vite-plugins/seoPages.ts) with that page's rendered body.
 *
 * The site is a client-side SPA, so without this every public page reaches
 * crawlers as an empty <div id="root"></div>. Google renders JavaScript late
 * and not always; most AI search crawlers don't render it at all. Here each
 * page is loaded in headless Chrome against the built dist/ and its markup is
 * written into a sibling #hb-prerender. #root stays hidden while that sibling
 * exists, and SiteView removes it the moment React mounts the real page.
 *
 * Run after `npm run build`: `npm run prerender`.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const SEO_DIR = path.join(DIST, '_seo')
const ROOT_TAG = '<div id="root"></div>'
const MARKER = 'id="hb-prerender"'

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain',
}

function seoFiles(dir = SEO_DIR) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? seoFiles(full) : entry.name.endsWith('.html') ? [full] : []
  })
}

function pagePath(file) {
  const rel = path.relative(SEO_DIR, file).replace(/\\/g, '/').replace(/\.html$/, '')
  return rel === 'index' ? '/' : `/${rel}`
}

/** Static dist/ server with the SPA fallback, so the app renders every route itself. */
function serve() {
  const shell = fs.readFileSync(path.join(DIST, 'index.html'))
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const file = path.join(DIST, urlPath)
    if (file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
      fs.createReadStream(file).pipe(res)
    } else if (urlPath.startsWith('/v1') || urlPath.startsWith('/api')) {
      res.writeHead(404).end()
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(shell)
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

async function render(browser, origin, route) {
  const page = await browser.newPage()
  try {
    await page.setBypassServiceWorker(true)
    await page.setViewport({ width: 1366, height: 900 })
    // Reduced motion makes useSiteBehaviours reveal every [data-rv] section
    // and set counters to their final values instead of animating from 0.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.goto(origin + route, { waitUntil: 'networkidle0', timeout: 60_000 })
    await page.waitForSelector('#root .hb-site', { timeout: 30_000 })
    // The cookie banner depends on each visitor's stored choice; baked into
    // the snapshot it would flash for people who already answered it.
    await page.evaluate(() => document.querySelector('[aria-labelledby="cookie-banner-title"]')?.remove())
    return await page.evaluate(() => ({
      body: document.getElementById('root').innerHTML,
      styles: [...document.querySelectorAll('head link[rel="stylesheet"]')].map((l) => l.getAttribute('href')),
      h1: document.querySelectorAll('#root h1').length,
      words: document.getElementById('root').innerText.split(/\s+/).filter(Boolean).length,
    }))
  } finally {
    await page.close()
  }
}

function inject(html, { body, styles }) {
  if (html.includes(MARKER)) throw new Error('already prerendered')
  if (!html.includes(ROOT_TAG)) throw new Error(`missing ${ROOT_TAG}`)
  const links = styles
    .filter((href) => href && !html.includes(`href="${href}"`))
    .map((href) => `    <link rel="stylesheet" crossorigin href="${href}">\n`)
    .join('')
  return html
    .replace('</head>', `${links}    <style>#hb-prerender ~ #root { display: none }</style>\n  </head>`)
    .replace(ROOT_TAG, `<div ${MARKER}>${body}</div>\n    ${ROOT_TAG}`)
}

const files = seoFiles()
const server = await serve()
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
const failures = []

try {
  for (const file of files) {
    const route = pagePath(file)
    try {
      // One retry: headless Chrome occasionally drops a new tab's session.
      const result = await render(browser, origin, route).catch(() => render(browser, origin, route))
      if (result.words < 50) throw new Error(`only ${result.words} words rendered`)
      fs.writeFileSync(file, inject(fs.readFileSync(file, 'utf-8'), result))
      console.log(`[prerender] ${route}  h1=${result.h1}  words=${result.words}`)
    } catch (err) {
      failures.push(route)
      console.error(`[prerender] FAILED ${route}: ${err.message}`)
    }
  }
} finally {
  await browser.close()
  server.close()
}

// A page that silently ships empty is the bug this script exists to fix.
if (failures.length) {
  console.error(`[prerender] ${failures.length} page(s) failed: ${failures.join(', ')}`)
  process.exit(1)
}
console.log(`[prerender] ${files.length} pages prerendered`)
