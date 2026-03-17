import React from 'react'
import type { Candidate } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/utils/formatters'

interface CandidateProfileViewProps {
  candidate: Candidate
}

const STAGE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  applied:                      { color: '#6c47ff', bg: 'rgba(108,71,255,0.10)', label: 'Applied' },
  screening:                    { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', label: 'Screening' },
  interview:                    { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Interview' },
  offer:                        { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Offer' },
  hired:                        { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Hired' },
  rejected:                     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Rejected' },
  pre_screening_selected:       { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Pre-screening Selected' },
  pre_screening_rejected:       { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Pre-screening Rejected' },
  technical_round_selected:     { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Technical Round Selected' },
  technical_round_rejected:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Technical Round Rejected' },
  technical_round_back_out:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Technical Round Back Out' },
  practical_round_selected:     { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Practical Round Selected' },
  practical_round_rejected:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Practical Round Rejected' },
  practical_round_back_out:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Practical Round Back Out' },
  techno_functional_selected:   { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Techno-Functional Selected' },
  techno_functional_rejected:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Techno-Functional Rejected' },
  management_round_selected:    { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Management Round Selected' },
  management_round_rejected:    { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Management Round Rejected' },
  hr_round_selected:            { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'HR Round Selected' },
  hr_round_rejected:            { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'HR Round Rejected' },
  offered:                      { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Offered' },
  offered_back_out:             { color: '#f97316', bg: 'rgba(249,115,22,0.10)', label: 'Offered Back Out' },
  offer_withdrawn:              { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Offer Withdrawn' },
  hired_joined:                 { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Hired / Joined' },
}

function scoreColor(s: number) {
  if (s >= 80) return { text: '#059669', bg: 'rgba(16,185,129,0.12)', track: '#10b981' }
  if (s >= 60) return { text: '#d97706', bg: 'rgba(251,191,36,0.12)', track: '#f59e0b' }
  return { text: '#ef4444', bg: 'rgba(239,68,68,0.10)', track: '#ef4444' }
}

export function CandidateProfileView({ candidate }: CandidateProfileViewProps) {
  const stage = candidate.pipeline_stage || 'applied'
  const stageCfg = candidate.pipeline_stage ? STAGE_CFG[stage] : null
  const sc = candidate.match_score != null ? scoreColor(candidate.match_score) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, paddingBottom: 24, borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
        <Avatar name={candidate.full_name} src={candidate.avatar_url} size="xl" className="ring-4 ring-violet-50 dark:ring-violet-900/20 shadow-lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 4, letterSpacing: '-0.02em' }}>
            {candidate.full_name}
          </h3>
          {candidate.current_title && (
            <p style={{ fontSize: 14, fontWeight: 600, color: '#6c47ff', marginBottom: 2 }}>
              {candidate.current_title}{candidate.current_company ? ` · ${candidate.current_company}` : ''}
            </p>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 500 }}>{candidate.email}</p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {stageCfg ? (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, background: stageCfg.bg, color: stageCfg.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stageCfg.label}
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, background: 'rgba(0,0,0,0.05)', color: 'var(--text-mid)', border: '1px solid rgba(0,0,0,0.05)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Talent Pool
              </span>
            )}
            {sc && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, background: sc.bg, color: sc.text, textTransform: 'uppercase', letterSpacing: '0.05em', border: `1px solid ${sc.track}20` }}>
                {Math.round(candidate.match_score!)}% AI Match
              </span>
            )}
          </div>
        </div>

        {/* Action Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {candidate.resume_url && (
            <a href={candidate.resume_url} target="_blank" rel="noreferrer"
              style={{ 
                fontSize: 12, fontWeight: 700, color: '#6c47ff', display: 'flex', alignItems: 'center', gap: 6, 
                textDecoration: 'none', background: 'rgba(108, 71, 255, 0.08)', padding: '8px 14px', borderRadius: 12,
                transition: 'all 0.2s'
              }}>
              📄 View Resume
            </a>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {candidate.linkedin_url && (
              <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-light)' }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.238 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </a>
            )}
            {candidate.github_url && (
              <a href={candidate.github_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-light)' }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats Quick Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
        {[
          { label: 'Experience', value: `${candidate.years_experience} Yrs` },
          { label: 'Location', value: candidate.location || 'Remote' },
          { label: 'Added On', value: formatDate(candidate.created_at) },
          { label: 'Source', value: candidate.source || 'Sourced' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 16, padding: '12px 16px' }}>
            <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{stat.label}</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* AI Summary Section */}
      {Boolean(candidate.summary) ? (
        <div style={{ background: 'linear-gradient(135deg, #6c47ff, #8b5cf6)', color: '#fff', borderRadius: 24, padding: '24px', boxShadow: '0 10px 30px rgba(108, 71, 255, 0.15)', position: 'relative', overflow: 'hidden' }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>⚡ AI Performance Summary</p>
          <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.7, fontStyle: 'italic', position: 'relative', zIndex: 1 }}>
            "{candidate.summary}"
          </p>
          <div style={{ position: 'absolute', bottom: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        </div>
      ) : null}

      {/* Skills Section */}
      {Boolean(candidate.skills && candidate.skills.length > 0) ? (
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            Technical Expertise <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.05)' }} />
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {candidate.skills.map((skill) => (
              <span key={skill} style={{ fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 10, background: '#fff', color: '#6c47ff', border: '1px solid rgba(108,71,255,0.15)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Work Experience */}
      {Boolean(candidate.parsed_data?.experience && Array.isArray(candidate.parsed_data.experience) && candidate.parsed_data.experience.length > 0) ? (
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            Career Journey <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.05)' }} />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {(candidate.parsed_data?.experience as any[]).map((exp: any, idx: number) => (
              <div key={idx} style={{ position: 'relative', paddingLeft: 20 }}>
                <div style={{ position: 'absolute', left: 0, top: 4, bottom: 0, width: 2, background: 'linear-gradient(to bottom, #6c47ff, transparent)', borderRadius: 1 }} />
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{exp.title}</h4>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#6c47ff', marginBottom: 6 }}>{exp.company} <span style={{ color: 'var(--text-mid)', fontWeight: 500, marginLeft: 6 }}>· {exp.duration}</span></p>
                {exp.description && <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>{exp.description}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Projects */}
      {Boolean(candidate.parsed_data?.projects && Array.isArray(candidate.parsed_data.projects) && candidate.parsed_data.projects.length > 0) ? (
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            Key Projects <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.05)' }} />
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {(candidate.parsed_data?.projects as any[]).map((proj: any, idx: number) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 16, padding: '16px' }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{proj.name}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 10 }}>{proj.description}</p>
                {proj.technologies && Array.isArray(proj.technologies) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {proj.technologies.map((tech: string) => (
                      <span key={tech} style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(108,71,255,0.05)', color: '#6c47ff', textTransform: 'uppercase' }}>{tech}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Education */}
      {Boolean(candidate.parsed_data?.education && Array.isArray(candidate.parsed_data.education) && candidate.parsed_data.education.length > 0) ? (
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            Academic Foundation <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.05)' }} />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(candidate.parsed_data?.education as any[]).map((edu: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{edu.degree}</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>{edu.institution}</p>
                </div>
                {edu.year && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)', background: 'rgba(0,0,0,0.03)', padding: '4px 12px', borderRadius: 20 }}>{edu.year}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
