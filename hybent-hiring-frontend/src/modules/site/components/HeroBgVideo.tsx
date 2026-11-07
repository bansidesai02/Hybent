import { useEffect, useRef, useState } from 'react'

/**
 * A quiet, muted 12-second loop behind a hero (the Hybent Hiring pipeline in
 * motion), under a light veil so the headline always reads. 720p on small
 * screens, 1080p on large ones; pauses off screen; people who ask for reduced
 * motion or save data get the still poster only.
 */
const POSTER = '/videos/hiring-hero-loop-poster.jpg'

export function HeroBgVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const [still, setStill] = useState(false)

  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || conn?.saveData) {
      setStill(true)
      return
    }
    const v = ref.current
    if (!v) return
    v.src = window.innerWidth * (window.devicePixelRatio || 1) >= 1400
      ? '/videos/hiring-hero-loop-1080.mp4'
      : '/videos/hiring-hero-loop-720.mp4'
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {})
      else v.pause()
    }, { threshold: 0.1 })
    io.observe(v)
    return () => io.disconnect()
  }, [])

  return (
    <div className="hero-bgv" aria-hidden="true">
      {still
        ? <img src={POSTER} alt="" />
        : <video ref={ref} poster={POSTER} muted loop playsInline preload="auto" />}
      <span className="hero-bgv__veil" />
    </div>
  )
}
