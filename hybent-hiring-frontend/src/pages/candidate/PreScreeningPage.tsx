/**
 * Pre-screening interview page — public, token-based (no login required).
 * The candidate answers 10 AI-generated questions via audio recording.
 * Supports English, Hindi, and Gujarati with TTS question playback.
 *
 * Rebuilt on the design system in phase 7. The page renders outside the app
 * shell (it has its own route, no sidebar), so it wraps itself in `.hb-app`
 * for the token background. What went: a 400-line `styles` object with the
 * old violet/pink wash and per-category colours — blue for "Role &
 * Requirements", violet for "Your Experience", amber for "Professional
 * Awareness", which put the product's warning colour on the most harmless
 * category of the three. The category is named in its badge.
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Briefcase,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Mic,
} from 'lucide-react'

import {
  preScreeningApi,
  type PublicSession,
  type ScreeningQuestion,
  type ScreeningLanguage,
} from '@/api/preScreening'
import { AudioRecorder } from '@/modules/interviewer/components/PreScreening/AudioRecorder'
import { Badge, Button, Card, Meter, Skeleton } from '@/components/hb'

type PageState = 'loading' | 'intro' | 'question' | 'completed' | 'error'

// ── Language configuration ────────────────────────────────────────────────────

const LANGUAGE_OPTIONS: {
  key: ScreeningLanguage
  label: string
  nativeLabel: string
  flag: string
}[] = [
  { key: 'english', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { key: 'hindi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { key: 'gujarati', label: 'Gujarati', nativeLabel: 'ગુજરાતી', flag: '🇮🇳' },
]

const LANGUAGE_TTS_CODE: Record<ScreeningLanguage, string> = {
  english: 'en-IN',
  hindi: 'hi-IN',
  gujarati: 'gu-IN',
}

const CATEGORY_LABELS_I18N: Record<ScreeningLanguage, Record<string, string>> = {
  english: {
    job_description: 'Role & requirements',
    resume: 'Your experience',
    role_awareness: 'Professional awareness',
  },
  hindi: {
    job_description: 'भूमिका और आवश्यकताएं',
    resume: 'आपका अनुभव',
    role_awareness: 'व्यावसायिक जागरूकता',
  },
  gujarati: {
    job_description: 'ભૂમિકા અને જરૂરિયાતો',
    resume: 'તમારો અનુભવ',
    role_awareness: 'વ્યવસાયિક જ્ઞાન',
  },
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  job_description: <Briefcase size={13} />,
  resume: <FileText size={13} />,
  role_awareness: <Mic size={13} />,
}

/** Full-viewport centring: this page has no app shell around it. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hb-app flex min-h-screen items-start justify-center px-4 py-8">
      <Card padding="loose" className="w-full max-w-[640px]">
        {children}
      </Card>
    </div>
  )
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
      .then((res) => {
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
          setCurrentIndex(
            s.response_count >= s.questions.length ? s.questions.length - 1 : s.response_count
          )
        }
        setPageState(s.status === 'in_progress' ? 'question' : 'intro')
      })
      .catch((err) => {
        setErrorMsg(err?.response?.data?.detail || 'Could not load the pre-screening session.')
        setPageState('error')
      })
  }, [token])

  // ── Language selection ──────────────────────────────────────────────────────
  const handleSelectLanguage = useCallback(
    async (lang: ScreeningLanguage) => {
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
    },
    [session, selectedLanguage]
  )

  // Active questions (translated if applicable)
  const activeQuestions: ScreeningQuestion[] =
    selectedLanguage !== 'english' && translatedQuestions.length > 0
      ? translatedQuestions
      : session?.questions ?? []

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
      setAnsweredIndices((prev) => new Set([...prev, currentIndex]))
    },
    [session, currentIndex]
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
      <Shell>
        <div className="space-y-hb-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-32 w-full" rounded="md" />
        </div>
      </Shell>
    )
  }

  // ── Render: error ───────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <Shell>
        <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center">
          <AlertTriangle size={38} aria-hidden className="text-hb-error" />
          <h1 className="font-display text-hb-h2 text-hb-text">Unable to load session</h1>
          <p className="text-hb-sm text-hb-muted">{errorMsg}</p>
        </div>
      </Shell>
    )
  }

  // ── Render: completed ───────────────────────────────────────────────────────
  if (pageState === 'completed') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full border border-hb-success/25 bg-hb-success/10 text-hb-success">
            <CheckCircle size={44} aria-hidden />
          </span>
          <h1 className="font-display text-hb-h1 text-hb-text">Pre-screening complete!</h1>
          <p className="max-w-[44ch] text-hb-sm text-hb-muted">
            Thank you, <strong className="text-hb-text">{session?.candidate_name}</strong>. Your
            responses have been recorded and will be reviewed by the hiring team.
          </p>
          {session?.job_title && (
            <Badge tone="brand">
              <Briefcase size={12} aria-hidden /> {session.job_title}
            </Badge>
          )}
          <p className="text-hb-xs text-hb-dim">
            You will hear back regarding next steps. You may now close this tab.
          </p>
        </div>
      </Shell>
    )
  }

  // ── Render: intro ───────────────────────────────────────────────────────────
  if (pageState === 'intro' && session) {
    return (
      <Shell>
        <div className="space-y-hb-5">
          <div>
            <p className="mb-2 flex items-center gap-2 font-mono text-hb-eyebrow uppercase text-hb-muted">
              <span aria-hidden className="h-2 w-2 rounded-full bg-hb-grad" />
              Hybent Hiring
            </p>
            <h1 className="font-display text-hb-h1 text-hb-text">AI pre-screening interview</h1>
            <p className="mt-2 text-hb-sm leading-relaxed text-hb-muted">
              Hi <strong className="text-hb-text">{session.candidate_name}</strong>! You've been
              invited to complete a short pre-screening for the{' '}
              <strong className="text-hb-text">{session.job_title || 'open position'}</strong>{' '}
              role.
            </p>
          </div>

          {/* Language selector */}
          <fieldset>
            <legend className="mb-2.5 font-mono text-hb-label uppercase text-hb-dim">
              Select interview language
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGE_OPTIONS.map((opt) => {
                const active = selectedLanguage === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={langLoading}
                    onClick={() => handleSelectLanguage(opt.key)}
                    className={`flex flex-col items-center gap-0.5 rounded-hb-md border px-3 py-3 transition-all duration-hb ease-hb focus-visible:outline-none focus-visible:shadow-hb-ring disabled:opacity-60 ${
                      active
                        ? 'border-hb-blue/45 bg-hb-blue/8'
                        : 'border-hb-border hover:border-hb-border-strong'
                    }`}
                  >
                    <span aria-hidden className="text-lg leading-none">{opt.flag}</span>
                    <span className="text-hb-sm font-semibold text-hb-text">{opt.label}</span>
                    <span className="text-hb-xs text-hb-muted">{opt.nativeLabel}</span>
                  </button>
                )
              })}
            </div>
            {langLoading && (
              <p role="status" className="mt-2.5 flex items-center gap-2 text-hb-xs text-hb-muted">
                <Loader2 size={13} aria-hidden className="animate-spin text-hb-cyan" />
                Translating questions…
              </p>
            )}
          </fieldset>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {[
              { icon: <Mic size={17} />, label: '10 questions', desc: 'AI-personalised for this role' },
              { icon: <Clock size={17} />, label: '15–20 minutes', desc: 'Typical completion time' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-hb-md border border-hb-border bg-hb-surface-2 p-3.5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-hb-sm border border-hb-border bg-hb-surface text-hb-cyan">
                  {item.icon}
                </span>
                <div>
                  <p className="text-hb-sm font-semibold text-hb-text">{item.label}</p>
                  <p className="text-hb-xs text-hb-muted">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-2 font-mono text-hb-label uppercase text-hb-dim">
              Question breakdown
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge>3 · {categoryLabels.job_description}</Badge>
              <Badge>3 · {categoryLabels.resume}</Badge>
              <Badge>4 · {categoryLabels.role_awareness}</Badge>
            </div>
          </div>

          <div className="rounded-hb-md border border-hb-border bg-hb-surface-2 p-4">
            <p className="mb-2 font-mono text-hb-label uppercase text-hb-dim">
              Tips for a great session
            </p>
            <ul className="list-disc space-y-1 pl-4 text-hb-sm text-hb-muted">
              <li>Find a quiet place with a stable internet connection</li>
              <li>The AI will read each question aloud — listen carefully</li>
              <li>Speak clearly and at a natural pace</li>
              <li>You have up to 3 minutes per question</li>
              <li>You may re-record an answer before submitting it</li>
              <li>Do not close the tab mid-session</li>
            </ul>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleStart}
            disabled={langLoading}
            icon={<ChevronRight size={17} />}
          >
            Start pre-screening
          </Button>
        </div>
      </Shell>
    )
  }

  // ── Render: question ────────────────────────────────────────────────────────
  if (pageState === 'question' && session) {
    const question: ScreeningQuestion =
      activeQuestions[currentIndex] ?? session.questions[currentIndex]
    const categoryLabel = categoryLabels[question.category] ?? categoryLabels.role_awareness
    const isAnswered = answeredIndices.has(currentIndex)
    const activeLang = LANGUAGE_OPTIONS.find((o) => o.key === selectedLanguage)

    return (
      <Shell>
        <div className="space-y-hb-5">
          {/* Header */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <Meter
                value={currentIndex + (isAnswered ? 1 : 0)}
                max={session.questions.length}
                size="sm"
                aria-label="Interview progress"
                className="flex-1"
              />
              <span className="shrink-0 font-mono text-hb-xs tabular-nums text-hb-muted">
                {currentIndex + 1} / {session.questions.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="brand">
                {CATEGORY_ICONS[question.category]}
                {categoryLabel}
              </Badge>
              {selectedLanguage !== 'english' && activeLang && (
                <Badge>
                  {activeLang.flag} {activeLang.label}
                </Badge>
              )}
            </div>
          </div>

          {/* Question text */}
          <div className="rounded-hb-md border border-hb-border bg-hb-surface-2 p-5">
            <p className="font-mono text-hb-label uppercase text-hb-dim">
              Question {currentIndex + 1}
            </p>
            <p className="mt-2 text-hb-lead font-semibold leading-relaxed text-hb-text">
              {question.text}
            </p>
          </div>

          {/* Recorder with TTS */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 font-mono text-hb-label uppercase text-hb-dim">
              <Mic size={12} aria-hidden />
              Your answer
            </p>
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
            <Button
              size="lg"
              className="w-full"
              onClick={handleNext}
              icon={
                currentIndex + 1 < session.questions.length ? (
                  <ChevronRight size={16} />
                ) : (
                  <CheckCircle size={16} />
                )
              }
            >
              {currentIndex + 1 < session.questions.length ? 'Next question' : 'Finish & submit'}
            </Button>
          )}

          {/* Dot indicators */}
          <div
            className="flex flex-wrap items-center justify-center gap-1.5"
            aria-label={`${answeredIndices.size} of ${session.questions.length} questions answered`}
          >
            {session.questions.map((_, i) => (
              <span
                key={i}
                aria-hidden
                className={`h-2 w-2 rounded-full ${
                  answeredIndices.has(i)
                    ? 'bg-hb-success'
                    : i === currentIndex
                      ? 'bg-hb-blue'
                      : 'bg-hb-border'
                }`}
              />
            ))}
          </div>
        </div>
      </Shell>
    )
  }

  return null
}
