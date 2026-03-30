/**
 * ProfileFormCard — Shared profile editing UI for Admin, Recruiter, Interviewer portals.
 *
 * Props:
 *  - isAdmin: if true, ALL fields (Email, Company, Role) are editable
 *  - For Recruiter/Interviewer isAdmin=false → Email/Company/Role are read-only
 */
import { useState, useRef, useEffect } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useAuth } from '@/hooks/useAuth'

interface ProfileFormCardProps {
  portalTitle?: string
  portalSubtitle?: string
  isAdmin?: boolean
}

interface FormState {
  full_name: string
  email: string
  phone: string
  organization_name: string
  role: string
}

export default function ProfileFormCard({
  portalTitle = 'My Profile',
  portalSubtitle = 'Manage your personal details and preferences.',
  isAdmin = false,
}: ProfileFormCardProps) {
  const { user: authUser } = useAuth()
  const {
    profile,
    isLoading,
    updateProfile,
    isUpdating,
    uploadAvatar,
    isUploadingAvatar,
  } = useProfile()

  const user = profile ?? authUser
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>({
    full_name: '',
    email: '',
    phone: '',
    organization_name: '',
    role: '',
  })

  // Track if we've synced the initial server data to local state
  const hasSyncedRef = useRef(false)

  // Sync from API once profile loads
  useEffect(() => {
    if (profile && !hasSyncedRef.current) {
      setForm({
        full_name: profile.full_name ?? '',
        email: profile.email ?? '',
        phone: (profile as any).phone ?? '',
        organization_name: (profile as any).organization_name ?? '',
        role: String(profile.role ?? '').replace('UserRole.', ''),
      })
      hasSyncedRef.current = true
    }
  }, [profile])

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  const handleSave = () => {
    const payload: any = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
    }

    if (isAdmin) {
      if (form.email.trim()) payload.email = form.email.trim()
      if (form.role.trim()) payload.role = form.role.trim()
      if (form.organization_name.trim()) payload.organization_name = form.organization_name.trim()
    }

    updateProfile(payload, {
      onSuccess: (updatedProfile) => {
        // Force refresh local form state with the newly saved data
        setForm({
          full_name: updatedProfile.full_name ?? '',
          email: updatedProfile.email ?? '',
          phone: (updatedProfile as any).phone ?? '',
          organization_name: (updatedProfile as any).organization_name ?? '',
          role: String(updatedProfile.role ?? '').replace('UserRole.', ''),
        })
      }
    })
  }

  // Fallback user object if profile query is still loading
  const displayUser = profile ?? authUser

  if (isLoading) {
    return (
      <div className="profile-page-wrapper">
        <h1 className="profile-page-title">{portalTitle}</h1>
        <p className="profile-page-subtitle">{portalSubtitle}</p>
        <div className="profile-card profile-skeleton">
          <div className="skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton-line w-48" />
            <div className="skeleton-line w-32" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page-wrapper">
      <h1 className="profile-page-title">{portalTitle}</h1>
      <p className="profile-page-subtitle">{portalSubtitle}</p>

      <div className="profile-card">
        {/* Header: avatar + name */}
        <div className="profile-card-header">
          <p className="profile-section-label">Personal Information</p>
          <div className="profile-avatar-row">
            <div
              className="profile-avatar"
              onClick={() => fileInputRef.current?.click()}
              title="Click to change photo"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="profile-avatar-img" />
              ) : (
                <span className="profile-avatar-initials">{initials}</span>
              )}
              <div className="profile-avatar-overlay">
                {isUploadingAvatar ? '...' : '📷'}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const f = e.target.files?.[0]
                if (f) uploadAvatar(f)
                e.target.value = ''
              }}
            />
            <div className="profile-avatar-info">
              <p className="profile-avatar-name">{user?.full_name}</p>
              <p className="profile-avatar-email">{user?.email}</p>
              <span className="profile-role-badge">
                {String(user?.role ?? '').replace('UserRole.', '').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="profile-form">

          {/* Full Name — editable for ALL */}
          <div className="profile-field">
            <label className="profile-field-label">Full Name</label>
            <input
              type="text"
              className="profile-field-input"
              value={form.full_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
            />
          </div>

          {/* Email */}
          <div className="profile-field">
            <label className="profile-field-label">Email Address</label>
            {isAdmin ? (
              <input
                type="email"
                className="profile-field-input"
                value={form.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            ) : (
              <input
                type="email"
                className="profile-field-input profile-field-readonly"
                value={form.email}
                readOnly
              />
            )}
          </div>

          {/* Phone — editable for ALL */}
          <div className="profile-field">
            <label className="profile-field-label">Phone Number</label>
            <input
              type="tel"
              className="profile-field-input"
              value={form.phone}
              placeholder="+91 98765 43210"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </div>

          {/* Company */}
          <div className="profile-field">
            <label className="profile-field-label">Company</label>
            {isAdmin ? (
              <input
                type="text"
                className="profile-field-input"
                value={form.organization_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, organization_name: e.target.value }))
                }
              />
            ) : (
              <input
                type="text"
                className="profile-field-input profile-field-readonly"
                value={form.organization_name}
                readOnly
              />
            )}
          </div>

          {/* Role */}
          <div className="profile-field">
            <label className="profile-field-label">Role</label>
            {isAdmin ? (
              <input
                type="text"
                className="profile-field-input"
                value={form.role}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, role: e.target.value }))
                }
              />
            ) : (
              <input
                type="text"
                className="profile-field-input profile-field-readonly"
                value={form.role}
                readOnly
              />
            )}
          </div>

          {/* Save */}
          <button
            className="profile-save-btn"
            onClick={handleSave}
            disabled={isUpdating}
          >
            {isUpdating ? 'Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
