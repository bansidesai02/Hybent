/**
 * The read-only view of one pre-screening session: the AI summary, and every
 * question with its recorded answer.
 *
 * Shared by the recruiter's `PreScreeningReviewPage` and the `PreScreenTab` on
 * a candidate profile — which is why it lives in a component file rather than
 * on either page.
 *
 * Rebuilt on the design system in phase 8. What went, beyond the two 140-line
 * `styles` objects:
 *
 * - `CATEGORY_CFG` gave each of the three question categories its own hex, so
 *   "Role & Requirements" was blue, "Your Experience" violet and
 *   "Professional Awareness" amber. Blue and amber are the product's info and
 *   warning colours; using them to distinguish three neutral categories meant
 *   an amber pill that warned about nothing. The category is named in the pill.
 * - `STATUS_CFG` was exported and never read, here or anywhere else.
 * - The audio scrubber was a `<div onClick>`: no tab stop, no keyboard seek, no
 *   announced value. It is now a real slider.
 * - Strengths were `#166534` and concerns `#991b1b` — two greens and two reds
 *   away from the tokens every other verdict in the product uses.
 */
import { useState, useEffect, useRef } from 'react'
import {
  Mic,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Star,
  Play,
  Pause,
} from 'lucide-react'

import { preScreeningApi, type PreScreeningSession, type AISummary } from '@/api/preScreening'
import { Badge, type BadgeTone, Button, Card, CardHeader, Meter } from '@/components/hb'

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  job_description: 'Role & requirements',
  resume: 'Your experience',
  role_awareness: 'Professional awareness',
}

const RECOMMENDATION_CFG: Record<
  string,
  { label: string; tone: BadgeTone; icon: React.ReactNode }
> = {
  proceed: { label: 'Proceed to interview', tone: 'success', icon: <CheckCircle size={16} /> },
  hold: { label: 'Hold / review', tone: 'warning', icon: <Clock size={16} /> },
  reject: { label: 'Not suitable', tone: 'error', icon: <AlertTriangle size={16} /> },
}

const BANNER_TONE: Record<BadgeTone, string> = {
  neutral: 'border-hb-border bg-hb-surface-2 text-hb-text',
  success: 'border-hb-success/25 bg-hb-success/8 text-hb-success',
  warning: 'border-hb-warning/25 bg-hb-warning/8 text-hb-warning',
  error: 'border-hb-error/25 bg-hb-error/8 text-hb-error',
  info: 'border-hb-cyan/25 bg-hb-cyan/8 text-hb-cyan',
  brand: 'border-hb-blue/25 bg-hb-blue/8 text-hb-blue',
}

// ── ScoreStars ────────────────────────────────────────────────────────────────

export function ScoreStars({ score, label }: { score: number; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${label}: ${score} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          aria-hidden
          className={s <= score ? 'fill-hb-warning text-hb-warning' : 'text-hb-dim opacity-35'}
        />
      ))}
    </span>
  )
}

