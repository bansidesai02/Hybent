import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // Using BrowserRouter since .htaccess is configured
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'

import App from './App'
import './index.css'
// Capture the browser's install prompt as early as possible (installed app).
import './pwa/install'
import { hideBootScreen } from './pwa/bootScreen'

const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '60998312524-5i4a665mbc851e8650fl06lb6spfikop.apps.googleusercontent.com'

/* Stale-while-revalidate: a page you come back to shows its cached data at
   once and refetches in the background, so it never sits on data that has
   changed since (a 5-minute staleTime used to hide new candidates, stage
   moves, etc. until a full reload). Unchanged responses keep the same object
   (structural sharing), so nothing re-renders or resets when nothing changed.
   Queries that are slow or spend AI credits opt out with their own staleTime. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 1000 * 60 * 20,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>
)

hideBootScreen()
