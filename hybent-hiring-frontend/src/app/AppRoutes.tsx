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
const IndustriesPage = lazy(() => import('@/modules/site/pages/IndustriesPage'))
const SecurityPage = lazy(() => import('@/modules/site/pages/SecurityPage'))
const CustomersPage = lazy(() => import('@/modules/site/pages/CustomersPage'))
const AboutPage = lazy(() => import('@/modules/site/pages/AboutPage'))
const ResourcesPage = lazy(() => import('@/modules/site/pages/ResourcesPage'))
const CareersPage = lazy(() => import('@/modules/site/pages/CareersPage'))
const ContactPage = lazy(() => import('@/modules/site/pages/ContactPage'))

/* ── Products living inside the company site ──────────────────────────────── */
const HiringHomePage = lazy(() => import('@/modules/hiring/pages/HiringHomePage'))

/* ── Authentication ───────────────────────────────────────────────────────── */
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))

/* ── Candidate entry points reached by emailed token ──────────────────────── */
const OnboardingPage = lazy(() => import('@/pages/candidate/OnboardingPage'))
const PreScreeningPage = lazy(() => import('@/pages/candidate/PreScreeningPage'))

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
        <Route path="/industries/:section?" element={<IndustriesPage />} />
        <Route path="/security/:section?" element={<SecurityPage />} />
        <Route path="/customers/:section?" element={<CustomersPage />} />
        <Route path="/about/:section?" element={<AboutPage />} />
        <Route path="/resources/:section?" element={<ResourcesPage />} />
        <Route path="/careers/:section?" element={<CareersPage />} />
        <Route path="/contact/:section?" element={<ContactPage />} />
      </Route>

      {/* ── Authentication: full-bleed, no marketing chrome ── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ── Token-gated candidate flows ── */}
      <Route path="/onboarding/:token" element={<OnboardingPage />} />
      <Route path="/pre-screening/:token" element={<PreScreeningPage />} />

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
