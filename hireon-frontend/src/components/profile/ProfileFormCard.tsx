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
import ImageCropperModal from '@/components/common/ImageCropperModal'

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
    deleteAvatar,
    refetch,
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

  const [imageToCrop, setImageToCrop] = useState<string | null>(null)

  // Track the last profile ID we synced to detect genuine data changes
  const lastSyncedProfileId = useRef<string | null>(null)

  // Sync form from API whenever profile data changes
  useEffect(() => {
    if (profile && profile.id !== lastSyncedProfileId.current) {
      setForm({
        full_name: profile.full_name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        organization_name: profile.organization_name ?? '',
        role: String(profile.role ?? '').replace('UserRole.', ''),
      })
      lastSyncedProfileId.current = profile.id
    }
  }, [profile])

  // Also update form when organization_name changes (e.g. after a successful save)
  useEffect(() => {
    if (profile && profile.organization_name != null) {
      setForm(prev => ({
        ...prev,
        organization_name: profile.organization_name ?? '',
      }))
    }
  }, [profile?.organization_name])

  const userRole = String(user?.role ?? '').replace('UserRole.', '').toLowerCase()
  const isProfileAdmin = isAdmin || userRole === 'admin'
  const isPrivileged = isProfileAdmin || userRole === 'recruiter'

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  const handleSave = () => {
    const payload: any = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
    }

    // ONLY Admin can update the organization name
    if (isProfileAdmin) {
      payload.organization_name = form.organization_name.trim()
    }

    if (isProfileAdmin) {
      if (form.email.trim()) payload.email = form.email.trim()
      if (form.role.trim()) payload.role = form.role.trim()
    }

    updateProfile(payload, {
      onSuccess: (updatedProfile) => {
        // Sync local form state with final server data
        setForm({
          full_name: updatedProfile.full_name ?? '',
          email: updatedProfile.email ?? '',
          phone: updatedProfile.phone ?? '',
          organization_name: updatedProfile.organization_name ?? '',
          role: String(updatedProfile.role ?? '').replace('UserRole.', ''),
        })
        // Reset sync ref so the useEffect can pick up fresh data on next profile change
        lastSyncedProfileId.current = null
        // Force fresh refetch from server to confirm save
        refetch()
      }
    })
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setImageToCrop(reader.result as string)
      })
      reader.readAsDataURL(file)
    }
    // Reset input value so same file can be selected again
    e.target.value = ''
  }

  const handleCropComplete = (croppedFile: File) => {
    uploadAvatar(croppedFile)
    setImageToCrop(null)
  }

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
              onChange={onFileSelect}
            />
            <div className="profile-avatar-info">
              <p className="profile-avatar-name">{user?.full_name}</p>
              <p className="profile-avatar-email">{user?.email}</p>
              {form.organization_name && (
                <p className="profile-avatar-org">{form.organization_name}</p>
              )}
              <div className="profile-avatar-actions">
                <span className="profile-role-badge">
                  {String(user?.role ?? '').replace('UserRole.', '').toUpperCase()}
                </span>
                {profile?.avatar_url && (
                  <button
                    className="avatar-delete-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteAvatar()
                    }}
                    title="Remove profile picture"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="profile-form">
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

          <div className="profile-field">
            <label className="profile-field-label">Organization Name</label>
            {isProfileAdmin ? (
              <input
                type="text"
                className="profile-field-input"
                value={form.organization_name}
                placeholder="Enter your organization name"
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

          <div className="profile-field" style={{ marginTop: '1.5rem' }}>
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

          <button
            className="profile-save-btn"
            onClick={handleSave}
            disabled={isUpdating || isUploadingAvatar}
            style={{ width: '100%', marginTop: '2rem' }}
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {imageToCrop && (
        <ImageCropperModal
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setImageToCrop(null)}
        />
      )}
    </div>
  )
}
