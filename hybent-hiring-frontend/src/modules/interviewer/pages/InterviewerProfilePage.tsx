import ProfileFormCard from '@/components/profile/ProfileFormCard'

export default function InterviewerProfilePage() {
  return (
    <ProfileFormCard
      portalTitle="My Profile"
      portalSubtitle="Manage your personal details and preferences."
      isAdmin={false}
    />
  )
}
