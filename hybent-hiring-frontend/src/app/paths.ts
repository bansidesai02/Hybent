/**
 * Single source of truth for every route in the Hybent platform.
 *
 * The tree is deliberately shallow and brand-first:
 *
 *   /                     Hybent — the company site (parent brand)
 *   /products/hiring      Hybent Hiring — a product inside the company site
 *   /login                Authentication, reached only from inside a product
 *   /hiring/<workspace>   The authenticated Hybent Hiring workspaces
 *
 * Import from here instead of writing string literals so a future product can
 * be added without hunting for hardcoded paths.
 */

export const SITE = {
  home: '/',
  products: '/products',
  platform: '/platform',
  ai: '/ai',
  solutions: '/solutions',
  services: '/services',
  industries: '/industries',
  hireTalent: '/hire-talent',
  security: '/security',
  customers: '/customers',
  pricing: '/pricing',
  about: '/about',
  faq: '/faq',
  careers: '/careers',
  contact: '/contact',
} as const

/** Marketing surface for each product that lives inside the Hybent site. */
export const PRODUCTS = {
  hiring: '/products/hiring',
} as const

export const AUTH = {
  /** The platform's canonical sign-in — the Hybent company portal. Every
      redirect (RequireAuth, forced logout, /dashboard) lands here. */
  login: '/login',
  register: '/register',
  resetPassword: '/reset-password',
  /** ?status=success|error|verifying selects the state; default is "sent". */
  verifyEmail: '/verify-email',
  /** First password for an invited user; takes the invite token as ?token=. */
  createPassword: '/create-password',
  /** Role-aware entry point — resolves to the caller's workspace. */
  dashboard: '/dashboard',
} as const

/**
 * There is exactly one sign-in for the whole platform: `AUTH.login`.
 *
 * The product used to carry its own — a second auth stack under `/hiring` with
 * the same endpoints and accounts behind a different design system — plus a
 * second "Sign In" button in an in-page product nav. Between them a visitor
 * could reach three different-looking doors to the same lock. Both are gone;
 * every entry point in the app now resolves here.
 *
 * `/hiring/login` still redirects, carrying `?product=hiring` so someone
 * arriving from an old bookmark is told which product they are signing in to.
 * That is a label on one page, not a second way in.
 */

/** Authenticated workspaces of the Hybent Hiring product. */
export const HIRING = {
  root: '/hiring',
  recruiter: '/hiring/recruiter',
  admin: '/hiring/admin',
  interviewer: '/hiring/interviewer',
  portal: '/hiring/portal',
  superAdmin: '/hiring/super-admin',
} as const

export type AppRole = 'super_admin' | 'admin' | 'recruiter' | 'interviewer' | 'candidate'

/** Where a signed-in user belongs. Used by /dashboard and by post-login redirects. */
export function workspaceForRole(role: AppRole | undefined | null): string {
  switch (role) {
    case 'super_admin':
      return HIRING.superAdmin
    case 'candidate':
      return HIRING.portal
    case 'interviewer':
      return HIRING.interviewer
    case 'admin':
      return HIRING.admin
    default:
      return HIRING.recruiter
  }
}
