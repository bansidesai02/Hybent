import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import path from 'path'
import { seoPages } from './vite-plugins/seoPages'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'firebase-messaging-sw.ts',
      // The per-page SEO copies of index.html are for crawlers; precaching all
      // of them would only bloat every visitor's install.
      injectManifest: {
        globIgnores: ['**/node_modules/**/*', '_seo/**'],
      },
      injectRegister: 'auto',
      // Without this, a deployed update sits waiting in the background until
      // every open tab is fully closed — the old service worker (and its
      // stale cached bundle) keeps controlling any tab left open from before
      // the deploy, indefinitely. autoUpdate + skipWaiting/clientsClaim in
      // the service worker itself (below) makes a new deploy take over on
      // the very next load instead.
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      // The installed app (Add to Home Screen / Install app). It opens straight
      // into the signed-in workspace — /dashboard resolves the user's role, or
      // shows sign-in — never the marketing homepage.
      manifest: {
        id: '/dashboard',
        name: 'Hybent Hiring',
        short_name: 'Hybent',
        description: 'Hybent Hiring: AI-powered recruitment automation platform',
        theme_color: '#FBFCFE',
        background_color: '#FFFFFF',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        start_url: '/dashboard?source=pwa',
        scope: '/',
        categories: ['business', 'productivity'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Padded into the safe zone, so Android's circle/squircle crop
          // never cuts the mark.
          { src: 'pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press the app icon. `/dashboard?to=…` resolves the user's own
        // workspace, so one set of shortcuts works for every role.
        shortcuts: [
          { name: 'Copilot', url: '/dashboard?to=copilot', icons: [{ src: 'pwa-maskable-192x192.png', sizes: '192x192' }] },
          { name: 'Candidates', url: '/dashboard?to=candidates', icons: [{ src: 'pwa-maskable-192x192.png', sizes: '192x192' }] },
          { name: 'Pipeline', url: '/dashboard?to=pipeline', icons: [{ src: 'pwa-maskable-192x192.png', sizes: '192x192' }] },
          { name: 'Schedule', url: '/dashboard?to=interviews', icons: [{ src: 'pwa-maskable-192x192.png', sizes: '192x192' }] },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
    seoPages(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'lucide-react', 'react-hot-toast'],
          'vendor-utils': ['axios', '@tanstack/react-query', 'zustand', 'zod', 'date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    // Allow tunnelled hosts (cloudflared / ngrok) to reach the dev server
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
    // Proxy API calls to backend during development — this is the frontend↔backend connection.
    // Defaults to localhost:8000 for `npm run dev` on the host; when the frontend
    // itself runs in its own Docker container, "localhost" there is the frontend
    // container, not the backend one — docker-compose.yml overrides this via
    // VITE_DEV_PROXY_TARGET to the backend's Compose service name instead.
    proxy: (() => {
      const target = process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8000'
      const wsTarget = target.replace(/^http/, 'ws')
      return {
        // `ws: true` — the realtime socket lives under /v1 too
        // (/v1/notifications/ws). Without it the upgrade is never forwarded,
        // the socket silently fails, and nothing live reaches the browser.
        '/v1': { target, changeOrigin: true, secure: false, ws: true },
        '/api': { target, changeOrigin: true, secure: false },
        '/static': { target, changeOrigin: true, secure: false },
        '/ws': { target: wsTarget, ws: true, changeOrigin: true },
      }
    })(),
  },
})
