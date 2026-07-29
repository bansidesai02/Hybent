import { Routes, Route } from 'react-router-dom'
import React, { lazy } from 'react'

const InterviewerLayout = lazy(() => import('@/components/layout/InterviewerLayout').then(m => ({ default: m.InterviewerLayout })))
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
      <Route element={<InterviewerLayout />}>
        <Route index element={<InterviewerDashboard />} />
        <Route path="interviews" element={<MyInterviewsPage />} />
        <Route path="scorecard" element={<ScorecardPage />} />
        <Route path="prepkit" element={<PrepKitPage />} />
        <Route path="liveroom" element={<LiveRoomPage />} />
        <Route path="hub/scorecard" element={<ScorecardHubPage />} />
        <Route path="hub/prepkit" element={<PrepKitHubPage />} />
        <Route path="hub/liveroom" element={<LiveRoomHubPage />} />
        <Route path="profile" element={<InterviewerProfilePage />} />
      </Route>
    </Routes>
  )
}
