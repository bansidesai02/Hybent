import { useRef, useState, useEffect, type CSSProperties } from 'react'
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react'

import { Badge, Button, Meter } from '@/components/hb'

/**
 * Record one spoken answer: read the question aloud, count in, capture, review,
 * submit.
 *
 * Rebuilt on the design system in phase 8. The recorder logic below is
 * unchanged; what went was a 320-line `styles` object that hardcoded the old
 * violet/pink palette in seventeen places and painted the three verdict
 * colours (#ef4444 stop, #22c55e submit, #ffd54f notice) as raw hexes.
 *
 * Three defects fixed on the way through:
 *
 * - The unmount cleanup revoked `audioBlobUrl` from an effect with an empty
 *   dependency array, so it always read the initial `null` and never revoked
 *   anything. Every recording leaked its blob until the tab closed. The URL now
 *   lives in a ref that the cleanup can actually see.
 * - `startCountdown` was wrapped in `useCallback([])` and is not passed to a
 *   memoised child, so the only thing the empty dependency list bought was a
 *   stale closure over `maxDurationSeconds`. Unwrapped.
 * - The stop button animated `micPulse`, a keyframe that is not defined
 *   anywhere in the app. It has been inert since it was written.
 */

export type RecorderState =
  | 'speaking'
  | 'idle'
  | 'countdown'
  | 'recording'
  | 'stopped'
  | 'uploading'
  | 'done'
  | 'error'

interface AudioRecorderProps {
  onUpload: (blob: Blob, durationSeconds: number) => Promise<void>
  disabled?: boolean
  maxDurationSeconds?: number
  questionText?: string
  languageCode?: string
}

const BAR_COUNT = 24
const FLOOR_HEIGHT = 4

/**
 * Returns the best available SpeechSynthesis voice for a BCP-47 langCode.
 * Prefers female voices (name contains "female", case-insensitive).
 * Priority: exact+female → prefix+female → exact (any) → prefix (any) → null.
 * Waits up to ~300 ms for voices to load if the list is empty on first call.
 */
async function getBestVoice(langCode: string): Promise<SpeechSynthesisVoice | null> {
  let voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) {
    // Voices may load asynchronously — wait for the voiceschanged event once
    await new Promise<void>(resolve => {
      const onChanged = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', onChanged)
        resolve()
      }
      window.speechSynthesis.addEventListener('voiceschanged', onChanged)
      // Safety timeout so we don't hang forever
      setTimeout(resolve, 300)
    })
    voices = window.speechSynthesis.getVoices()
  }

  if (voices.length === 0) return null

  const isFemale = (v: SpeechSynthesisVoice) => /female/i.test(v.name)
  const prefix = langCode.split('-')[0]

  return (
    voices.find(v => v.lang === langCode && isFemale(v)) ??
    voices.find(v => v.lang.startsWith(prefix) && isFemale(v)) ??
    voices.find(v => v.lang === langCode) ??
    voices.find(v => v.lang.startsWith(prefix)) ??
    null
  )
}

