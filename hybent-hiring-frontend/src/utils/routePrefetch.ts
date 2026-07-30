/* Route prefixes match the workspace paths declared in src/app/paths.ts. */
const routeLoaders = [
  { test: /^\/hiring\/(?:recruiter|admin)\/?$/, load: () => import('@/modules/recruiter/pages/OverviewPage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/jobs\/new/, load: () => import('@/modules/recruiter/pages/AddJobPage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/jobs/, load: () => import('@/modules/recruiter/pages/JobsListPage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/candidates/, load: () => import('@/modules/recruiter/pages/CandidatesPage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/pipeline/, load: () => import('@/modules/recruiter/pages/PipelinePage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/upload/, load: () => import('@/modules/recruiter/pages/UploadResumePage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/interviews/, load: () => import('@/modules/recruiter/pages/InterviewsListPage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/offers/, load: () => import('@/modules/recruiter/pages/OffersPage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/analytics/, load: () => import('@/modules/recruiter/pages/AnalyticsPage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/reports/, load: () => import('@/modules/recruiter/pages/ReportsPage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/talent-pool/, load: () => import('@/modules/recruiter/pages/TalentPoolPage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/all-talent/, load: () => import('@/modules/recruiter/pages/AllTalentListPage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/profile/, load: () => import('@/modules/recruiter/pages/RecruiterProfilePage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/settings/, load: () => import('@/modules/recruiter/pages/RecruiterSettingsPage') },
  { test: /^\/hiring\/(?:recruiter|admin)\/teams/, load: () => import('@/modules/admin/pages/TeamManagementPage') },
  { test: /^\/hiring\/admin\/audit/, load: () => import('@/modules/admin/pages/AuditLogsPage') },
  { test: /^\/hiring\/interviewer\/?$/, load: () => import('@/modules/interviewer/pages/InterviewerDashboard') },
  { test: /^\/hiring\/interviewer\/interviews/, load: () => import('@/modules/interviewer/pages/MyInterviewsPage') },
  { test: /^\/hiring\/portal\/?$/, load: () => import('@/modules/portal/pages/PortalDashboard') },
  { test: /^\/hiring\/portal\/applications/, load: () => import('@/modules/portal/pages/PortalApplicationsPage') },
  { test: /^\/hiring\/portal\/interviews/, load: () => import('@/modules/portal/pages/PortalInterviewsPage') },
  { test: /^\/hiring\/portal\/offers/, load: () => import('@/modules/portal/pages/PortalOffersPage') },
  { test: /^\/hiring\/portal\/profile/, load: () => import('@/modules/portal/pages/PortalProfilePage') },
  { test: /^\/hiring\/portal\/prep/, load: () => import('@/modules/portal/pages/PortalPrepHub') },
  { test: /^\/hiring\/portal\/openings/, load: () => import('@/modules/portal/pages/PortalOpenings') },
  { test: /^\/hiring\/portal\/notifications/, load: () => import('@/modules/portal/pages/PortalNotifications') },
  { test: /^\/hiring\/portal\/settings/, load: () => import('@/modules/portal/pages/PortalSettingsPage') },
]

const loadedRoutes = new Set<string>()

export function prefetchRoute(path: string) {
  if (loadedRoutes.has(path)) return
  const match = routeLoaders.find((route) => route.test.test(path))
  if (!match) return
  loadedRoutes.add(path)
  match.load().catch(() => loadedRoutes.delete(path))
}
