/**
 * PreScreeningSessionView — shared component used by PreScreeningReviewPage and PreScreenTab.
 * Renders AI summary + all response cards for a pre-screening session.
 */
import { useState, useEffect, useRef } from 'react'
import {
  Mic,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Star,
  Play,
  Pause,
} from 'lucide-react'
import { preScreeningApi, type PreScreeningSession, type AISummary } from '@/api/preScreening'

// ── Config ────────────────────────────────────────────────────────────────────

export const CATEGORY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  job_description: { label: 'Role & Requirements', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
  resume:          { label: 'Your Experience',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)' },
  role_awareness:  { label: 'Professional Awareness', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
}

export const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
  completed:   { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.10)'  },
}

export const RECOMMENDATION_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  proceed: { label: 'Proceed to Interview', color: '#22c55e', icon: <CheckCircle size={16} /> },
  hold:    { label: 'Hold / Review',        color: '#f59e0b', icon: <Clock size={16} /> },
  reject:  { label: 'Not Suitable',         color: '#ef4444', icon: <AlertTriangle size={16} /> },
}

// ── ScoreStars ────────────────────────────────────────────────────────────────

export function ScoreStars({ score }: { score: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < score ? '#f59e0b' : 'none'}
          color={i < score ? '#f59e0b' : '#d1d5db'}
        />
      ))}
    </div>
  )
}

// ── ResponseCard ──────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function ResponseCard({
  question,
  response,
  index,
}: {
  question: { id: number; text: string; category: string }
  response?: {
    id: string
    transcript: string | null
    duration_seconds: number | null
    audio_file_path: string | null
  }
  index: number
}) {
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cat = CATEGORY_CFG[question.category] || CATEGORY_CFG.role_awareness

  // Total duration: use stored DB value immediately — no metadata wait
  const totalSeconds = response?.duration_seconds ?? 0

  useEffect(() => {
    if (!response?.audio_file_path) {
      setAudioUrl(null)
      return
    }
    if (response.audio_file_path.startsWith('https://')) {
      setAudioUrl(response.audio_file_path)
      return
    }
    let objectUrl: string
    preScreeningApi.fetchAudioBlob(response.id)
      .then(res => {
        objectUrl = URL.createObjectURL(res.data)
        setAudioUrl(objectUrl)
      })
      .catch(() => setAudioUrl(null))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [response?.id, response?.audio_file_path])

  const handlePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !totalSeconds) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pct * totalSeconds
    setPlaybackTime(pct * totalSeconds)
  }

  const progressPct = totalSeconds > 0 ? Math.min((playbackTime / totalSeconds) * 100, 100) : 0

  return (
    <div style={cardStyles.wrap}>
      <div style={cardStyles.header}>
        <div style={cardStyles.qMeta}>
          <span style={cardStyles.qNum}>Q{index + 1}</span>
          <span style={{ ...cardStyles.catBadge, color: cat.color, background: cat.bg }}>
            {cat.label}
          </span>
        </div>
        {totalSeconds > 0 && (
          <span style={cardStyles.duration}>
            <Clock size={12} />
            {Math.round(totalSeconds)}s
          </span>
        )}
      </div>

      <p style={cardStyles.qText}>{question.text}</p>

      {response ? (
        <div style={cardStyles.responseArea}>
          {audioUrl && (
            <div style={cardStyles.playerWrap}>
              {/* Hidden audio element */}
              <audio
                ref={audioRef}
                src={audioUrl}
                preload="none"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => { setIsPlaying(false); setPlaybackTime(0); if (audioRef.current) audioRef.current.currentTime = 0 }}
                onTimeUpdate={() => { if (audioRef.current) setPlaybackTime(audioRef.current.currentTime) }}
              />
              {/* Play / Pause button */}
              <button style={cardStyles.playBtn} onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
              </button>
              {/* Progress + time */}
              <div style={cardStyles.playerRight}>
                <div style={cardStyles.progressTrack} onClick={handleProgressClick}>
                  <div style={{ ...cardStyles.progressFill, width: `${progressPct}%` }} />
                </div>
                <div style={cardStyles.timeRow}>
                  <span style={cardStyles.currentTime}>{formatTime(playbackTime)}</span>
                  <span style={cardStyles.timeSep}>/</span>
                  <span style={cardStyles.totalTime}>{formatTime(totalSeconds)}</span>
                </div>
              </div>
            </div>
          )}

          <button
            style={cardStyles.transcriptToggle}
            onClick={() => setTranscriptOpen(o => !o)}
          >
            <FileText size={13} />
            {transcriptOpen ? 'Hide Transcript' : 'Show Transcript'}
            {transcriptOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {transcriptOpen && (
            <div style={cardStyles.transcript}>
              {response.transcript ? (
                <p style={cardStyles.transcriptText}>{response.transcript}</p>
              ) : (
                <p style={cardStyles.transcriptPending}>Transcript is still being processed…</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={cardStyles.noResponse}>
          <Mic size={14} />
          No response recorded
        </div>
      )}
    </div>
  )
}

const cardStyles: Record<string, React.CSSProperties> = {
  wrap: {
    background: '#fff',
    borderRadius: '14px',
    border: '1px solid var(--card-border, #e8e6ff)',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  qNum: {
    fontWeight: 800,
    fontSize: '12px',
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
  },
  catBadge: {
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600,
  },
  duration: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: '#9ca3af',
  },
  qText: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1a1040',
    lineHeight: 1.5,
    margin: 0,
  },
  responseArea: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  playerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#fff',
    border: '1px solid #e8e6ff',
    borderRadius: '10px',
    padding: '8px 12px',
    boxShadow: '0 1px 4px rgba(108,71,255,0.06)',
  },
  playBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #6c47ff, #9b80ff)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(108,71,255,0.28)',
  },
  playerRight: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    minWidth: 0,
  },
  progressTrack: {
    height: '4px',
    borderRadius: '2px',
    background: '#e8e6ff',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  progressFill: {
    height: '100%',
    borderRadius: '2px',
    background: 'linear-gradient(90deg, #6c47ff, #ff6bc6)',
    transition: 'width 0.15s linear',
  },
  timeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
  },
  currentTime: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#6c47ff',
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
  timeSep: {
    fontSize: '10px',
    color: '#c4bfec',
  },
  totalTime: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#9ca3af',
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
  transcriptToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    background: 'transparent',
    border: 'none',
    color: '#6c47ff',
    fontWeight: 600,
    fontSize: '12px',
    cursor: 'pointer',
    padding: '2px 0',
  },
  transcript: {
    background: '#f7f5ff',
    borderRadius: '10px',
    padding: '12px 14px',
    border: '1px solid #e8e6ff',
  },
  transcriptText: {
    fontSize: '13px',
    color: '#374151',
    lineHeight: 1.6,
    margin: 0,
  },
  transcriptPending: {
    fontSize: '13px',
    color: '#9ca3af',
    fontStyle: 'italic',
    margin: 0,
  },
  noResponse: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
}

