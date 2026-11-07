import { useEffect, useRef, useState } from 'react'

const POSTER = '/videos/hybent-hiring-film-poster.jpg'

/** The film in three sizes; "auto" picks one from the screen and connection. */
type Quality = 'auto' | '1080' | '720' | '480'
const QUALITIES: Quality[] = ['auto', '1080', '720', '480']
const srcFor = (q: Exclude<Quality, 'auto'>) => `/videos/hybent-hiring-film-${q}.mp4`

function autoQuality(): Exclude<Quality, 'auto'> {
  if (typeof window === 'undefined') return '720'
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return '480'
  const px = window.innerWidth * (window.devicePixelRatio || 1)
  if (px >= 1400 && conn?.effectiveType !== '3g') return '1080'
  return px >= 700 ? '720' : '480'
}

const resolve = (q: Quality) => srcFor(q === 'auto' ? autoQuality() : q)

/** Set the source only once the film is near the screen, so the page loads without it. */
function load(video: HTMLVideoElement, q: Quality) {
  if (!video.getAttribute('src')) video.src = resolve(q)
}

/** Phones, data saver and reduced motion wait for a tap instead of autoplaying. */
function shouldAutoplay(): boolean {
  if (typeof window === 'undefined') return false
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  return (
    !saveData &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    window.matchMedia('(min-width: 768px)').matches
  )
}

const Icon = {
  play: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></svg>,
  pause: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" /></svg>,
  volume: <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  muted: <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  gear: <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>,
  fullscreen: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
}

/**
 * The 46-second launch film with its own control bar: play/pause, progress,
 * volume and fullscreen (no quality or playback-rate menu). Nothing downloads
 * until it is near the screen; on desktop it then plays muted on a loop and
 * pauses when scrolled away, unless the visitor paused it themselves.
 */
