import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import AppLayout from '@/components/layout/AppLayout'
import { RequireAuth } from './RequireAuth'
import { DashboardRedirect } from './DashboardRedirect'

/* ── Hybent — the company site ──────────────────────────────────────────────
   Split per view so a visitor landing on the homepage never downloads the
   careers page. */
const HomePage = lazy(() => import('@/modules/site/pages/HomePage'))
const ProductsPage = lazy(() => import('@/modules/site/pages/ProductsPage'))
const PlatformPage = lazy(() => import('@/modules/site/pages/PlatformPage'))
const AiCapabilitiesPage = lazy(() => import('@/modules/site/pages/AiCapabilitiesPage'))
const SolutionsPage = lazy(() => import('@/modules/site/pages/SolutionsPage'))
const ServicesPage = lazy(() => import('@/modules/site/pages/ServicesPage'))
const IndustriesPage = lazy(() => import('@/modules/site/pages/IndustriesPage'))
const HireTalentPage = lazy(() => import('@/modules/site/pages/HireTalentPage'))
const SecurityPage = lazy(() => import('@/modules/site/pages/SecurityPage'))
const CustomersPage = lazy(() => import('@/modules/site/pages/CustomersPage'))
const AboutPage = lazy(() => import('@/modules/site/pages/AboutPage'))
const FaqPage = lazy(() => import('@/modules/site/pages/FaqPage'))
const CareersPage = lazy(() => import('@/modules/site/pages/CareersPage'))
const ContactPage = lazy(() => import('@/modules/site/pages/ContactPage'))
const PrivacyPage = lazy(() => import('@/modules/site/pages/PrivacyPage'))

/* ── Products living inside the company site ──────────────────────────────── */
const HiringHomePage = lazy(() => import('@/modules/hiring/pages/HiringHomePage'))

/* ── Authentication ───────────────────────────────────────────────────────── */
/* One front door. The Hybent portal owns every auth path and shares one design
   system across sign-in, sign-up and reset. A visitor arriving from a product
   carries `?product=`, which puts that product's name above the title.

   The `/hiring/*` forms that used to live beside these were deleted in phase 4
   and now redirect here — they were the same endpoints and the same accounts
   behind a second, drifting design system. */
const HybentLoginRoute = lazy(() => import('@/modules/site/pages/HybentLoginRoute'))
const HybentRegisterRoute = lazy(() => import('@/modules/site/pages/HybentRegisterRoute'))
const HybentResetPasswordRoute = lazy(() => import('@/modules/site/pages/HybentResetPasswordRoute'))
const HybentVerifyEmailRoute = lazy(() => import('@/modules/site/pages/HybentVerifyEmailRoute'))
const HybentCreatePasswordRoute = lazy(() => import('@/modules/site/pages/HybentCreatePasswordRoute'))

/* ── Candidate entry points reached by emailed token ──────────────────────── */
const OnboardingPage = lazy(() => import('@/pages/candidate/OnboardingPage'))
const PreScreeningPage = lazy(() => import('@/pages/candidate/PreScreeningPage'))

/* ── Design system review surface ─────────────────────────────────────────────
   The condition wraps the `import()` itself, not just the route. Vite replaces
   `import.meta.env.DEV` with a literal at build time, so in production the
   dynamic import is dead code and Rollup emits no chunk for it — guarding only
   the route still shipped the whole gallery to dist. */
const KitchenSink = import.meta.env.DEV
  ? lazy(() => import('@/dev/KitchenSink'))
  : null

/* ── Authenticated Hybent Hiring workspaces ───────────────────────────────── */
const RecruiterRoutes = lazy(() => import('@/routes/RecruiterRoutes'))
const AdminRoutes = lazy(() => import('@/routes/AdminRoutes'))
const InterviewerRoutes = lazy(() => import('@/routes/InterviewerRoutes'))
const PortalRoutes = lazy(() => import('@/routes/PortalRoutes'))
const SuperAdminRoutes = lazy(() => import('@/routes/SuperAdminRoutes'))

/**
 * The whole platform in one table.
 *
 *   /                    Hybent — the parent brand, always the entry point
 *   /products/hiring     Hybent Hiring — a product inside the company site
 *   /login               Authentication, reached only from inside a product
 *   /hiring/<workspace>  The authenticated product, with its own chrome
 *
 * Everything public renders inside AppLayout, which supplies the one global
 * navigation bar. Workspaces sit outside it because they bring their own
 * sidebar and topbar.
 */
