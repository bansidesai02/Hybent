import { useRef, useState, useEffect, useCallback } from 'react'
import { Mic, Square, RotateCcw, CheckCircle, Loader2, AlertCircle, Volume2, VolumeX, Play, Pause } from 'lucide-react'

export type RecorderState = 'speaking' | 'idle' | 'countdown' | 'recording' | 'stopped' | 'uploading' | 'done' | 'error'

interface AudioRecorderProps {
  onUpload: (blob: Blob, durationSeconds: number) => Promise<void>
  disabled?: boolean
  maxDurationSeconds?: number
  questionText?: string
  languageCode?: string
}

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
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(24).fill(4))
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
      if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl)
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
        const bars = Array.from({ length: 24 }, (_, i) => {
          const val = data[Math.floor((i / 24) * data.length)] || 0
          return Math.max(4, (val / 255) * 40)
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
    setWaveHeights(Array(24).fill(4))
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

  const startCountdown = useCallback(() => {
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
  }, [])

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
    if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl)
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

  const progressPct = Math.min((elapsed / maxDurationSeconds) * 100, 100)

  return (
    <div style={styles.container}>
      {/* Waveform / visual */}
      <div style={styles.waveContainer}>
        {recorderState === 'speaking' ? (
          <div style={styles.speakingRow}>
            <div style={styles.speakingPulse}>
              <Volume2 size={28} color="#fff" />
            </div>
            <div style={styles.speakingInfo}>
              <span style={styles.speakingLabel}>AI is reading the question…</span>
              <span style={styles.speakingHint}>Listen carefully, then record your answer</span>
            </div>
          </div>
        ) : recorderState === 'countdown' ? (
          <div style={styles.countdownCircle}>
            <span style={styles.countdownNum}>{countdown}</span>
          </div>
        ) : recorderState === 'recording' ? (
          <div style={styles.waveform}>
            {waveHeights.map((h, i) => (
              <div
                key={i}
                style={{
                  ...styles.wavebar,
                  height: `${h}px`,
                  opacity: 0.7 + (h / 40) * 0.3,
                  animationDelay: `${i * 40}ms`,
                }}
              />
            ))}
          </div>
        ) : recorderState === 'stopped' || recorderState === 'done' ? (
          <div style={styles.customPlayerWrap}>
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
            <div style={styles.playerLabel}>Your Recording</div>
            <div style={styles.playerRow}>
              <button style={styles.playPauseBtn} onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
              </button>
              <div style={styles.playerProgressWrap}>
                <div style={styles.playerProgressBar}>
                  <div
                    style={{
                      ...styles.playerProgressFill,
                      width: elapsed > 0 ? `${Math.min((playbackTime / elapsed) * 100, 100)}%` : '0%',
                    }}
                  />
                </div>
                <div style={styles.playerTimeRow}>
                  <span style={styles.playerTime}>{formatTime(playbackTime)}</span>
                  <span style={styles.playerTimeSep}>/</span>
                  <span style={styles.playerTimeTotal}>{formatTime(elapsed)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : recorderState === 'uploading' ? (
          <div style={styles.statusRow}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--violet)' }} />
            <span style={styles.statusText}>Uploading response…</span>
          </div>
        ) : recorderState === 'error' ? (
          <div style={styles.statusRow}>
            <AlertCircle size={24} color="#ef4444" />
            <span style={{ ...styles.statusText, color: '#ef4444' }}>{errorMsg}</span>
          </div>
        ) : (
          <div style={styles.idleHint}>
            <Mic size={32} style={{ color: 'var(--text-mid)', opacity: 0.5 }} />
            <span style={styles.hintText}>Press Record to begin</span>
          </div>
        )}
      </div>

      {/* TTS unavailable notice */}
      {ttsUnavailable && (
        <div style={styles.ttsUnavailableBanner}>
          <VolumeX size={14} />
          <span>Voice audio not available for this language on your device — please read the question above.</span>
        </div>
      )}

      {/* Timer bar */}
      {recorderState === 'recording' && (
        <div style={styles.timerWrap}>
          <div style={styles.timerBar}>
            <div style={{ ...styles.timerFill, width: `${progressPct}%` }} />
          </div>
          <span style={styles.timerLabel}>
            {formatTime(elapsed)} / {formatTime(maxDurationSeconds)}
          </span>
        </div>
      )}

      {/* Controls */}
      <div style={styles.controls}>
        {recorderState === 'speaking' && (
          <button style={styles.skipTtsBtn} onClick={handleStopTTS}>
            <VolumeX size={15} />
            Skip Audio
          </button>
        )}

        {(recorderState === 'idle' || recorderState === 'error') && (
          <div style={styles.actionRow}>
            {questionText && (
              <button
                style={ttsSpeaking ? styles.replayBtnActive : styles.replayBtn}
                onClick={handleReplayQuestion}
                disabled={ttsSpeaking}
                title="Replay question aloud"
              >
                <Volume2 size={15} />
                {ttsSpeaking ? 'Playing…' : 'Replay Question'}
              </button>
            )}
            <button
              style={styles.recordBtn}
              onClick={startCountdown}
              disabled={disabled || ttsSpeaking}
            >
              <Mic size={18} />
              Record Answer
            </button>
          </div>
        )}

        {recorderState === 'countdown' && (
          <button style={{ ...styles.recordBtn, opacity: 0.6 }} disabled>
            <Mic size={18} />
            Starting in {countdown}…
          </button>
        )}

        {recorderState === 'recording' && (
          <button style={styles.stopBtn} onClick={stopRecording}>
            <Square size={16} fill="white" />
            Stop Recording
          </button>
        )}

        {recorderState === 'stopped' && (
          <div style={styles.actionRow}>
            {questionText && (
              <button
                style={ttsSpeaking ? styles.replayBtnActive : styles.replayBtn}
                onClick={handleReplayQuestion}
                disabled={ttsSpeaking}
                title="Replay question aloud"
              >
                <Volume2 size={15} />
                {ttsSpeaking ? 'Playing…' : 'Replay Question'}
              </button>
            )}
            {canReRecord && (
              <button style={styles.reRecordBtn} onClick={handleReRecord}>
                <RotateCcw size={15} />
                Re-record
              </button>
            )}
            <button style={styles.submitBtn} onClick={handleSubmit}>
              <CheckCircle size={16} />
              Submit Answer
            </button>
          </div>
        )}

        {recorderState === 'done' && (
          <div style={styles.doneRow}>
            <CheckCircle size={20} color="#22c55e" />
            <span style={styles.doneText}>Answer submitted</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes wavePulse {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.4); }
        }
        @keyframes speakPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(108,71,255,0.4); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 10px rgba(108,71,255,0); }
        }
      `}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '20px',
    background: 'var(--kpi-bg, #f7f5ff)',
    borderRadius: '16px',
    border: '1px solid var(--card-border, #e8e6ff)',
  },
  waveContainer: {
    minHeight: '72px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    width: '100%',
  },
  speakingPulse: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--violet, #6c47ff), var(--violet-mid, #9b80ff))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    animation: 'speakPulse 1.2s ease-in-out infinite',
  },
  speakingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  speakingLabel: {
    color: 'var(--violet, #6c47ff)',
    fontWeight: 700,
    fontSize: '14px',
  },
  speakingHint: {
    color: 'var(--text-mid)',
    fontSize: '12px',
  },
  countdownCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--violet, #6c47ff), var(--violet-mid, #9b80ff))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNum: {
    color: '#fff',
    fontSize: '28px',
    fontWeight: 800,
  },
  waveform: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    height: '48px',
  },
  wavebar: {
    width: '4px',
    borderRadius: '2px',
    background: 'linear-gradient(180deg, var(--violet, #6c47ff), var(--pink, #ff6bc6))',
    transition: 'height 0.1s ease',
    animation: 'wavePulse 0.8s ease-in-out infinite',
  },
  customPlayerWrap: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  } as React.CSSProperties,
  playerLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
  } as React.CSSProperties,
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#fff',
    borderRadius: '12px',
    padding: '10px 14px',
    border: '1px solid #e8e6ff',
    boxShadow: '0 1px 4px rgba(108,71,255,0.06)',
  },
  playPauseBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #6c47ff, #9b80ff)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(108,71,255,0.30)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  playerProgressWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  } as React.CSSProperties,
  playerProgressBar: {
    height: '5px',
    borderRadius: '3px',
    background: '#e8e6ff',
    overflow: 'hidden',
  },
  playerProgressFill: {
    height: '100%',
    borderRadius: '3px',
    background: 'linear-gradient(90deg, #6c47ff, #ff6bc6)',
    transition: 'width 0.25s linear',
  },
  playerTimeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  playerTime: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#6c47ff',
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
  playerTimeSep: {
    fontSize: '11px',
    color: '#c4c0e8',
    fontWeight: 500,
  },
  playerTimeTotal: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#9ca3af',
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statusText: {
    color: 'var(--text-mid)',
    fontSize: '14px',
  },
  idleHint: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  hintText: {
    color: 'var(--text-mid)',
    fontSize: '13px',
  },
  timerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  timerBar: {
    flex: 1,
    height: '6px',
    borderRadius: '3px',
    background: 'var(--card-border, #e8e6ff)',
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: '3px',
    background: 'linear-gradient(90deg, var(--violet, #6c47ff), var(--pink, #ff6bc6))',
    transition: 'width 0.5s linear',
  },
  timerLabel: {
    fontSize: '12px',
    color: 'var(--text-mid)',
    whiteSpace: 'nowrap',
    minWidth: '72px',
    textAlign: 'right',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
  },
  skipTtsBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 18px',
    borderRadius: '10px',
    border: '1px solid var(--card-border)',
    background: 'var(--input-bg)',
    color: 'var(--text-mid)',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
  actionRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  replayBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid var(--violet, #6c47ff)',
    background: 'transparent',
    color: 'var(--violet, #6c47ff)',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
  replayBtnActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid var(--card-border)',
    background: 'var(--input-bg)',
    color: 'var(--text-mid)',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
  recordBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 24px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, var(--violet, #6c47ff), var(--violet-mid, #9b80ff))',
    color: '#fff',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  stopBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 24px',
    borderRadius: '12px',
    border: 'none',
    background: '#ef4444',
    color: '#fff',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    animation: 'micPulse 1.5s ease-in-out infinite',
  },
  reRecordBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1px solid var(--card-border)',
    background: 'var(--input-bg)',
    color: 'var(--text-mid)',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    borderRadius: '10px',
    border: 'none',
    background: '#22c55e',
    color: '#fff',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
  },
  doneRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  doneText: {
    color: '#22c55e',
    fontWeight: 600,
    fontSize: '14px',
  },
  ttsUnavailableBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '10px',
    background: '#fff8e1',
    border: '1px solid #ffd54f',
    color: '#795548',
    fontSize: '12px',
    fontWeight: 500,
  } as React.CSSProperties,
}