export function LaunchFilm({ fullBleed = false }: { fullBleed?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const userPaused = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(1)
  const [progress, setProgress] = useState(0)
  const [quality, setQuality] = useState<Quality>('auto')
  const [menu, setMenu] = useState(false)
  const qualityRef = useRef<Quality>('auto')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (typeof IntersectionObserver === 'undefined') {
      load(video, qualityRef.current)
      return
    }
    const autoplay = shouldAutoplay()
    // Fetch the file a little before the film reaches the screen.
    const loader = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) load(video, qualityRef.current) },
      { rootMargin: '300px 0px' },
    )
    // Pause as soon as most of the film has scrolled away, and play again on
    // the way back: on its own (desktop autoplay), or because the visitor had
    // it playing when they scrolled. A film they paused themselves stays paused.
    let pausedByScroll = false
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.5) {
          if (userPaused.current) return
          if (pausedByScroll || (autoplay && video.paused && video.currentTime === 0)) {
            load(video, qualityRef.current)
            video.play().catch(() => {})
          }
          pausedByScroll = false
        } else if (!video.paused) {
          pausedByScroll = true
          video.pause()
        }
      },
      { threshold: [0, 0.5] },
    )
    loader.observe(video)
    watcher.observe(video)
    return () => { loader.disconnect(); watcher.disconnect() }
  }, [])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    load(video, qualityRef.current)
    if (video.paused) {
      userPaused.current = false
      video.play().catch(() => {})
    } else {
      userPaused.current = true
      video.pause()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    if (!video.muted && video.volume === 0) video.volume = 1
  }

  const changeVolume = (value: number) => {
    const video = videoRef.current
    if (!video) return
    video.volume = value
    video.muted = value === 0
  }

  const seek = (fraction: number) => {
    const video = videoRef.current
    if (!video || !video.duration) return
    video.currentTime = fraction * video.duration
  }

  /** Swap the file but keep the place in the film and whether it was playing. */
  const pickQuality = (q: Quality) => {
    setMenu(false)
    setQuality(q)
    qualityRef.current = q
    const video = videoRef.current
    if (!video || !video.getAttribute('src')) return
    const next = resolve(q)
    if (video.getAttribute('src') === next) return
    const at = video.currentTime
    const wasPlaying = !video.paused
    video.src = next
    video.preload = 'auto'
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = at
      if (wasPlaying) video.play().catch(() => {})
    }, { once: true })
    video.load()
  }

  const fullscreen = () => {
    const box = boxRef.current
    if (!box) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else box.requestFullscreen?.().catch(() => {})
  }

  const sound = muted ? 0 : volume

  return (
    <div className={fullBleed ? 'launch-film launch-film--full' : 'launch-film'} ref={boxRef} data-rv="up">
      <video
        ref={videoRef}
        poster={POSTER}
        muted
        loop
        playsInline
        preload="none"
        aria-label="Hybent Hiring launch film"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          setProgress(v.duration ? v.currentTime / v.duration : 0)
        }}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted)
          setVolume(e.currentTarget.volume)
        }}
      />

      {!playing && progress === 0 && (
        <button type="button" className="launch-film__big-play" onClick={togglePlay} aria-label="Play the launch film">
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
        </button>
      )}

      <div className="launch-film__bar">
        <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? Icon.pause : Icon.play}
        </button>
        <input
          className="launch-film__progress"
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(e) => seek(Number(e.target.value) / 1000)}
          aria-label="Seek"
          style={{ ['--fill' as string]: `${progress * 100}%` }}
        />
        <button type="button" onClick={toggleMute} aria-label={sound === 0 ? 'Unmute' : 'Mute'}>
          {sound === 0 ? Icon.muted : Icon.volume}
        </button>
        <input
          className="launch-film__volume"
          type="range"
          min={0}
          max={100}
          value={Math.round(sound * 100)}
          onChange={(e) => changeVolume(Number(e.target.value) / 100)}
          aria-label="Volume"
          style={{ ['--fill' as string]: `${sound * 100}%` }}
        />
        <div className="launch-film__quality">
          <button type="button" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Video quality">
            {Icon.gear}
            <span className="launch-film__q-label">{quality === 'auto' ? `Auto · ${autoQuality()}p` : `${quality}p`}</span>
          </button>
          {menu && (
            <div className="launch-film__menu" role="menu">
              {QUALITIES.map((q) => (
                <button key={q} type="button" role="menuitemradio" aria-checked={quality === q} onClick={() => pickQuality(q)}>
                  {q === 'auto' ? 'Auto' : `${q}p${q === '1080' ? ' HD' : ''}`}
                  {quality === q && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={fullscreen} aria-label="Fullscreen">
          {Icon.fullscreen}
        </button>
      </div>

      <style>{`
        .launch-film { position: relative; max-width: 1040px; margin: 36px auto 0; border-radius: 20px; overflow: hidden;
          border: 1px solid rgba(15, 23, 42, 0.08); box-shadow: 0 30px 80px -30px rgba(37, 56, 140, 0.35); background: #070b1a; aspect-ratio: 16 / 9; }
        .launch-film--full { max-width: none; width: 100%; margin: 0; border-radius: 0; border: 0; box-shadow: none; }
        .launch-film:fullscreen { max-width: none; border-radius: 0; border: 0; }
        .launch-film video { display: block; width: 100%; height: 100%; object-fit: contain; cursor: pointer; }
        .launch-film__big-play { position: absolute; inset: 0; margin: auto; width: 76px; height: 76px; border-radius: 50%; border: 0;
          display: grid; place-items: center; color: #fff; cursor: pointer; background: linear-gradient(135deg, #22c3ee, #7c5cff);
          box-shadow: 0 12px 40px rgba(124, 92, 255, 0.45); transition: transform .2s; }
        .launch-film__big-play:hover { transform: scale(1.06); }
        .launch-film__big-play svg { margin-left: 4px; }
        .launch-film .launch-film__bar { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 14px;
          padding: 28px 18px 12px; background: linear-gradient(transparent, rgba(7, 11, 26, 0.75)); color: #fff;
          opacity: 0; transition: opacity .25s; }
        .launch-film:hover .launch-film__bar, .launch-film:focus-within .launch-film__bar { opacity: 1; }
        @media (hover: none) { .launch-film .launch-film__bar { opacity: 1; } }
        .launch-film .launch-film__bar button { display: grid; place-items: center; padding: 4px; border: 0; background: none;
          color: #fff; cursor: pointer; }
        .launch-film__bar input[type=range] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 4px; cursor: pointer;
          background: linear-gradient(90deg, #22c3ee, #7c5cff) 0 / var(--fill, 0%) 100% no-repeat, rgba(255, 255, 255, 0.3); }
        .launch-film__progress { flex: 1; }
        .launch-film__volume { width: 80px; }
        .launch-film__bar input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
        .launch-film__bar input[type=range]::-moz-range-thumb { width: 12px; height: 12px; border: 0; border-radius: 50%; background: #fff; }
        .launch-film__quality { position: relative; }
        .launch-film .launch-film__quality > button { display: flex; gap: 6px; align-items: center; font: 600 12px/1 inherit; }
        .launch-film__menu { position: absolute; right: 0; bottom: calc(100% + 10px); min-width: 140px; padding: 6px; border-radius: 12px;
          background: rgba(11, 18, 32, 0.92); backdrop-filter: blur(10px); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4); }
        .launch-film .launch-film__menu button { width: 100%; display: flex; justify-content: space-between; padding: 8px 10px;
          border-radius: 8px; font-size: 13px; text-align: left; }
        .launch-film .launch-film__menu button:hover { background: rgba(255, 255, 255, 0.1); }
        .launch-film:has(.launch-film__menu) .launch-film__bar { opacity: 1; }
        @media (max-width: 600px) { .launch-film__volume, .launch-film__q-label { display: none; } }
      `}</style>
    </div>
  )
}