// ── PreScreeningSessionView ───────────────────────────────────────────────────

interface PreScreeningSessionViewProps {
  session: PreScreeningSession
  onSummarise?: () => void
  summarising?: boolean
}

export function PreScreeningSessionView({
  session,
  onSummarise,
  summarising = false,
}: PreScreeningSessionViewProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(true)

  const parsedSummary: AISummary | null = (() => {
    if (!session.overall_ai_summary) return null
    try {
      return JSON.parse(session.overall_ai_summary)
    } catch {
      return null
    }
  })()

  const responseMap = new Map(session.responses.map(r => [r.question_index, r]))

  return (
    <div style={svStyles.root}>
      {/* AI Summary section */}
      <div style={svStyles.section}>
        <div style={svStyles.sectionHeader}>
          <h2 style={svStyles.sectionTitle}>
            <Sparkles size={16} color="#6c47ff" />
            AI Summary
          </h2>
          <div style={svStyles.sectionActions}>
            {parsedSummary && (
              <button
                style={svStyles.iconToggle}
                onClick={() => setSummaryExpanded(o => !o)}
              >
                {summaryExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
            {session.status === 'completed' && onSummarise && (
              <button
                style={svStyles.generateBtn}
                onClick={onSummarise}
                disabled={summarising}
              >
                {summarising ? (
                  <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                ) : (
                  <><Sparkles size={14} /> {parsedSummary ? 'Regenerate' : 'Generate AI Summary'}</>
                )}
              </button>
            )}
          </div>
        </div>

        {parsedSummary && summaryExpanded ? (
          <div style={svStyles.summaryCard}>
            {parsedSummary.recommendation && (
              <div
                style={{
                  ...svStyles.recBanner,
                  color: RECOMMENDATION_CFG[parsedSummary.recommendation]?.color || '#6b7280',
                  background: `${RECOMMENDATION_CFG[parsedSummary.recommendation]?.color || '#6b7280'}12`,
                  borderColor: `${RECOMMENDATION_CFG[parsedSummary.recommendation]?.color || '#6b7280'}30`,
                }}
              >
                {RECOMMENDATION_CFG[parsedSummary.recommendation]?.icon}
                <span style={{ fontWeight: 700 }}>
                  {RECOMMENDATION_CFG[parsedSummary.recommendation]?.label}
                </span>
                {parsedSummary.recommendation_reason && (
                  <span style={{ fontWeight: 400, opacity: 0.9 }}>
                    — {parsedSummary.recommendation_reason}
                  </span>
                )}
              </div>
            )}

            <div style={svStyles.scoreGrid}>
              {[
                { label: 'Communication', score: parsedSummary.communication_score },
                { label: 'Technical',     score: parsedSummary.technical_score },
                { label: 'Culture Fit',   score: parsedSummary.culture_fit_score },
              ].map(({ label, score }) => (
                <div key={label} style={svStyles.scoreItem}>
                  <span style={svStyles.scoreLabel}>{label}</span>
                  <ScoreStars score={score} />
                </div>
              ))}
            </div>

            {parsedSummary.overall_impression && (
              <div style={svStyles.impressionBox}>
                <p style={svStyles.impressionText}>{parsedSummary.overall_impression}</p>
              </div>
            )}

            <div style={svStyles.twoCols}>
              {parsedSummary.key_strengths?.length > 0 && (
                <div>
                  <p style={svStyles.listTitle}>Key Strengths</p>
                  <ul style={svStyles.list}>
                    {parsedSummary.key_strengths.map((s, i) => (
                      <li key={i} style={{ color: '#166534' }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {parsedSummary.concerns?.length > 0 && (
                <div>
                  <p style={svStyles.listTitle}>Concerns</p>
                  <ul style={svStyles.list}>
                    {parsedSummary.concerns.map((c, i) => (
                      <li key={i} style={{ color: '#991b1b' }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : !parsedSummary ? (
          <div style={svStyles.summaryEmpty}>
            <p style={svStyles.summaryEmptyText}>
              {session.status !== 'completed'
                ? 'Summary will be available once the candidate completes the pre-screening.'
                : 'Click "Generate AI Summary" to analyse the candidate\'s responses.'}
            </p>
          </div>
        ) : null}
      </div>

      {/* Responses section */}
      <div style={svStyles.section}>
        <div style={svStyles.sectionHeader}>
          <h2 style={svStyles.sectionTitle}>
            <Mic size={16} color="#6c47ff" />
            Responses ({session.responses.length} / {session.questions.length})
          </h2>
        </div>
        <div style={svStyles.responseList}>
          {session.questions.map((q, i) => (
            <ResponseCard
              key={q.id}
              question={q}
              response={responseMap.get(i) as any}
              index={i}
            />
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const svStyles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '16px',
    fontWeight: 700,
    color: '#1a1040',
    margin: 0,
  },
  sectionActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  iconToggle: {
    background: 'var(--input-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '8px',
    padding: '5px',
    cursor: 'pointer',
    display: 'flex',
    color: 'var(--text-mid)',
  },
  generateBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #6c47ff, #9b80ff)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
  },
  summaryCard: {
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #e8e6ff',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  recBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid',
    fontSize: '14px',
    flexWrap: 'wrap',
  },
  scoreGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  scoreItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px',
    background: '#fafafa',
    borderRadius: '10px',
    border: '1px solid #f0edff',
  },
  scoreLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  impressionBox: {
    padding: '14px',
    background: '#f7f5ff',
    borderRadius: '10px',
    border: '1px solid #e8e6ff',
  },
  impressionText: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.6,
    margin: 0,
  },
  twoCols: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  listTitle: {
    fontWeight: 700,
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: '0 0 6px 0',
  },
  list: {
    margin: 0,
    paddingLeft: '16px',
    fontSize: '13px',
    lineHeight: 1.7,
  },
  summaryEmpty: {
    padding: '20px',
    background: '#fafafa',
    borderRadius: '12px',
    border: '1px dashed #e5e7eb',
    textAlign: 'center',
  },
  summaryEmptyText: {
    color: '#9ca3af',
    fontSize: '14px',
    margin: 0,
  },
  responseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
}
