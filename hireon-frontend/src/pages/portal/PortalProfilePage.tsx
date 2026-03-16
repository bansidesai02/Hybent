import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { portalApi } from '@/api/portal'

function completionPercent(data: {
  full_name: string | null
  phone: string | null
  location: string | null
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  summary: string | null
  skills: string[]
  resume_url: string | null
}): number {
  const fields = [
    !!data.full_name,
    !!data.phone,
    !!data.location,
    !!data.linkedin_url,
    !!data.github_url,
    !!data.portfolio_url,
    !!data.summary,
    data.skills.length > 0,
    !!data.resume_url,
  ]
  return Math.round((fields.filter(Boolean).length / fields.length) * 100)
}

function FieldRow({
  label,
  value,
  placeholder,
  type = 'text',
  icon,
}: {
  label: string
  value: string
  placeholder: string
  type?: string
  icon: string
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--p-text-mid)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        <span>{icon}</span>
        {label}
      </label>
      <input
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        readOnly
        style={{
          width: '100%',
          padding: '11px 16px',
          borderRadius: 12,
          border: '1.5px solid var(--p-input-border)',
          background: 'var(--p-input-bg)',
          fontSize: 14,
          color: 'var(--p-text)',
          fontFamily: "'Sora', sans-serif",
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

export default function PortalProfilePage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['portal', 'profile'],
    queryFn: () => portalApi.profile().then((r) => r.data),
  })

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'C'

  const pct = profile ? completionPercent(profile) : 0

  const pctColor =
    pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: 'var(--p-text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 30,
            fontWeight: 700,
            color: 'var(--p-text)',
            lineHeight: 1.2,
            marginBottom: 4,
          }}
        >
          My Profile
        </h1>
        <p style={{ fontSize: 14, color: 'var(--p-text-mid)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Keep your profile updated to improve match scores.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 80, borderRadius: 16, background: 'rgba(124,58,237,0.05)' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>
          {/* Left panel: avatar + completion */}
          <div>
            <div
              style={{
                background: 'var(--p-kpi)',
                border: '1px solid var(--p-table-border)',
                borderRadius: 16,
                padding: '28px 20px',
                textAlign: 'center',
                boxShadow: 'var(--p-shadow)',
                marginBottom: 16,
              }}
            >
              {/* Avatar with dashed spin border */}
              <div
                style={{
                  position: 'relative',
                  width: 96,
                  height: 96,
                  margin: '0 auto 16px',
                }}
              >
                {/* Spinning dashed border */}
                <div
                  style={{
                    position: 'absolute',
                    inset: -6,
                    borderRadius: '50%',
                    border: '2.5px dashed rgba(124,58,237,0.40)',
                    animation: 'portal-spin-avatar 8s linear infinite',
                  }}
                />
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: "'Fraunces', serif",
                    boxShadow: '0 6px 24px rgba(124,58,237,0.35)',
                  }}
                >
                  {initials}
                </div>
              </div>

              <h3
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 20,
                  color: 'var(--p-text)',
                  marginBottom: 4,
                }}
              >
                {profile?.full_name ?? '—'}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--p-text-mid)', marginBottom: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {profile?.current_title ?? 'Candidate'}
                {profile?.current_company ? ` · ${profile.current_company}` : ''}
              </p>

              {/* Completion ring */}
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--p-text-lite)', fontFamily: "'Plus Jakarta Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Profile Completion
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pctColor, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {pct}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 6,
                    background: 'rgba(124,58,237,0.10)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      borderRadius: 6,
                      background:
                        pct >= 80
                          ? 'linear-gradient(90deg,#10b981,#34d399)'
                          : pct >= 50
                          ? 'linear-gradient(90deg,#f59e0b,#fcd34d)'
                          : 'linear-gradient(90deg,#ef4444,#f87171)',
                      transition: 'width 0.8s ease',
                    }}
                  />
                </div>
              </div>

              {/* Contact quick info */}
              {profile?.email && (
                <p style={{ fontSize: 12, color: 'var(--p-text-lite)', fontFamily: "'Plus Jakarta Sans', sans-serif", wordBreak: 'break-all' }}>
                  {profile.email}
                </p>
              )}
            </div>

            {/* Skills */}
            <div
              style={{
                background: 'var(--p-kpi)',
                border: '1px solid var(--p-table-border)',
                borderRadius: 16,
                padding: '18px 18px',
                boxShadow: 'var(--p-shadow)',
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  color: 'var(--p-text-lite)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  marginBottom: 10,
                }}
              >
                Skills
              </p>
              {profile?.skills && profile.skills.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {profile.skills.map((skill) => (
                    <span
                      key={skill}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: 'rgba(124,58,237,0.10)',
                        color: '#7c3aed',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--p-text-lite)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  No skills listed yet.
                </p>
              )}
            </div>
          </div>

          {/* Right panel: form fields */}
          <div>
            {/* Basic info card */}
            <div
              style={{
                background: 'var(--p-kpi)',
                border: '1px solid var(--p-table-border)',
                borderRadius: 16,
                padding: '22px 24px',
                boxShadow: 'var(--p-shadow)',
                marginBottom: 16,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  color: 'var(--p-text-lite)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  marginBottom: 18,
                }}
              >
                Personal Information
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <FieldRow label="Full Name" value={profile?.full_name ?? ''} placeholder="Your full name" icon="👤" />
                <FieldRow label="Phone" value={profile?.phone ?? ''} placeholder="+1 (555) 000-0000" type="tel" icon="📞" />
                <FieldRow label="Location" value={profile?.location ?? ''} placeholder="City, Country" icon="📍" />
                <FieldRow label="Current Title" value={profile?.current_title ?? ''} placeholder="e.g. Software Engineer" icon="💼" />
              </div>
            </div>

            {/* Links card */}
            <div
              style={{
                background: 'var(--p-kpi)',
                border: '1px solid var(--p-table-border)',
                borderRadius: 16,
                padding: '22px 24px',
                boxShadow: 'var(--p-shadow)',
                marginBottom: 16,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  color: 'var(--p-text-lite)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  marginBottom: 18,
                }}
              >
                Online Presence
              </p>

              <FieldRow label="LinkedIn" value={profile?.linkedin_url ?? ''} placeholder="https://linkedin.com/in/you" type="url" icon="🔗" />
              <FieldRow label="GitHub" value={profile?.github_url ?? ''} placeholder="https://github.com/you" type="url" icon="🐙" />
              <FieldRow label="Portfolio" value={profile?.portfolio_url ?? ''} placeholder="https://yourportfolio.com" type="url" icon="🌐" />
            </div>

            {/* Bio card */}
            <div
              style={{
                background: 'var(--p-kpi)',
                border: '1px solid var(--p-table-border)',
                borderRadius: 16,
                padding: '22px 24px',
                boxShadow: 'var(--p-shadow)',
                marginBottom: 16,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  color: 'var(--p-text-lite)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  marginBottom: 12,
                }}
              >
                Bio / Summary
              </p>
              <textarea
                defaultValue={profile?.summary ?? ''}
                placeholder="Tell us about yourself, your experience, and what you're looking for..."
                readOnly
                rows={4}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: 12,
                  border: '1.5px solid var(--p-input-border)',
                  background: 'var(--p-input-bg)',
                  fontSize: 14,
                  color: 'var(--p-text)',
                  fontFamily: "'Sora', sans-serif",
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  lineHeight: 1.6,
                }}
              />
            </div>

            {/* Resume upload zone */}
            <div
              style={{
                background: 'var(--p-kpi)',
                border: '1px solid var(--p-table-border)',
                borderRadius: 16,
                padding: '22px 24px',
                boxShadow: 'var(--p-shadow)',
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  color: 'var(--p-text-lite)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  marginBottom: 12,
                }}
              >
                Resume
              </p>

              {/* Current resume */}
              {profile?.resume_url && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.20)',
                    marginBottom: 14,
                  }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#10b981">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <a
                    href={profile.resume_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#10b981',
                      textDecoration: 'none',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    {profile.resume_filename ?? 'View Current Resume'}
                  </a>
                </div>
              )}

              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false) }}
                style={{
                  padding: '32px 20px',
                  borderRadius: 14,
                  border: `2px dashed ${dragOver ? '#7c3aed' : 'rgba(124,58,237,0.25)'}`,
                  background: dragOver ? 'rgba(124,58,237,0.06)' : 'rgba(124,58,237,0.02)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#7c3aed',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    marginBottom: 4,
                  }}
                >
                  Drop your resume here or click to upload
                </p>
                <p style={{ fontSize: 11, color: 'var(--p-text-lite)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  PDF, DOC, DOCX — max 5 MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={() => {/* upload handled by recruiter, read-only in portal */}}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
