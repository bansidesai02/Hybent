import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy } from 'react'

/* Phase 10: the Hybent shell is the only shell. */
const Shell = lazy(() => import('@/components/layout/shell/AppShell').then(m => ({ default: m.InterviewerShell })))
const InterviewerDashboard = lazy(() => import('@/modules/interviewer/pages/InterviewerDashboard'))
const MyInterviewsPage = lazy(() => import('@/modules/interviewer/pages/MyInterviewsPage'))
const ScorecardPage = lazy(() => import('@/modules/interviewer/pages/ScorecardPage'))
const PrepKitPage = lazy(() => import('@/modules/interviewer/pages/PrepKitPage'))
const LiveRoomPage = lazy(() => import('@/modules/interviewer/pages/LiveRoomPage'))
const ScorecardHubPage = lazy(() => import('@/modules/interviewer/pages/ScorecardHubPage'))
const PrepKitHubPage = lazy(() => import('@/modules/interviewer/pages/PrepKitHubPage'))
const LiveRoomHubPage = lazy(() => import('@/modules/interviewer/pages/LiveRoomHubPage'))
const InterviewerProfilePage = lazy(() => import('@/modules/interviewer/pages/InterviewerProfilePage'))

export default function InterviewerRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<InterviewerDashboard />} />
        <Route path="interviews" element={<MyInterviewsPage />} />

        {/* ── Hubs: pick an interview, then open the tool for it ──
            Registered under the paths the sidebar and the pages already link
            to. They previously sat at `hub/scorecard`, `hub/prepkit` and
            `hub/liveroom`, which nothing pointed at — so every one of the three
            nav items resolved to the catch-all and dropped the interviewer on
            the marketing homepage. */}
        <Route path="scorecard-hub" element={<ScorecardHubPage />} />
        <Route path="prep-kit-hub" element={<PrepKitHubPage />} />
        <Route path="live-room-hub" element={<LiveRoomHubPage />} />

        {/* ── The tools themselves ──
            All three read `useParams<{ interviewId }>()`, but were registered
            without the segment — so `interviewId` was always undefined, every
            query stayed disabled and the page rendered empty even when reached.
            The slugs also disagreed with the links (`prepkit` vs `prep-kit`). */}
        <Route path="scorecard/:interviewId" element={<ScorecardPage />} />
        <Route path="prep-kit/:interviewId" element={<PrepKitPage />} />
        <Route path="live-room/:interviewId" element={<LiveRoomPage />} />

        {/* The old paths, kept as redirects to the hub rather than deleted:
            they are in browser history and at least one bookmark, and a tool
            page opened without an interview has nothing to show anyway. */}
        <Route path="scorecard" element={<Navigate to="../scorecard-hub" replace />} />
        <Route path="prepkit" element={<Navigate to="../prep-kit-hub" replace />} />
        <Route path="liveroom" element={<Navigate to="../live-room-hub" replace />} />
        <Route path="hub/scorecard" element={<Navigate to="../../scorecard-hub" replace />} />
        <Route path="hub/prepkit" element={<Navigate to="../../prep-kit-hub" replace />} />
        <Route path="hub/liveroom" element={<Navigate to="../../live-room-hub" replace />} />

        <Route path="profile" element={<InterviewerProfilePage />} />
      </Route>
    </Routes>
  )
}