export default function AppRoutes() {
  /* Built here rather than inline: narrowing `KitchenSink` away from null does
     not reach into a nested JSX attribute, so the element is composed first. */
  const kitchenSinkRoute = KitchenSink ? (
    <Route path="/dev/kitchen-sink" element={<KitchenSink />} />
  ) : null

  return (
    <Routes>
      {/* ── Public surface: one shared shell, many views ── */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />

        {/* Static product paths are declared before the section-deep-link form
            so /products/hiring can never be read as a fragment id. */}
        <Route path="/products/hiring" element={<HiringHomePage />} />

        <Route path="/products/:section?" element={<ProductsPage />} />
        <Route path="/platform/:section?" element={<PlatformPage />} />
        <Route path="/ai/:section?" element={<AiCapabilitiesPage />} />
        <Route path="/solutions/:section?" element={<SolutionsPage />} />
        <Route path="/services/:section?" element={<ServicesPage />} />
        <Route path="/industries/:section?" element={<IndustriesPage />} />
        <Route path="/hire-talent/:section?" element={<HireTalentPage />} />
        <Route path="/security/:section?" element={<SecurityPage />} />
        <Route path="/customers/:section?" element={<CustomersPage />} />
        <Route path="/about/:section?" element={<AboutPage />} />
        <Route path="/faq/:section?" element={<FaqPage />} />
        <Route path="/careers/:section?" element={<CareersPage />} />
        <Route path="/contact/:section?" element={<ContactPage />} />
        <Route path="/privacy/:section?" element={<PrivacyPage />} />
        <Route path="/terms/:section?" element={<PrivacyPage />} />
        <Route path="/privacy-terms/:section?" element={<PrivacyPage />} />
      </Route>

      {/* ── Authentication: full-bleed, no marketing chrome ── */}
      {/* The parent brand owns the canonical paths; the product keeps its own
          themed forms under /hiring. Both hit the same endpoints. */}
      <Route path="/login" element={<HybentLoginRoute />} />
      <Route path="/register" element={<HybentRegisterRoute />} />
      <Route path="/reset-password" element={<HybentResetPasswordRoute />} />
      {/* One route, four states — ?status=success|error|verifying, default sent. */}
      <Route path="/verify-email" element={<HybentVerifyEmailRoute />} />
      <Route path="/create-password" element={<HybentCreatePasswordRoute />} />
      {/* The product's old front doors. Kept as redirects rather than removed:
          they are in inboxes, bookmarks and at least one nginx config, and a
          404 on a sign-in link is the worst possible way to learn that. */}
      <Route path="/hiring/login" element={<Navigate to="/login?product=hiring" replace />} />
      <Route path="/hiring/register" element={<Navigate to="/register?product=hiring" replace />} />
      <Route
        path="/hiring/reset-password"
        element={<Navigate to="/reset-password?product=hiring" replace />}
      />

      {/* ── Token-gated candidate flows ── */}
      <Route path="/onboarding/:token" element={<OnboardingPage />} />
      <Route path="/pre-screening/:token" element={<PreScreeningPage />} />

      {/* ── Design system, dev only ── */}
      {kitchenSinkRoute}

      {/* ── Role-aware entry point into the product ── */}
      <Route path="/dashboard" element={<DashboardRedirect />} />

      {/* ── Hybent Hiring workspaces ── */}
      <Route
        path="/hiring/recruiter/*"
        element={
          <RequireAuth roles={['recruiter']}>
            <RecruiterRoutes />
          </RequireAuth>
        }
      />
      <Route
        path="/hiring/admin/*"
        element={
          <RequireAuth roles={['admin']}>
            <AdminRoutes />
          </RequireAuth>
        }
      />
      <Route
        path="/hiring/interviewer/*"
        element={
          <RequireAuth roles={['admin', 'recruiter', 'interviewer']}>
            <InterviewerRoutes />
          </RequireAuth>
        }
      />
      <Route
        path="/hiring/portal/*"
        element={
          <RequireAuth roles={['candidate']}>
            <PortalRoutes />
          </RequireAuth>
        }
      />
      <Route
        path="/hiring/super-admin/*"
        element={
          <RequireAuth roles={['super_admin']}>
            <SuperAdminRoutes />
          </RequireAuth>
        }
      />

      {/* /hiring on its own is the product's marketing surface. */}
      <Route path="/hiring" element={<Navigate to="/products/hiring" replace />} />

      {/* Unknown paths land on the parent brand, never on a product. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