// ── ResponseCard ──────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function ResponseCard({
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
  const category = CATEGORY_LABEL[question.category] ?? CATEGORY_LABEL.role_awareness

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

  const seekTo = (seconds: number) => {
    const audio = audioRef.current
    if (!audio || !totalSeconds) return
    const clamped = Math.max(0, Math.min(totalSeconds, seconds))
    audio.currentTime = clamped
    setPlaybackTime(clamped)
  }

  return (
    <Card padding="compact" className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-hb-label uppercase text-hb-dim">Q{index + 1}</span>
          <Badge>{category}</Badge>
        </div>
        {totalSeconds > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-hb-xs tabular-nums text-hb-muted">
            <Clock size={12} aria-hidden />
            {Math.round(totalSeconds)}s
          </span>
        )}
      </div>

      <p className="text-hb-sm font-semibold leading-relaxed text-hb-text">{question.text}</p>

      {response ? (
        <div className="space-y-2">
          {audioUrl && (
            <div className="flex items-center gap-2.5 rounded-hb-md border border-hb-border bg-hb-surface-2 px-3 py-2">
              <audio
                ref={audioRef}
                src={audioUrl}
                preload="none"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => { setIsPlaying(false); setPlaybackTime(0); if (audioRef.current) audioRef.current.currentTime = 0 }}
                onTimeUpdate={() => { if (audioRef.current) setPlaybackTime(audioRef.current.currentTime) }}
              />
              <button
                type="button"
                onClick={handlePlayPause}
                aria-label={isPlaying ? `Pause answer to question ${index + 1}` : `Play answer to question ${index + 1}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hb-grad text-white transition-transform duration-hb hover:scale-105 focus-visible:outline-none focus-visible:shadow-hb-ring"
              >
                {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
              </button>

              <div className="min-w-0 flex-1 space-y-1">
                {/* A real slider: tab-reachable, arrow-seekable, and announced
                    with its position. The visible bar is the `Meter` every
                    other proportion in the product uses; the input sits on top
                    of it, transparent, and carries the semantics. */}
                <div className="relative">
                  <Meter
                    value={playbackTime}
                    max={Math.max(totalSeconds, 1)}
                    size="xs"
                    aria-label={`Answer ${index + 1} playback position`}
                  />
                  <input
                    type="range"
                    min={0}
                    max={Math.max(totalSeconds, 1)}
                    step={0.1}
                    value={playbackTime}
                    onChange={(e) => seekTo(Number(e.target.value))}
                    aria-label={`Seek answer to question ${index + 1}`}
                    aria-valuetext={`${formatTime(playbackTime)} of ${formatTime(totalSeconds)}`}
                    className="absolute inset-x-0 -inset-y-2 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-hb-blue [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-hb-blue"
                  />
                </div>
                <p className="font-mono text-hb-xs tabular-nums text-hb-muted">
                  <span className="text-hb-text">{formatTime(playbackTime)}</span>
                  {' / '}
                  {formatTime(totalSeconds)}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setTranscriptOpen(o => !o)}
            aria-expanded={transcriptOpen}
            className="inline-flex items-center gap-1.5 rounded-hb-xs text-hb-xs font-semibold text-hb-cyan transition-colors duration-hb hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring"
          >
            <FileText size={13} aria-hidden />
            {transcriptOpen ? 'Hide transcript' : 'Show transcript'}
            {transcriptOpen ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
          </button>

          {transcriptOpen && (
            <div className="rounded-hb-md border border-hb-border bg-hb-surface-2 px-3.5 py-3">
              {response.transcript ? (
                <p className="text-hb-sm leading-relaxed text-hb-text">{response.transcript}</p>
              ) : (
                <p className="text-hb-sm italic text-hb-muted">
                  Transcript is still being processed…
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-hb-sm italic text-hb-dim">
          <Mic size={14} aria-hidden />
          No response recorded
        </p>
      )}
    </Card>
  )
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
  const rec = parsedSummary?.recommendation
    ? RECOMMENDATION_CFG[parsedSummary.recommendation]
    : undefined

  return (
    <div className="space-y-hb-6">
      {/* ── AI summary ──────────────────────────────────────────────────── */}
      <section className="space-y-hb-3">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles size={16} aria-hidden className="text-hb-cyan" />
              AI summary
            </span>
          }
          action={
            <>
              {parsedSummary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSummaryExpanded(o => !o)}
                  aria-expanded={summaryExpanded}
                  icon={summaryExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                >
                  {summaryExpanded ? 'Collapse' : 'Expand'}
                </Button>
              )}
              {session.status === 'completed' && onSummarise && (
                <Button
                  size="sm"
                  icon={<Sparkles size={14} />}
                  onClick={onSummarise}
                  loading={summarising}
                >
                  {parsedSummary ? 'Regenerate' : 'Generate AI summary'}
                </Button>
              )}
            </>
          }
        />

        {parsedSummary && summaryExpanded ? (
          <Card padding="default" className="space-y-hb-4">
            {rec && (
              <p
                className={`flex flex-wrap items-center gap-2 rounded-hb-md border px-4 py-2.5 text-hb-sm ${BANNER_TONE[rec.tone]}`}
              >
                <span aria-hidden className="shrink-0">{rec.icon}</span>
                <span className="font-semibold">{rec.label}</span>
                {parsedSummary.recommendation_reason && (
                  <span className="text-hb-muted">— {parsedSummary.recommendation_reason}</span>
                )}
              </p>
            )}

            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                { label: 'Communication', score: parsedSummary.communication_score },
                { label: 'Technical', score: parsedSummary.technical_score },
                { label: 'Culture fit', score: parsedSummary.culture_fit_score },
              ].map(({ label, score }) => (
                <div
                  key={label}
                  className="space-y-1.5 rounded-hb-md border border-hb-border bg-hb-surface-2 p-3"
                >
                  <p className="font-mono text-hb-label uppercase text-hb-dim">{label}</p>
                  <ScoreStars score={score} label={label} />
                </div>
              ))}
            </div>

            {parsedSummary.overall_impression && (
              <p className="rounded-hb-md border border-hb-border bg-hb-surface-2 p-3.5 text-hb-sm leading-relaxed text-hb-text">
                {parsedSummary.overall_impression}
              </p>
            )}

            <div className="grid gap-hb-4 sm:grid-cols-2">
              {parsedSummary.key_strengths?.length > 0 && (
                <div>
                  <p className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">
                    Key strengths
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-hb-sm text-hb-success">
                    {parsedSummary.key_strengths.map((s, i) => (
                      <li key={i}>
                        <span className="text-hb-text">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {parsedSummary.concerns?.length > 0 && (
                <div>
                  <p className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">Concerns</p>
                  <ul className="list-disc space-y-1 pl-4 text-hb-sm text-hb-error">
                    {parsedSummary.concerns.map((c, i) => (
                      <li key={i}>
                        <span className="text-hb-text">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        ) : !parsedSummary ? (
          <div className="rounded-hb-md border border-dashed border-hb-border bg-hb-surface-2 p-5 text-center text-hb-sm text-hb-muted">
            {session.status !== 'completed'
              ? 'Summary will be available once the candidate completes the pre-screening.'
              : 'Generate the AI summary to analyse the candidate’s responses.'}
          </div>
        ) : null}
      </section>

      {/* ── Responses ───────────────────────────────────────────────────── */}
      <section className="space-y-hb-3">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Mic size={16} aria-hidden className="text-hb-cyan" />
              Responses
            </span>
          }
          action={
            <Badge>
              {session.responses.length} of {session.questions.length} answered
            </Badge>
          }
        />

        <div className="space-y-hb-3">
          {session.questions.map((q, i) => (
            <ResponseCard
              key={q.id}
              question={q}
              response={responseMap.get(i) as any}
              index={i}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
