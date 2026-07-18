import React, { useState, useRef } from 'react'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { portalApi } from '@/api/portal'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { formatSalary } from '@/utils/formatters'
import ImageCropperModal from '@/components/common/ImageCropperModal'
import { User, Loader2, Camera, Calendar, FileText, AlertTriangle, Paperclip, X, Check } from 'lucide-react'
import { GlassIcon } from '@/components/common/GlassIcon'

function completionPercent(data: any): number {
  const fields = [
    !!data.full_name,
    !!data.phone,
    !!data.location,
    !!data.linkedin_url,
    !!data.github_url,
    !!data.summary,
    data.skills?.length > 0,
    !!data.resume_url || !!data.resume_storage_path,
    !!data.experience_years,
    !!data.current_ctc,
    !!data.availability_status
  ]
  return Math.round((fields.filter(Boolean).length / fields.length) * 100)
}

function FieldRow({ label, name, value, placeholder, type = 'text', readOnly = false }: { label: string; name?: string; value: string; placeholder: string; type?: string; readOnly?: boolean }) {
  return (
    <div>
      <label className="flabel">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        readOnly={readOnly}
        className="finput"
      />
    </div>
  )
}

export default function PortalProfilePage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null)
  const { user, setUser } = useAuthStore()
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['portal', 'profile'],
    queryFn: () => portalApi.profile().then((r: any) => r.data),
  })

  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')

  React.useEffect(() => {
    if (profile) {
      setSkills(profile.skills || profile.tags || [])
    }
  }, [profile])


  // ── Resume upload ──────────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: (file: File) => portalApi.uploadResume(file),
    onSuccess: () => {
      setUploadError(null)
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })
    },
    onError: (err: any) => {
      setUploadError(err?.response?.data?.message || err?.response?.data?.detail || 'Upload failed. Please try again.')
    },
  })

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const avatarMutation = useMutation({
    mutationFn: (file: File) => portalApi.uploadAvatar(file),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })
      // Also sync auth store so the topbar avatar updates instantly
      if (res?.data) setUser(res.data)
    },
    onError: () => {
      alert('Failed to upload avatar. Only JPG, PNG, WEBP under 5 MB are allowed.')
    },
  })

  const deleteAvatarMutation = useMutation({
    mutationFn: () => portalApi.deleteAvatar(),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })
      if (res?.data) setUser(res.data)
    },
  })

  const handleAvatarFile = (file: File | undefined) => {
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      alert('Only JPG, PNG, WEBP or GIF images are supported.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image is too large. Maximum size is 5 MB.')
      return
    }
    
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setImageToCrop(reader.result as string)
    })
    reader.readAsDataURL(file)
  }

  const handleCropComplete = (croppedFile: File) => {
    avatarMutation.mutate(croppedFile)
    setImageToCrop(null)
  }

  const handleDeleteAvatar = () => {
    if (confirm('Are you sure you want to remove your profile picture?')) {
      deleteAvatarMutation.mutate()
    }
  }

  const saveMutation = useMutation({
    mutationFn: (data: any) => portalApi.updateProfile(data),
    onSuccess: () => {
      setSaveStatus({ type: 'success', msg: 'Profile saved successfully!' })
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })
      setTimeout(() => setSaveStatus(null), 3000)
    },
    onError: (err: any) => {
      setSaveStatus({ type: 'error', msg: err?.response?.data?.message || err?.response?.data?.detail || 'Failed to save profile. Please try again.' })
    },
  })

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaveStatus(null)
    const formData = new FormData(e.currentTarget)
    const data: Record<string, any> = Object.fromEntries(formData.entries())
    
    // Combine first and last name
    if (data.first_name || data.last_name) {
      data.full_name = `${data.first_name || ''} ${data.last_name || ''}`.trim()
      delete data.first_name
      delete data.last_name
    }
    
    data.tags = skills

    saveMutation.mutate(data)
  }


  const handleFile = (file: File | undefined) => {
    if (!file) return
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!allowed.includes(file.type)) {
      setUploadError('Only PDF, DOC, or DOCX files are supported.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File is too large. Maximum size is 5 MB.')
      return
    }
    setUploadError(null)
    uploadMutation.mutate(file)
  }

  if (isLoading) {
    return <div className="p-8 text-center text-[var(--text-lite)]">Loading profile...</div>
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'C'

  const pct = profile ? completionPercent(profile) : 0
  const isComplete = pct >= 80

  return (
    <div className="page active" id="page-profile">
      <div className="ph">
        <div className="pt" style={{ display: 'flex', alignItems: 'center', gap: 10 }}> My Profile &amp; Resume <GlassIcon icon="User" variant="violet" size={30} iconSize={16} /></div>
        <div className="ps">Keep your profile up to date to help interviewers understand you better.</div>
      </div>

      <form id="profile-form" className="g2" style={{ marginBottom: 20 }} onSubmit={handleSave}>


        {/* PROFILE CARD */}
        <div className="card">
          <div className="ctitle">Profile</div>

          <div className="profile-avatar-row">
            {/* Clickable avatar with upload buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <div
                  className="prof-av-big"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Click to change photo"
                  style={{ cursor: 'pointer' }}
                >
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt="avatar"
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    initials
                  )}
                  {/* Camera overlay on hover */}
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 22, opacity: 0,
                    transition: 'opacity 0.2s',
                    color: '#fff',
                  }}
                    className="prof-av-overlay"
                  >
                    {avatarMutation.isPending ? <Loader2 className="animate-spin" size={24} /> : <GlassIcon icon="Camera" variant="gray" size={32} iconSize={18} ghost glow={false} />}
                  </div>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                <div style={{ color: 'var(--brand)', cursor: 'pointer' }} onClick={() => avatarInputRef.current?.click()}>
                  UPLOAD
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: 'var(--text)' }}>
                {profile?.full_name || 'Candidate'}
              </div>
              {profile?.current_title && (
                <div style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 3 }}>
                  {profile.current_title}
                </div>
              )}
              {profile?.organization_name && (
                <div style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 2, fontWeight: 600 }}>
                  {profile.organization_name}
                </div>
              )}
              <div style={{ marginTop: 8, display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={`chip ${isComplete ? 'chip-green' : 'chip-amber'}`}>
                  <span className="chd"></span>{isComplete ? 'Profile Complete' : 'Incomplete'} ({pct}%)
                </span>
                <span className="chip chip-violet"><span className="chd"></span>Active</span>
                {user?.avatar_url && (
                  <button
                    type="button"
                    onClick={() => deleteAvatarMutation.mutate()}
                    disabled={deleteAvatarMutation.isPending}
                    style={{
                      background: 'none', border: 'none', color: '#ef4444',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      padding: '2px 6px', borderRadius: 4,
                      textDecoration: 'underline',
                    }}
                  >
                    {deleteAvatarMutation.isPending ? 'Removing...' : 'Remove Photo'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="frow" style={{ marginBottom: 12 }}>
            <FieldRow label="First Name" name="first_name" value={profile?.full_name?.split(' ')[0] || ''} placeholder="First" />
            <FieldRow label="Last Name" name="last_name" value={profile?.full_name?.split(' ').slice(1).join(' ') || ''} placeholder="Last" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <FieldRow label="Email" name="email" value={profile?.email || ''} placeholder="Email address" type="email" />
          </div>

          <div className="frow" style={{ marginBottom: 12 }}>
            <FieldRow label="Phone" name="phone" value={profile?.phone || ''} placeholder="+1 555-0000" type="tel" />
            <FieldRow label="Location" name="location" value={profile?.location || ''} placeholder="City, Country" />
          </div>

          <div className="frow" style={{ marginBottom: 12 }}>
            <FieldRow label="Experience" name="experience_years" value={profile?.experience_years != null ? `${profile.experience_years} Years` : ''} placeholder="e.g. 5 Years" />
            <FieldRow label="Notice Period" name="notice_period_days" value={profile?.notice_period_days != null ? `${profile.notice_period_days} Days` : ''} placeholder="e.g. 30 Days" />
          </div>

          <div className="frow" style={{ marginBottom: 12 }}>
            <FieldRow label="Current CTC" name="current_ctc" value={profile?.current_ctc || ''} placeholder="e.g. ₹22,00,000" />
            <FieldRow label="Expected CTC" name="expected_ctc" value={profile?.expected_ctc || ''} placeholder="e.g. ₹32,00,000" />
          </div>

          <div className="frow" style={{ marginBottom: 12 }}>
            <div>
              <label className="flabel">YOU WILL ABLE TO JOIN WITHIN</label>
              <input
                type="text"
                name="availability_status"
                className="finput"
                defaultValue={profile?.availability_status || ''}
                placeholder="e.g. 15 Days"
              />
            </div>
          </div>

          {/* INTERVIEW AVAILABILITY */}
          <div style={{ borderTop: '1px solid var(--table-border)', paddingTop: 14, marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '.8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GlassIcon icon="Calendar" variant="violet" size={24} iconSize={12} ghost glow={false} /> INTERVIEW AVAILABILITY
            </div>
            <div className="frow" style={{ marginBottom: 10 }}>
              <div>
                <label className="flabel">Preferred Interview Date</label>
                <input 
                  type="date"
                  name="interview_availability_days"
                  className="finput" 
                  defaultValue={Array.isArray(profile?.interview_availability_days) ? profile?.interview_availability_days[0] : (profile?.interview_availability_days || '')} 
                />
              </div>
              <div>
                <label className="flabel">Preferred Time Slot</label>
                <input 
                  type="time" 
                  name="interview_time_slot"
                  className="finput" 
                  defaultValue={profile?.interview_time_slot || ''} 
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 24 }}>
            {saveStatus && (
              <div style={{ 
                color: saveStatus.type === 'success' ? '#10B981' : '#EF4444', 
                fontSize: 14, 
                fontWeight: 600
              }}>
                {saveStatus.msg}
              </div>
            )}
            <button
              type="submit"
              disabled={saveMutation.isPending}
              style={{
                background: 'var(--brand)',
                color: 'white',
                border: 'none',
                padding: '10px 24px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: saveMutation.isPending ? 0.7 : 1,
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)'
              }}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>

        {/* SIDE COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Bio Box */}
          <div className="card">
            <div className="ctitle">Bio &amp; Summary</div>
            <textarea
              name="summary"
              className="ftarea"
              defaultValue={profile?.summary || ''}
              placeholder="Tell us about yourself..."
            />
          </div>

          {/* Links Box */}
          <div className="card">
            <div className="ctitle">Links &amp; Social</div>
            <div style={{ marginBottom: 12 }}>
              <FieldRow label="LinkedIn" name="linkedin_url" value={profile?.linkedin_url || ''} placeholder="linkedin.com/in/" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <FieldRow label="GitHub" name="github_url" value={profile?.github_url || ''} placeholder="github.com/" />
            </div>
            <div>
              <FieldRow label="Portfolio" name="portfolio_url" value={profile?.portfolio_url || ''} placeholder="https://" />
            </div>
          </div>

          {/* Resume & Skills Box */}
          <div className="card">
            <div className="ctitle">Resume <span className="ctag violet">Required</span></div>

            {(profile?.resume_storage_path || profile?.resume_url) && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <GlassIcon icon="FileText" variant="emerald" size={24} iconSize={12} ghost glow={false} />
                <button
                  onClick={async () => {
                    if (profile?.resume_storage_path) {
                      try {
                        const { portalApi } = await import('@/api/portal')
                        const res = await portalApi.getResumeUrl()
                        const data = (res.data as any)?.data ?? res.data
                        if (data?.url) window.open(data.url, '_blank', 'noreferrer')
                      } catch { alert('Could not load resume. Please try again.') }
                    } else {
                      window.open(profile!.resume_url!, '_blank', 'noreferrer')
                    }
                  }}
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {profile?.resume_filename || 'View Current Resume'}
                </button>
              </div>
            )}

            {uploadError && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', marginBottom: 12, fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                <GlassIcon icon="AlertTriangle" variant="rose" size={24} iconSize={12} ghost glow={false} /> {uploadError}
              </div>
            )}

            <div
              className="upload-zone"
              onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFile(e.dataTransfer.files[0])
              }}
              style={{
                ...(dragOver ? { borderColor: 'var(--brand)', background: 'rgba(124,58,237,.07)' } : {}),
                cursor: uploadMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: uploadMutation.isPending ? 0.7 : 1,
              }}
            >
              <div className="upload-zone-ico" style={{ marginBottom: 12 }}>
                {uploadMutation.isPending ? <Loader2 className="animate-spin" size={24} /> : <GlassIcon icon="Paperclip" variant="violet" size={48} iconSize={24} />}
              </div>
              <div className="upload-zone-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                {uploadMutation.isPending ? 'Uploading & parsing resume...' : 'Drop your resume here'}
              </div>
              <div className="upload-zone-sub" style={{ fontSize: 11, opacity: 0.7 }}>
                {uploadMutation.isPending ? 'This may take a moment' : 'PDF, DOC, DOCX — max 5 MB'}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.doc,.docx"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>

            <div className="ctitle" style={{ marginTop: 20 }}>Skills</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {skills.map((skill: string) => (
                <span key={skill} className="skill-tag" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {skill}
                  <button 
                    type="button" 
                    onClick={() => setSkills(skills.filter(s => s !== skill))} 
                    style={{ background: 'none', border: 'none', color: 'currentcolor', cursor: 'pointer', padding: 0, margin: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = newSkill.trim();
                    if (val && !skills.includes(val)) setSkills([...skills, val]);
                    setNewSkill('');
                  }
                }}
                placeholder="+ Add skill"
                className="skill-tag add"
                style={{ background: 'transparent', outline: 'none', width: '90px' }}
              />
            </div>
          </div>


        </div>
      </form>

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
