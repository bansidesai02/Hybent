const routeLoaders = [
  { test: /^\/(?:recruiter|admin)\/?$/, load: () => import('@/pages/recruiter/OverviewPage') },
  { test: /^\/(?:recruiter|admin)\/jobs\/new/, load: () => import('@/pages/recruiter/AddJobPage') },
  { test: /^\/(?:recruiter|admin)\/jobs/, load: () => import('@/pages/recruiter/JobsListPage') },
  { test: /^\/(?:recruiter|admin)\/candidates/, load: () => import('@/pages/recruiter/CandidatesPage') },
  { test: /^\/(?:recruiter|admin)\/pipeline/, load: () => import('@/pages/recruiter/PipelinePage') },
  { test: /^\/(?:recruiter|admin)\/upload/, load: () => import('@/pages/recruiter/UploadResumePage') },
  { test: /^\/(?:recruiter|admin)\/interviews/, load: () => import('@/pages/recruiter/InterviewsListPage') },
  { test: /^\/(?:recruiter|admin)\/offers/, load: () => import('@/pages/recruiter/OffersPage') },
  { test: /^\/(?:recruiter|admin)\/analytics/, load: () => import('@/pages/recruiter/AnalyticsPage') },
  { test: /^\/(?:recruiter|admin)\/reports/, load: () => import('@/pages/recruiter/ReportsPage') },
  { test: /^\/(?:recruiter|admin)\/talent-pool/, load: () => import('@/pages/recruiter/TalentPoolPage') },
  { test: /^\/(?:recruiter|admin)\/all-talent/, load: () => import('@/pages/recruiter/AllTalentListPage') },
  { test: /^\/(?:recruiter|admin)\/profile/, load: () => import('@/pages/recruiter/RecruiterProfilePage') },
  { test: /^\/(?:recruiter|admin)\/settings/, load: () => import('@/pages/recruiter/RecruiterSettingsPage') },
  { test: /^\/(?:recruiter|admin)\/teams/, load: () => import('@/pages/admin/TeamManagementPage') },
  { test: /^\/admin\/audit/, load: () => import('@/pages/admin/AuditLogsPage') },
  { test: /^\/interviewer\/?$/, load: () => import('@/pages/interviewer/InterviewerDashboard') },
  { test: /^\/interviewer\/interviews/, load: () => import('@/pages/interviewer/MyInterviewsPage') },
  { test: /^\/portal\/?$/, load: () => import('@/pages/portal/PortalDashboard') },
  { test: /^\/portal\/applications/, load: () => import('@/pages/portal/PortalApplicationsPage') },
  { test: /^\/portal\/interviews/, load: () => import('@/pages/portal/PortalInterviewsPage') },
  { test: /^\/portal\/offers/, load: () => import('@/pages/portal/PortalOffersPage') },
  { test: /^\/portal\/profile/, load: () => import('@/pages/portal/PortalProfilePage') },
  { test: /^\/portal\/prep/, load: () => import('@/pages/portal/PortalPrepHub') },
  { test: /^\/portal\/openings/, load: () => import('@/pages/portal/PortalOpenings') },
  { test: /^\/portal\/notifications/, load: () => import('@/pages/portal/PortalNotifications') },
  { test: /^\/portal\/settings/, load: () => import('@/pages/portal/PortalSettingsPage') },
]

const loadedRoutes = new Set<string>()

export function prefetchRoute(path: string) {
  if (loadedRoutes.has(path)) return
  const match = routeLoaders.find((route) => route.test.test(path))
  if (!match) return
  loadedRoutes.add(path)
  match.load().catch(() => loadedRoutes.delete(path))
}
