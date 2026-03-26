import React, { useState, useRef } from 'react'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { portalApi } from '@/api/portal'
import { formatSalary } from '@/utils/formatters'

function completionPercent(data: any): number {
  const fields = [
    !!data.full_name,
    !!data.phone,
    !!data.location,
    !!data.linkedin_url,
    !!data.github_url,
    !!data.summary,
    data.skills?.length > 0,
    !!data.resume_url,
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
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null)

  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['portal', 'profile'],
    queryFn: () => portalApi.profile().then((r) => r.data),
    refetchInterval: 30_000,
  })

  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')

  React.useEffect(() => {
    if (profile) {
      setSkills(profile.skills || profile.tags || [])
    }
  }, [profile])


  const uploadMutation = useMutation({
    mutationFn: (file: File) => portalApi.uploadResume(file),
    onSuccess: () => {
      setUploadError(null)
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })
    },
    onError: (err: any) => {
      setUploadError(err?.response?.data?.detail || 'Upload failed. Please try again.')
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: any) => portalApi.updateProfile(data),
    onSuccess: () => {
      setSaveStatus({ type: 'success', msg: 'Profile saved successfully!' })
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] })
      setTimeout(() => setSaveStatus(null), 3000)
    },
    onError: (err: any) => {
      setSaveStatus({ type: 'error', msg: err?.response?.data?.detail || 'Failed to save profile. Please try again.' })
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
        <div className="pt">My Profile &amp; Resume 👤</div>
        <div className="ps">Keep your profile up to date to help interviewers understand you better.</div>
      </div>

      <form id="profile-form" className="g2" style={{ marginBottom: 20 }} onSubmit={handleSave}>


        {/* PROFILE CARD */}
        <div className="card">
          <div className="ctitle">Profile</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
            <div className="prof-av-big">{initials}</div>
            <div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: 'var(--text)' }}>
                {profile?.full_name || 'Candidate'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 3 }}>
                {profile?.current_title || 'Position'}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <span className={`chip ${isComplete ? 'chip-green' : 'chip-amber'}`}>
                  <span className="chd"></span>{isComplete ? 'Profile Complete' : 'Incomplete'} ({pct}%)
                </span>
                <span className="chip chip-violet"><span className="chd"></span>Active</span>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', marginBottom: 10, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '.5px' }}>
              📅 INTERVIEW AVAILABILITY
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

            {profile?.resume_url && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>📄</span>
                <a href={profile.resume_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', textDecoration: 'none' }}>
                  {profile.resume_filename || 'View Current Resume'}
                </a>
              </div>
            )}

            {uploadError && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', marginBottom: 12, fontSize: 13, color: '#ef4444' }}>
                ⚠️ {uploadError}
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
              <div className="upload-zone-ico">
                {uploadMutation.isPending ? '⏳' : '📎'}
              </div>
              <div className="upload-zone-title">
                {uploadMutation.isPending ? 'Uploading & parsing resume...' : 'Drop your resume here'}
              </div>
              <div className="upload-zone-sub">
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
                    style={{ background: 'none', border: 'none', color: 'currentcolor', cursor: 'pointer', padding: 0, margin: 0, fontSize: 16, lineHeight: 1 }}
                  >
                    &times;
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


      {/* BOTTOM SAVE BAR */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 16,
        marginTop: 10
      }}>
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
          form="profile-form"
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
  )
}
