import { useCallback, useEffect, useRef, useState } from 'react'

import { copilotApi } from '@/api/copilot'

/**
 * Voice input for the Copilot page's composer: record from the mic, then
 * transcribe and tidy the text on the server — the same two calls the
 * floating CopilotWidget's mic makes (copilotApi.transcribe, cleanTranscript).
 * Recording stops on its own after a minute.
 */

export type VoiceStatus = 'idle' | 'recording' | 'transcribing'

const MAX_SECONDS = 60

function supportedMimeType(): string {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  return ''
}

export function useVoiceInput(onText: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const cancelledRef = useRef(false)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  const cleanup = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Voice input is not supported in this browser.')
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
      })
    } catch {
      setError('Microphone permission denied. Allow mic access in your browser settings.')
      return
    }
    streamRef.current = stream
    cancelledRef.current = false
    chunksRef.current = []

    const mimeType = supportedMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = async () => {
      cleanup()
      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
      if (cancelledRef.current || blob.size === 0) {
        setStatus('idle')
        return
      }
      setStatus('transcribing')
      try {
        const raw = (await copilotApi.transcribe(blob)).data.text.trim()
        if (!raw) {
          setError('No speech detected. Please try again and speak clearly.')
          return
        }
        let text = raw
        try {
          text = (await copilotApi.cleanTranscript(raw)).data.text.trim() || raw
        } catch {
          /* The raw transcript is still usable. */
        }
        onTextRef.current(text)
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Could not transcribe your voice. Please try again.')
      } finally {
        setStatus('idle')
      }
    }

    recorder.start()
    setStatus('recording')
    setSeconds(0)
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop()
        return s + 1
      })
    }, 1000)
  }, [cleanup, stop])

  /** Stop without transcribing. */
  const cancel = useCallback(() => {
    cancelledRef.current = true
    stop()
  }, [stop])

  // Release the mic if the page unmounts mid-recording.
  useEffect(() => () => {
    cancelledRef.current = true
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    cleanup()
  }, [cleanup])

  return { status, seconds, error, start, stop, cancel, clearError: () => setError(null) }
}
