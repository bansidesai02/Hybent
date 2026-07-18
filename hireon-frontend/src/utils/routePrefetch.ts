const routeLoaders = [
  { test: /^\/(?:recruiter|admin)\/?$/, load: () => import('@/modules/recruiter/pages/OverviewPage') },
  { test: /^\/(?:recruiter|admin)\/jobs\/new/, load: () => import('@/modules/recruiter/pages/AddJobPage') },
  { test: /^\/(?:recruiter|admin)\/jobs/, load: () => import('@/modules/recruiter/pages/JobsListPage') },
  { test: /^\/(?:recruiter|admin)\/candidates/, load: () => import('@/modules/recruiter/pages/CandidatesPage') },
  { test: /^\/(?:recruiter|admin)\/pipeline/, load: () => import('@/modules/recruiter/pages/PipelinePage') },
  { test: /^\/(?:recruiter|admin)\/upload/, load: () => import('@/modules/recruiter/pages/UploadResumePage') },
  { test: /^\/(?:recruiter|admin)\/interviews/, load: () => import('@/modules/recruiter/pages/InterviewsListPage') },
  { test: /^\/(?:recruiter|admin)\/offers/, load: () => import('@/modules/recruiter/pages/OffersPage') },
  { test: /^\/(?:recruiter|admin)\/analytics/, load: () => import('@/modules/recruiter/pages/AnalyticsPage') },
  { test: /^\/(?:recruiter|admin)\/reports/, load: () => import('@/modules/recruiter/pages/ReportsPage') },
  { test: /^\/(?:recruiter|admin)\/talent-pool/, load: () => import('@/modules/recruiter/pages/TalentPoolPage') },
  { test: /^\/(?:recruiter|admin)\/all-talent/, load: () => import('@/modules/recruiter/pages/AllTalentListPage') },
  { test: /^\/(?:recruiter|admin)\/profile/, load: () => import('@/modules/recruiter/pages/RecruiterProfilePage') },
  { test: /^\/(?:recruiter|admin)\/settings/, load: () => import('@/modules/recruiter/pages/RecruiterSettingsPage') },
  { test: /^\/(?:recruiter|admin)\/teams/, load: () => import('@/modules/admin/pages/TeamManagementPage') },
  { test: /^\/admin\/audit/, load: () => import('@/modules/admin/pages/AuditLogsPage') },
  { test: /^\/interviewer\/?$/, load: () => import('@/modules/interviewer/pages/InterviewerDashboard') },
  { test: /^\/interviewer\/interviews/, load: () => import('@/modules/interviewer/pages/MyInterviewsPage') },
  { test: /^\/portal\/?$/, load: () => import('@/modules/portal/pages/PortalDashboard') },
  { test: /^\/portal\/applications/, load: () => import('@/modules/portal/pages/PortalApplicationsPage') },
  { test: /^\/portal\/interviews/, load: () => import('@/modules/portal/pages/PortalInterviewsPage') },
  { test: /^\/portal\/offers/, load: () => import('@/modules/portal/pages/PortalOffersPage') },
  { test: /^\/portal\/profile/, load: () => import('@/modules/portal/pages/PortalProfilePage') },
  { test: /^\/portal\/prep/, load: () => import('@/modules/portal/pages/PortalPrepHub') },
  { test: /^\/portal\/openings/, load: () => import('@/modules/portal/pages/PortalOpenings') },
  { test: /^\/portal\/notifications/, load: () => import('@/modules/portal/pages/PortalNotifications') },
  { test: /^\/portal\/settings/, load: () => import('@/modules/portal/pages/PortalSettingsPage') },
]

const loadedRoutes = new Set<string>()

export function prefetchRoute(path: string) {
  if (loadedRoutes.has(path)) return
  const match = routeLoaders.find((route) => route.test.test(path))
  if (!match) return
  loadedRoutes.add(path)
  match.load().catch(() => loadedRoutes.delete(path))
}
