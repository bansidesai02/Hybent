import { Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { AlertTriangle } from 'lucide-react'

import AppRoutes from '@/app/AppRoutes'
import { useAuthStore } from '@/store/authStore'
import { AUTH } from '@/app/paths'
import { Button, Skeleton, SkeletonStats } from '@/components/hb'

/**
 * The app root: the forced-logout interstitial, the toast host, and the route
 * suspense fallback.
 *
 * Rebuilt on the design system in phase 10. The logout modal was a fully
 * inline-styled overlay carrying six hexes (`#ef4444`/`#fee2e2` for deleted,
 * `#f59e0b`/`#fef3c7` for expired, plus `#1a1040` ink and `#6b6393` muted),
 * and the `Toaster` theme named five more. It cannot use `Dialog`, because it
 * renders above the router as a last-resort interstitial with no route to
 * return to — but everything it paints now comes from tokens.
 */

function RouteFallback() {
  return (
    <div className="p-4 md:p-6 lg:px-[30px] lg:py-7">
      <div className="main-content-container space-y-hb-4">
        <Skeleton className="h-8 w-48" rounded="md" />
        <SkeletonStats />
        <Skeleton className="h-80 w-full" rounded="md" />
      </div>
    </div>
  )
}

function ForcedLogoutModal() {
  const { forcedLogoutReason, logout } = useAuthStore()

  if (!forcedLogoutReason) return null

  const handleDismiss = () => {
    logout()
    window.location.href = AUTH.login
  }

  const isDeleted = forcedLogoutReason === 'account_deleted'
  const title = isDeleted ? 'Account removed' : 'Session expired'
  const desc = isDeleted
    ? 'You have been logged out because your account was deleted or deactivated by an administrator. Please contact your admin if this was a mistake.'
    : 'Your session has expired. Please sign in again.'

  /* Deletion is final; an expired session is merely an interruption. */
  const tone = isDeleted
    ? { border: 'border-hb-error/40', tile: 'bg-hb-error/10 text-hb-error' }
    : { border: 'border-hb-warning/40', tile: 'bg-hb-warning/10 text-hb-warning' }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div
        className={`w-full max-w-[420px] rounded-hb-lg border bg-hb-surface p-9 text-center shadow-hb-3 ${tone.border}`}
      >
        <span className={`mx-auto mb-hb-5 grid h-16 w-16 place-items-center rounded-full ${tone.tile}`}>
          <AlertTriangle size={30} aria-hidden />
        </span>
        <h2 className="mb-3 font-display text-hb-h2 text-hb-text">{title}</h2>
        <p className="mb-hb-6 text-hb-body leading-relaxed text-hb-muted">{desc}</p>
        <Button size="lg" className="w-full" onClick={handleDismiss}>
          Sign in again
        </Button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <>
      <ForcedLogoutModal />

      {/* react-hot-toast takes a style object, not classes — so these read the
          same custom properties the token layer defines. */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgb(var(--hb-elevated))',
            color: 'rgb(var(--hb-text))',
            borderRadius: 'var(--hb-r-md)',
            fontFamily: 'Manrope, sans-serif',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: 'var(--hb-sh-2)',
            padding: '12px 20px',
            border: '1px solid var(--hb-border)',
          },
          success: {
            iconTheme: {
              primary: 'rgb(var(--hb-success))',
              secondary: 'rgb(var(--hb-elevated))',
            },
          },
          error: {
            iconTheme: {
              primary: 'rgb(var(--hb-error))',
              secondary: 'rgb(var(--hb-elevated))',
            },
          },
        }}
      />

      <Suspense fallback={<RouteFallback />}>
        <AppRoutes />
      </Suspense>
    </>
  )
}
