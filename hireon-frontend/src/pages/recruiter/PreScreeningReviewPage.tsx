/**
 * Pre-Screening Review Page — HR / Recruiter
 * Listen to candidate audio responses, read transcripts, generate AI summary.
 */
import { useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  ArrowLeft,
  Calendar,
  Mic,
  Briefcase,
  User,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { preScreeningApi, type PreScreeningSession } from '@/api/preScreening'
import { PreScreeningSessionView, STATUS_CFG } from '@/components/PreScreening/PreScreeningSessionView'
import { formatDate } from '@/utils/formatters'

export default function PreScreeningReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const { data: session, isLoading, error } = useQuery<PreScreeningSession>({
    queryKey: ['pre-screening', sessionId],
    queryFn: async () => {
      const res = await preScreeningApi.getSession(sessionId!)
      return res.data
    },
    enabled: !!sessionId,
  })

  const summariseMutation = useMutation({
    mutationFn: () => preScreeningApi.summariseSession(sessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre-screening', sessionId] })
      toast.success('AI summary generated successfully')
    },
    onError: () => {
      toast.error('Failed to generate AI summary')
    },
  })

  if (isLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.skeleton} />
        <div style={{ ...styles.skeleton, width: '60%' }} />
        <div style={{ ...styles.skeleton, height: '200px' }} />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>
          <AlertTriangle size={32} color="#ef4444" />
          <p>Session not found or you don't have access.</p>
          <button onClick={() => navigate(-1)} style={styles.backLinkBtn}>
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CFG[session.status] || STATUS_CFG.pending

  return (
    <div style={styles.page}>
      {/* Back nav */}
      <button
        style={styles.backBtn}
        onClick={() => {
          const candidateId = (location.state as any)?.candidateId ?? session.candidate_id
          navigate(`/recruiter/candidates?openId=${candidateId}&tab=prescreen`)
        }}
      >
        <ArrowLeft size={16} />
        Back to Candidate
      </button>

      {/* Hero card */}
      <div style={styles.heroCard}>
        <div style={styles.heroLeft}>
          <div style={styles.avatar}>
            <User size={24} color="#6c47ff" />
          </div>
          <div>
            <h1 style={styles.heroName}>{session.candidate_name || 'Candidate'}</h1>
            <p style={styles.heroEmail}>{session.candidate_email}</p>
            {session.job_title && (
              <div style={styles.jobBadge}>
                <Briefcase size={13} />
                {session.job_title}
              </div>
            )}
          </div>
        </div>
        <div style={styles.heroRight}>
          <div style={{ ...styles.statusBadge, color: statusCfg.color, background: statusCfg.bg }}>
            {statusCfg.label}
          </div>
          <div style={styles.heroMeta}>
            <div style={styles.metaItem}>
              <Calendar size={13} />
              {formatDate(session.created_at)}
            </div>
            {session.completed_at && (
              <div style={styles.metaItem}>
                <CheckCircle size={13} />
                Completed {formatDate(session.completed_at)}
              </div>
            )}
            <div style={styles.metaItem}>
              <Mic size={13} />
              {session.responses.length} / {session.questions.length} answered
            </div>
          </div>
        </div>
      </div>

      {/* Shared session view: AI summary + responses */}
      <PreScreeningSessionView
        session={session}
        onSummarise={() => summariseMutation.mutate()}
        summarising={summariseMutation.isPending}
      />

      {/* Proceed CTA */}
      {session.status === 'completed' && (
        <div style={styles.ctaBar}>
          <Link to="/recruiter/interviews" style={styles.scheduleCta}>
            <Calendar size={16} />
            Proceed to Schedule Interview
          </Link>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '24px 28px',
    maxWidth: '900px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  skeleton: {
    width: '100%',
    height: '28px',
    borderRadius: '8px',
    background: '#f0edff',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '40px',
    color: '#6b7280',
    textAlign: 'center',
  },
  backLinkBtn: {
    padding: '8px 20px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-mid, #6b7280)',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px 0',
  },
  heroCard: {
    background: '#fff',
    borderRadius: '18px',
    border: '1px solid var(--card-border, #e8e6ff)',
    padding: '24px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  heroLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
  },
  avatar: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'rgba(108,71,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroName: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#1a1040',
    margin: '0 0 2px 0',
  },
  heroEmail: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '0 0 6px 0',
  },
  jobBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    borderRadius: '20px',
    background: 'rgba(108,71,255,0.08)',
    color: '#6c47ff',
    fontWeight: 600,
    fontSize: '12px',
  },
  heroRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
  },
  statusBadge: {
    padding: '5px 14px',
    borderRadius: '20px',
    fontWeight: 700,
    fontSize: '13px',
  },
  heroMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    alignItems: 'flex-end',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    color: '#9ca3af',
  },
  ctaBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: '8px',
    borderTop: '1px solid #f0edff',
  },
  scheduleCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 22px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #1a1040, #3b1fa8)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '14px',
    textDecoration: 'none',
  },
}
