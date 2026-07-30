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
  industries: '/industries',
  security: '/security',
  customers: '/customers',
  about: '/about',
  resources: '/resources',
  careers: '/careers',
  contact: '/contact',
} as const

/** Marketing surface for each product that lives inside the Hybent site. */
export const PRODUCTS = {
  hiring: '/products/hiring',
} as const

export const AUTH = {
  login: '/login',
  register: '/register',
  resetPassword: '/reset-password',
  /** Role-aware entry point — resolves to the caller's workspace. */
  dashboard: '/dashboard',
} as const

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
