import ProfileFormCard from '@/components/profile/ProfileFormCard'

export default function RecruiterProfilePage() {
  return (
    <ProfileFormCard
      portalTitle="My Profile"
      portalSubtitle="Manage your personal details and preferences."
      isAdmin={false}
    />
  )
}