async function speakQuestion(
  text: string,
  langCode: string,
  onEnd: () => void,
  onVoiceUnavailable?: () => void,
): Promise<{ utterance: SpeechSynthesisUtterance; keepAlive: ReturnType<typeof setInterval> } | null> {
  if (!('speechSynthesis' in window)) {
    onEnd()
    return null
  }

  const voice = await getBestVoice(langCode)
  if (!voice) {
    // No matching TTS voice on this device — skip playback gracefully
    onVoiceUnavailable?.()
    onEnd()
    return null
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = 1.0

  // Chrome silently pauses speechSynthesis after ~15 s — resume it periodically.
  const keepAlive = setInterval(() => {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume()
  }, 10_000)

  utterance.onend = () => { clearInterval(keepAlive); onEnd() }
  utterance.onerror = () => { clearInterval(keepAlive); onEnd() }

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return { utterance, keepAlive }
}

/**
 * Live amplitude drives height and opacity, so this is geometry from data, not
 * appearance — the one thing a class cannot express.
 *
 * The bar is 4px wide, which is too narrow to show a gradient of its own. So
 * every bar paints the *same* `--hb-grad` blown up to the full width of the
 * row (`bg-[length:2400%_100%]`, 24 bars × 100%) and slides it to its own
 * position. The waveform then reads as one cyan→blue→violet sweep rather than
 * twenty-four identical cyan sticks.
 */
function barStyle(height: number, index: number): CSSProperties {
  return {
    height: `${height}px`,
    opacity: 0.7 + (height / 40) * 0.3,
    backgroundPositionX: `${(index / (BAR_COUNT - 1)) * 100}%`,
  }
}

export function AudioRecorder({
  onUpload,
  disabled = false,
  maxDurationSeconds = 180,
  questionText,
  languageCode = 'en-IN',
}: AudioRecorderProps) {
  const [recorderState, setRecorderState] = useState<RecorderState>(questionText ? 'speaking' : 'idle')
  const [countdown, setCountdown] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [canReRecord, setCanReRecord] = useState(false)
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(BAR_COUNT).fill(FLOOR_HEIGHT))
  const [ttsSpeaking, setTtsSpeaking] = useState(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [ttsUnavailable, setTtsUnavailable] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ttsKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  /* The unmount cleanup cannot read `audioBlobUrl` — it would capture the
     initial null. This ref is what it revokes. */
  const blobUrlRef = useRef<string | null>(null)

  // Auto-speak question when component mounts or question changes
  useEffect(() => {
    if (!questionText) {
      setRecorderState('idle')
      return
    }
    setRecorderState('speaking')
    setTtsSpeaking(true)
    setTtsUnavailable(false)
    speakQuestion(
      questionText,
      languageCode,
      () => { setTtsSpeaking(false); setRecorderState('idle') },
      () => setTtsUnavailable(true),
    ).then(result => { ttsKeepAliveRef.current = result?.keepAlive ?? null })

    return () => {
      window.speechSynthesis?.cancel()
      if (ttsKeepAliveRef.current) { clearInterval(ttsKeepAliveRef.current); ttsKeepAliveRef.current = null }
    }
  }, [questionText, languageCode])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
      if (ttsKeepAliveRef.current) clearInterval(ttsKeepAliveRef.current)
      stopStream()
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const startWaveform = (stream: MediaStream) => {
    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)
      analyserRef.current = analyser

      const draw = () => {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
          const val = data[Math.floor((i / BAR_COUNT) * data.length)] || 0
          return Math.max(FLOOR_HEIGHT, (val / 255) * 40)
        })
        setWaveHeights(bars)
        animFrameRef.current = requestAnimationFrame(draw)
      }
      draw()
    } catch {
      // Waveform is visual-only; ignore errors
    }
  }

  const stopWaveform = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    setWaveHeights(Array(BAR_COUNT).fill(FLOOR_HEIGHT))
  }

  const handleReplayQuestion = () => {
    if (!questionText) return
    setTtsSpeaking(true)
    setTtsUnavailable(false)
    speakQuestion(
      questionText,
      languageCode,
      () => setTtsSpeaking(false),
      () => setTtsUnavailable(true),
    ).then(result => { ttsKeepAliveRef.current = result?.keepAlive ?? null })
  }

  const handleStopTTS = () => {
    window.speechSynthesis?.cancel()
    if (ttsKeepAliveRef.current) { clearInterval(ttsKeepAliveRef.current); ttsKeepAliveRef.current = null }
    setTtsSpeaking(false)
    setRecorderState('idle')
  }

  const handlePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setPlaybackTime(Math.floor(audioRef.current.currentTime))
    }
  }

  const handleAudioEnded = () => {
    setIsPlaying(false)
    setPlaybackTime(0)
    if (audioRef.current) audioRef.current.currentTime = 0
  }

  const startCountdown = () => {
    window.speechSynthesis?.cancel()
    setTtsSpeaking(false)
    setRecorderState('countdown')
    setCountdown(3)
    let count = 3
    countdownTimerRef.current = setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count <= 0) {
        clearInterval(countdownTimerRef.current!)
        startRecording()
      }
    }, 1000)
  }

  const startRecording = async () => {
    setErrorMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      startWaveform(stream)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setAudioBlobUrl(url)
        setRecorderState('stopped')
        stopWaveform()
        stopStream()
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
        setCanReRecord(true)
      }

      recorder.start(250)
      startTimeRef.current = Date.now()
      setElapsed(0)
      setRecorderState('recording')

      // Elapsed timer
      elapsedTimerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setElapsed(secs)
        if (secs >= maxDurationSeconds) {
          stopRecording()
        }
      }, 500)
    } catch {
      setErrorMsg('Microphone access denied. Please allow microphone access and try again.')
      setRecorderState('error')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
  }

  const handleReRecord = () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    blobUrlRef.current = null
    setAudioBlobUrl(null)
    blobRef.current = null
    setElapsed(0)
    setCanReRecord(false)
    setIsPlaying(false)
    setPlaybackTime(0)
    setTtsUnavailable(false)
    setRecorderState('idle')
  }

  const handleSubmit = async () => {
    if (!blobRef.current) return
    setRecorderState('uploading')
    try {
      await onUpload(blobRef.current, elapsed)
      setRecorderState('done')
    } catch {
      setErrorMsg('Upload failed. Please try again.')
      setRecorderState('error')
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const replayButton = questionText ? (
    <Button
      variant="ghost"
      size="sm"
      icon={<Volume2 size={15} />}
      onClick={handleReplayQuestion}
      disabled={ttsSpeaking}
      title="Replay question aloud"
    >
      {ttsSpeaking ? 'Playing…' : 'Replay question'}
    </Button>
  ) : null

  return (
    <div className="flex flex-col gap-hb-4 rounded-hb-lg border border-hb-border bg-hb-surface-2 p-5">
      {/* ── Stage ─────────────────────────────────────────────────────────── */}
      <div className="flex min-h-[72px] items-center justify-center">
        {recorderState === 'speaking' ? (
          <div className="flex w-full items-center gap-hb-4">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-hb-blue/25" />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-hb-grad text-white">
                <Volume2 size={26} aria-hidden />
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-hb-body font-semibold text-hb-text">
                AI is reading the question…
              </p>
              <p className="text-hb-xs text-hb-muted">
                Listen carefully, then record your answer.
              </p>
            </div>
          </div>
        ) : recorderState === 'countdown' ? (
          <div
            role="status"
            aria-live="assertive"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-hb-grad font-display text-hb-h2 text-white"
          >
            {countdown}
          </div>
        ) : recorderState === 'recording' ? (
          <div aria-hidden className="flex h-12 items-center gap-[3px]">
            {waveHeights.map((h, i) => (
              <div
                key={i}
                style={barStyle(h, i)}
                className="w-1 rounded-full bg-hb-grad bg-[length:2400%_100%] transition-[height] duration-100"
              />
            ))}
          </div>
        ) : recorderState === 'stopped' || recorderState === 'done' ? (
          <div className="w-full space-y-2">
            {audioBlobUrl && (
              <audio
                ref={audioRef}
                src={audioBlobUrl}
                onTimeUpdate={handleAudioTimeUpdate}
                onEnded={handleAudioEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            )}
            <p className="font-mono text-hb-label uppercase text-hb-dim">Your recording</p>
            <div className="flex items-center gap-3 rounded-hb-md border border-hb-border bg-hb-surface px-3.5 py-2.5">
              <button
                type="button"
                onClick={handlePlayPause}
                aria-label={isPlaying ? 'Pause playback' : 'Play recording'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hb-grad text-white transition-transform duration-hb hover:scale-105 focus-visible:outline-none focus-visible:shadow-hb-ring"
              >
                {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <Meter
                  value={playbackTime}
                  max={Math.max(elapsed, 1)}
                  size="xs"
                  aria-label="Playback position"
                />
                <p className="font-mono text-hb-xs tabular-nums text-hb-muted">
                  <span className="text-hb-text">{formatTime(playbackTime)}</span>
                  {' / '}
                  {formatTime(elapsed)}
                </p>
              </div>
            </div>
          </div>
        ) : recorderState === 'uploading' ? (
          <p role="status" className="flex items-center gap-2.5 text-hb-body text-hb-muted">
            <Loader2 size={22} aria-hidden className="animate-spin text-hb-cyan" />
            Uploading response…
          </p>
        ) : recorderState === 'error' ? (
          <p role="alert" className="flex items-center gap-2.5 text-hb-sm text-hb-error">
            <AlertCircle size={20} aria-hidden className="shrink-0" />
            {errorMsg}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-2 text-hb-dim">
            <Mic size={30} aria-hidden />
            <p className="text-hb-sm text-hb-muted">Press record to begin.</p>
          </div>
        )}
      </div>

      {/* ── Notices ───────────────────────────────────────────────────────── */}
      {ttsUnavailable && (
        <p className="flex items-start gap-2 rounded-hb-md border border-hb-warning/25 bg-hb-warning/8 px-3.5 py-2 text-hb-xs text-hb-text">
          <VolumeX size={14} aria-hidden className="mt-0.5 shrink-0 text-hb-warning" />
          Voice audio is not available for this language on your device — please read the question
          above.
        </p>
      )}

      {recorderState === 'recording' && (
        <div className="flex items-center gap-3">
          <Meter
            value={elapsed}
            max={maxDurationSeconds}
            size="sm"
            aria-label="Recording time used"
            className="flex-1"
          />
          <span className="min-w-[74px] shrink-0 text-right font-mono text-hb-xs tabular-nums text-hb-muted">
            {formatTime(elapsed)} / {formatTime(maxDurationSeconds)}
          </span>
        </div>
      )}

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {recorderState === 'speaking' && (
          <Button variant="ghost" size="sm" icon={<VolumeX size={15} />} onClick={handleStopTTS}>
            Skip audio
          </Button>
        )}

        {(recorderState === 'idle' || recorderState === 'error') && (
          <>
            {replayButton}
            <Button
              icon={<Mic size={17} />}
              onClick={startCountdown}
              disabled={disabled || ttsSpeaking}
            >
              Record answer
            </Button>
          </>
        )}

        {recorderState === 'countdown' && (
          <Button icon={<Mic size={17} />} disabled>
            Starting in {countdown}…
          </Button>
        )}

        {recorderState === 'recording' && (
          <Button variant="danger" icon={<Square size={15} fill="currentColor" />} onClick={stopRecording}>
            Stop recording
          </Button>
        )}

        {recorderState === 'stopped' && (
          <>
            {replayButton}
            {canReRecord && (
              <Button variant="ghost" size="sm" icon={<RotateCcw size={15} />} onClick={handleReRecord}>
                Re-record
              </Button>
            )}
            <Button icon={<CheckCircle size={16} />} onClick={handleSubmit}>
              Submit answer
            </Button>
          </>
        )}

        {recorderState === 'done' && (
          <Badge tone="success" dot>
            Answer submitted
          </Badge>
        )}
      </div>
    </div>
  )
}
