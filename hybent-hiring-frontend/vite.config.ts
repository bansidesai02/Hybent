import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'firebase-messaging-sw.ts',
      injectRegister: 'auto',
      // Without this, a deployed update sits waiting in the background until
      // every open tab is fully closed — the old service worker (and its
      // stale cached bundle) keeps controlling any tab left open from before
      // the deploy, indefinitely. autoUpdate + skipWaiting/clientsClaim in
      // the service worker itself (below) makes a new deploy take over on
      // the very next load instead.
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      manifest: {
        name: 'Hybent Hiring',
        short_name: 'Hybent Hiring',
        description: 'Hybent Hiring: AI-powered recruitment automation platform',
        theme_color: '#FBFCFE',
        background_color: '#FBFCFE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
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
        '/v1': { target, changeOrigin: true, secure: false },
        '/api': { target, changeOrigin: true, secure: false },
        '/static': { target, changeOrigin: true, secure: false },
        '/ws': { target: wsTarget, ws: true, changeOrigin: true },
      }
    })(),
  },
})
