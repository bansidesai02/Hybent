import { Routes, Route } from 'react-router-dom'
import { lazy } from 'react'

/* Phase 10: the Hybent shell is the only shell. */
const Shell = lazy(() => import('@/components/layout/shell/AppShell').then(m => ({ default: m.WorkspaceShell })))

const OverviewPage = lazy(() => import('@/modules/recruiter/pages/OverviewPage'))
const JobsListPage = lazy(() => import('@/modules/recruiter/pages/JobsListPage'))
const AddJobPage = lazy(() => import('@/modules/recruiter/pages/AddJobPage'))
const CandidatesPage = lazy(() => import('@/modules/recruiter/pages/CandidatesPage'))
const PipelinePage = lazy(() => import('@/modules/recruiter/pages/PipelinePage'))
const UploadResumePage = lazy(() => import('@/modules/recruiter/pages/UploadResumePage'))
const InterviewsListPage = lazy(() => import('@/modules/recruiter/pages/InterviewsListPage'))
const OffersPage = lazy(() => import('@/modules/recruiter/pages/OffersPage'))
const AnalyticsPage = lazy(() => import('@/modules/recruiter/pages/AnalyticsPage'))
const ReportsPage = lazy(() => import('@/modules/recruiter/pages/ReportsPage'))
const TalentPoolPage = lazy(() => import('@/modules/recruiter/pages/TalentPoolPage'))
const AllTalentListPage = lazy(() => import('@/modules/recruiter/pages/AllTalentListPage'))
const RecruiterSettingsPage = lazy(() => import('@/modules/recruiter/pages/RecruiterSettingsPage'))
const PreScreeningReviewPage = lazy(() => import('@/modules/recruiter/pages/PreScreeningReviewPage'))
const AICreditsPage = lazy(() => import('@/modules/recruiter/pages/AICreditsPage'))
const InboxPage = lazy(() => import('@/modules/recruiter/pages/InboxPage'))
const CopilotPage = lazy(() => import('@/modules/recruiter/pages/CopilotPage'))
const TeamManagementPage = lazy(() => import('@/modules/admin/pages/TeamManagementPage'))

const AuditLogsPage = lazy(() => import('@/modules/admin/pages/AuditLogsPage'))
const BillingPage = lazy(() => import('@/modules/admin/pages/BillingPage'))
const AdminProfilePage = lazy(() => import('@/modules/admin/pages/AdminProfilePage'))
const RecruiterProfilePage = lazy(() => import('@/modules/recruiter/pages/RecruiterProfilePage'))

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        {/* Admin-specific routes first - ensures /admin/profile hits AdminProfilePage */}
        <Route path="audit" element={<AuditLogsPage />} />
        <Route path="profile" element={<AdminProfilePage />} />

        {/* Shared core routes */}
        <Route index element={<OverviewPage />} />
        <Route path="jobs" element={<JobsListPage />} />
        <Route path="jobs/new" element={<AddJobPage />} />
        <Route path="jobs/:id/edit" element={<AddJobPage />} />
        <Route path="candidates" element={<CandidatesPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="upload" element={<UploadResumePage />} />
        <Route path="interviews" element={<InterviewsListPage />} />
        <Route path="offers" element={<OffersPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="talent-pool" element={<TalentPoolPage />} />
        <Route path="all-talent" element={<AllTalentListPage />} />
        {/* We omitted path="profile" element={<RecruiterProfilePage />} here since Admin uses AdminProfilePage */}
        <Route path="settings" element={<RecruiterSettingsPage />} />
        <Route path="teams" element={<TeamManagementPage />} />
        <Route path="pre-screening/:sessionId" element={<PreScreeningReviewPage />} />
        <Route path="ai-credits" element={<AICreditsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="copilot" element={<CopilotPage />} />
        <Route path="copilot/:conversationId" element={<CopilotPage />} />
      </Route>
    </Routes>
  )
}
