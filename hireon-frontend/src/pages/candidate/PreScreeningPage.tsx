/**
 * Pre-Screening Interview Page — public, token-based (no login required)
 * Candidate answers 10 AI-generated questions via audio recording.
 * Supports English, Hindi, and Gujarati with TTS question playback.
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, ChevronRight, AlertTriangle, Mic, Clock, FileText, Briefcase, Loader2 } from 'lucide-react'
import { preScreeningApi, type PublicSession, type ScreeningQuestion, type ScreeningLanguage } from '@/api/preScreening'
import { AudioRecorder } from '@/components/PreScreening/AudioRecorder'

type PageState = 'loading' | 'intro' | 'question' | 'completed' | 'error'

// ── Language configuration ────────────────────────────────────────────────────

const LANGUAGE_OPTIONS: { key: ScreeningLanguage; label: string; nativeLabel: string; flag: string; ttsCode: string }[] = [
  { key: 'english',  label: 'English',  nativeLabel: 'English',    flag: '🇬🇧', ttsCode: 'en-IN' },
  { key: 'hindi',    label: 'Hindi',    nativeLabel: 'हिन्दी',      flag: '🇮🇳', ttsCode: 'hi-IN' },
  { key: 'gujarati', label: 'Gujarati', nativeLabel: 'ગુજરાતી',    flag: '🇮🇳', ttsCode: 'gu-IN' },
]

const LANGUAGE_TTS_CODE: Record<ScreeningLanguage, string> = {
  english:  'en-IN',
  hindi:    'hi-IN',
  gujarati: 'gu-IN',
}

const CATEGORY_LABELS_I18N: Record<ScreeningLanguage, Record<string, { label: string; color: string }>> = {
  english: {
    job_description: { label: 'Role & Requirements', color: '#3b82f6' },
    resume:          { label: 'Your Experience',     color: '#8b5cf6' },
    role_awareness:  { label: 'Professional Awareness', color: '#f59e0b' },
  },
  hindi: {
    job_description: { label: 'भूमिका और आवश्यकताएं', color: '#3b82f6' },
    resume:          { label: 'आपका अनुभव',            color: '#8b5cf6' },
    role_awareness:  { label: 'व्यावसायिक जागरूकता',   color: '#f59e0b' },
  },
  gujarati: {
    job_description: { label: 'ભૂમિકા અને જરૂરિયાતો', color: '#3b82f6' },
    resume:          { label: 'તમારો અનુભવ',            color: '#8b5cf6' },
    role_awareness:  { label: 'વ્યવસાયિક જ્ઞાન',        color: '#f59e0b' },
  },
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  job_description: <Briefcase size={14} />,
  resume:          <FileText size={14} />,
  role_awareness:  <Mic size={14} />,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PreScreeningPage() {
  const { token } = useParams<{ token: string }>()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [session, setSession] = useState<PublicSession | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answeredIndices, setAnsweredIndices] = useState<Set<number>>(new Set())
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState<ScreeningLanguage>('english')
  const [translatedQuestions, setTranslatedQuestions] = useState<ScreeningQuestion[]>([])
  const [langLoading, setLangLoading] = useState(false)

  // Load session on mount
  useEffect(() => {
    if (!token) {
      setErrorMsg('Invalid pre-screening link.')
      setPageState('error')
      return
    }

    preScreeningApi
      .takeSession(token)
      .then(res => {
        const s = res.data
        if (s.status === 'completed') {
          setSession(s)
          setPageState('completed')
          return
        }
        setSession(s)
        // Restore language + translated questions if previously set
        if (s.language && s.language !== 'english') {
          setSelectedLanguage(s.language)
          if (s.translated_questions?.length) {
            setTranslatedQuestions(s.translated_questions)
          }
        }
        // If already started, pre-fill answered count
        if (s.response_count > 0) {
          const answered = new Set(Array.from({ length: s.response_count }, (_, i) => i))
          setAnsweredIndices(answered)
          setCurrentIndex(s.response_count >= s.questions.length ? s.questions.length - 1 : s.response_count)
        }
        setPageState(s.status === 'in_progress' ? 'question' : 'intro')
      })
      .catch(err => {
        const msg = err?.response?.data?.detail || 'Could not load the pre-screening session.'
        setErrorMsg(msg)
        setPageState('error')
      })
  }, [token])

  // ── Language selection handler ──────────────────────────────────────────────
  const handleSelectLanguage = useCallback(async (lang: ScreeningLanguage) => {
    if (!session || lang === selectedLanguage) return
    setSelectedLanguage(lang)

    if (lang === 'english') {
      setTranslatedQuestions([])
      return
    }

    setLangLoading(true)
    try {
      const res = await preScreeningApi.updateLanguage(session.id, lang)
      setTranslatedQuestions(res.data.translated_questions)
    } catch {
      // Fall back to original English questions silently
      setTranslatedQuestions([])
    } finally {
      setLangLoading(false)
    }
  }, [session, selectedLanguage])

  // ── Active questions (translated if applicable) ─────────────────────────────
  const activeQuestions: ScreeningQuestion[] =
    selectedLanguage !== 'english' && translatedQuestions.length > 0
      ? translatedQuestions
      : (session?.questions ?? [])

  const ttsCode = LANGUAGE_TTS_CODE[selectedLanguage]
  const categoryLabels = CATEGORY_LABELS_I18N[selectedLanguage]

  const handleStart = useCallback(async () => {
    if (!session) return
    try {
      await preScreeningApi.updateStatus(session.id, 'in_progress')
    } catch {
      // best effort
    }
    setPageState('question')
  }, [session])

  const handleUpload = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      if (!session) throw new Error('No session')
      await preScreeningApi.uploadResponse(session.id, currentIndex, blob, durationSeconds)
      setAnsweredIndices(prev => new Set([...prev, currentIndex]))
    },
    [session, currentIndex],
  )

  const handleNext = useCallback(async () => {
    if (!session) return
    const nextIndex = currentIndex + 1
    if (nextIndex >= session.questions.length) {
      try {
        await preScreeningApi.updateStatus(session.id, 'completed')
      } catch {
        // best effort
      }
      setPageState('completed')
    } else {
      setCurrentIndex(nextIndex)
    }
  }, [session, currentIndex])

  // ── Render: loading ─────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div style={styles.fullPage}>
        <div style={styles.card}>
          <div style={styles.loadingPulse} />
          <div style={{ ...styles.loadingPulse, width: '60%' }} />
          <div style={{ ...styles.loadingPulse, height: '120px' }} />
        </div>
      </div>
    )
  }

  // ── Render: error ───────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div style={styles.fullPage}>
        <div style={styles.card}>
          <div style={styles.errorBox}>
            <AlertTriangle size={40} color="#ef4444" />
            <h2 style={styles.errorTitle}>Unable to Load Session</h2>
            <p style={styles.errorMsg}>{errorMsg}</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: completed ───────────────────────────────────────────────────────
  if (pageState === 'completed') {
    return (
      <div style={styles.fullPage}>
        <div style={styles.card}>
          <div style={styles.completedBox}>
            <div style={styles.completedIcon}>
              <CheckCircle size={56} color="#22c55e" />
            </div>
            <h1 style={styles.completedTitle}>Pre-Screening Complete!</h1>
            <p style={styles.completedSub}>
              Thank you, <strong>{session?.candidate_name}</strong>. Your responses have been recorded
              and will be reviewed by the hiring team.
            </p>
            {session?.job_title && (
              <div style={styles.jobBadge}>
                <Briefcase size={14} />
                {session.job_title}
              </div>
            )}
            <p style={styles.completedNote}>
              You will hear back regarding next steps. You may now close this tab.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: intro ───────────────────────────────────────────────────────────
  if (pageState === 'intro' && session) {
    return (
      <div style={styles.fullPage}>
        <div style={styles.card}>
          <div style={styles.introBrand}>
            <span style={styles.brandDot} />
            <span style={styles.brandName}>HireOn</span>
          </div>

          <h1 style={styles.introTitle}>AI Pre-Screening Interview</h1>
          <p style={styles.introSub}>
            Hi <strong>{session.candidate_name}</strong>! You've been invited to complete a short
            pre-screening for the{' '}
            <strong>{session.job_title || 'open position'}</strong> role.
          </p>

          {/* Language selector */}
          <div style={styles.langSection}>
            <p style={styles.langTitle}>Select Interview Language</p>
            <div style={styles.langGrid}>
              {LANGUAGE_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  style={{
                    ...styles.langBtn,
                    ...(selectedLanguage === opt.key ? styles.langBtnActive : {}),
                  }}
                  onClick={() => handleSelectLanguage(opt.key)}
                  disabled={langLoading}
                >
                  <span style={styles.langFlag}>{opt.flag}</span>
                  <span style={styles.langLabel}>{opt.label}</span>
                  <span style={styles.langNative}>{opt.nativeLabel}</span>
                  {selectedLanguage === opt.key && (
                    <span style={styles.langCheck}>✓</span>
                  )}
                </button>
              ))}
            </div>
            {langLoading && (
              <div style={styles.langLoadingRow}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--violet)' }} />
                <span style={styles.langLoadingText}>Translating questions…</span>
              </div>
            )}
          </div>

          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <div style={styles.infoIcon}><Mic size={18} /></div>
              <div>
                <div style={styles.infoLabel}>10 Questions</div>
                <div style={styles.infoDesc}>AI-personalised for this role</div>
              </div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoIcon}><Clock size={18} /></div>
              <div>
                <div style={styles.infoLabel}>15–20 minutes</div>
                <div style={styles.infoDesc}>Typical completion time</div>
              </div>
            </div>
          </div>

          <div style={styles.categoryBreakdown}>
            <p style={styles.breakdownTitle}>Question Breakdown</p>
            <div style={styles.categoryRow}>
              <span style={{ ...styles.catBadge, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                3 {categoryLabels.job_description.label}
              </span>
              <span style={{ ...styles.catBadge, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                3 {categoryLabels.resume.label}
              </span>
              <span style={{ ...styles.catBadge, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                4 {categoryLabels.role_awareness.label}
              </span>
            </div>
          </div>

          <div style={styles.tips}>
            <p style={styles.tipsTitle}>Tips for a great session</p>
            <ul style={styles.tipsList}>
              <li>Find a quiet place with stable internet connection</li>
              <li>The AI will read each question aloud — listen carefully</li>
              <li>Speak clearly and at a natural pace</li>
              <li>You have up to 3 minutes per question</li>
              <li>You may re-record an answer before submitting it</li>
              <li>Do not close the tab mid-session</li>
            </ul>
          </div>

          <button
            style={{ ...styles.startBtn, opacity: langLoading ? 0.6 : 1 }}
            onClick={handleStart}
            disabled={langLoading}
          >
            Start Pre-Screening
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    )
  }

  // ── Render: question ────────────────────────────────────────────────────────
  if (pageState === 'question' && session) {
    const question: ScreeningQuestion = activeQuestions[currentIndex] ?? session.questions[currentIndex]
    const catInfo = categoryLabels[question.category] ?? categoryLabels.role_awareness
    const isAnswered = answeredIndices.has(currentIndex)

    return (
      <div style={styles.fullPage}>
        <div style={styles.card}>
          {/* Header */}
          <div style={styles.qHeader}>
            <div style={styles.progressWrap}>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${((currentIndex + (isAnswered ? 1 : 0)) / session.questions.length) * 100}%`,
                  }}
                />
              </div>
              <span style={styles.progressLabel}>
                {currentIndex + 1} / {session.questions.length}
              </span>
            </div>
            <div style={styles.qHeaderMeta}>
              <div style={{ ...styles.catTag, color: catInfo.color, background: `${catInfo.color}18` }}>
                {CATEGORY_ICONS[question.category]}
                {catInfo.label}
              </div>
              {selectedLanguage !== 'english' && (
                <div style={styles.langIndicator}>
                  {LANGUAGE_OPTIONS.find(o => o.key === selectedLanguage)?.flag}{' '}
                  {LANGUAGE_OPTIONS.find(o => o.key === selectedLanguage)?.label}
                </div>
              )}
            </div>
          </div>

          {/* Question text */}
          <div style={styles.questionBox}>
            <span style={styles.qNum}>Question {currentIndex + 1}</span>
            <p style={styles.qText}>{question.text}</p>
          </div>

          {/* Recorder with TTS */}
          <div style={styles.answerSection}>
            <div style={styles.answerLabel}>
              <Mic size={13} />
              Your Answer
            </div>
            <AudioRecorder
              key={`${currentIndex}-${question.text}`}
              onUpload={handleUpload}
              disabled={false}
              maxDurationSeconds={180}
              questionText={question.text}
              languageCode={ttsCode}
            />
          </div>

          {/* Next button */}
          {isAnswered && (
            <button style={styles.nextBtn} onClick={handleNext}>
              {currentIndex + 1 < session.questions.length ? (
                <>Next Question <ChevronRight size={16} /></>
              ) : (
                <>Finish &amp; Submit <CheckCircle size={16} /></>
              )}
            </button>
          )}

          {/* Dot indicators */}
          <div style={styles.dotRow}>
            {session.questions.map((_, i) => (
              <div
                key={i}
                style={{
                  ...styles.dot,
                  background: answeredIndices.has(i)
                    ? '#22c55e'
                    : i === currentIndex
                    ? 'var(--violet, #6c47ff)'
                    : 'var(--card-border, #e8e6ff)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  fullPage: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0edff 0%, #fff5fb 100%)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '32px 16px',
  },
  card: {
    width: '100%',
    maxWidth: '620px',
    background: '#fff',
    borderRadius: '24px',
    boxShadow: '0 20px 60px rgba(108,71,255,0.10)',
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  loadingPulse: {
    width: '100%',
    height: '24px',
    borderRadius: '8px',
    background: '#f0edff',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'center',
    padding: '24px 0',
  },
  errorTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1a1040',
    margin: 0,
  },
  errorMsg: {
    color: '#6b7280',
    fontSize: '14px',
    margin: 0,
  },
  completedBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    textAlign: 'center',
    padding: '12px 0',
  },
  completedIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedTitle: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#1a1040',
    margin: 0,
  },
  completedSub: {
    color: '#374151',
    fontSize: '15px',
    lineHeight: 1.6,
    margin: 0,
  },
  jobBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '20px',
    background: 'rgba(108,71,255,0.08)',
    color: '#6c47ff',
    fontWeight: 600,
    fontSize: '13px',
  },
  completedNote: {
    color: '#9ca3af',
    fontSize: '13px',
    margin: 0,
  },
  introBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  brandDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)',
  },
  brandName: {
    fontWeight: 800,
    fontSize: '16px',
    color: '#1a1040',
  },
  introTitle: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#1a1040',
    margin: 0,
    lineHeight: 1.2,
  },
  introSub: {
    color: '#374151',
    fontSize: '15px',
    lineHeight: 1.6,
    margin: 0,
  },
  // Language selector
  langSection: {
    background: '#f7f5ff',
    borderRadius: '16px',
    padding: '18px',
    border: '1px solid #e8e6ff',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  langTitle: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#6b7280',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  langGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  langBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '14px 8px',
    borderRadius: '12px',
    border: '2px solid #e8e6ff',
    background: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
  } as React.CSSProperties,
  langBtnActive: {
    border: '2px solid #6c47ff',
    background: 'rgba(108,71,255,0.06)',
  } as React.CSSProperties,
  langFlag: {
    fontSize: '22px',
    lineHeight: 1,
  },
  langLabel: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#1a1040',
  },
  langNative: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  langCheck: {
    position: 'absolute',
    top: '6px',
    right: '8px',
    fontSize: '12px',
    color: '#6c47ff',
    fontWeight: 800,
  } as React.CSSProperties,
  langLoadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  langLoadingText: {
    fontSize: '13px',
    color: '#6c47ff',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  infoItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '14px',
    borderRadius: '12px',
    background: '#f7f5ff',
    border: '1px solid #e8e6ff',
  },
  infoIcon: {
    color: '#6c47ff',
    flexShrink: 0,
    marginTop: '2px',
  },
  infoLabel: {
    fontWeight: 700,
    fontSize: '14px',
    color: '#1a1040',
  },
  infoDesc: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '2px',
  },
  categoryBreakdown: {
    background: '#fafafa',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #f0edff',
  },
  breakdownTitle: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#6b7280',
    margin: '0 0 10px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  categoryRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  catBadge: {
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
  },
  tips: {
    background: '#fffbeb',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #fde68a',
  },
  tipsTitle: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#92400e',
    margin: '0 0 8px 0',
  },
  tipsList: {
    margin: 0,
    paddingLeft: '18px',
    color: '#78350f',
    fontSize: '13px',
    lineHeight: 1.8,
  },
  startBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px',
    borderRadius: '14px',
    border: 'none',
    background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '16px',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(108,71,255,0.25)',
    transition: 'opacity 0.2s',
  },
  qHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  progressBar: {
    flex: 1,
    height: '8px',
    borderRadius: '4px',
    background: '#f0edff',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #6c47ff, #ff6bc6)',
    transition: 'width 0.4s ease',
  },
  progressLabel: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#6c47ff',
    whiteSpace: 'nowrap',
  },
  qHeaderMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  catTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
  },
  langIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    borderRadius: '20px',
    background: 'rgba(108,71,255,0.08)',
    color: '#6c47ff',
    fontSize: '11px',
    fontWeight: 600,
  },
  questionBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '20px',
    background: '#f7f5ff',
    borderRadius: '16px',
    border: '1px solid #e8e6ff',
  },
  qNum: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },
  qText: {
    fontSize: '17px',
    fontWeight: 600,
    color: '#1a1040',
    lineHeight: 1.5,
    margin: 0,
  },
  nextBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '13px',
    borderRadius: '12px',
    border: 'none',
    background: '#1a1040',
    color: '#fff',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  dotRow: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    transition: 'background 0.3s',
  },
  answerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  answerLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
  },
}
