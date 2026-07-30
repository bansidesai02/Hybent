import { useEffect, useState } from 'react'

/** Brand preloader — fades out once the window has loaded. */
export function Loader() {
  const [done, setDone] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hide = () => {
      setDone(true)
      document.body.classList.add('ready')
    }
    const onLoad = () => window.setTimeout(hide, reduce ? 0 : 650)
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    const safety = window.setTimeout(hide, 3500)
    return () => {
      window.removeEventListener('load', onLoad)
      window.clearTimeout(safety)
    }
  }, [])

  return (
    <div id="loader" className={done ? 'done' : undefined} aria-hidden="true">
      <div className="load-inner">
        <img className="load-mark" src="/assets/hybent-mark.png" alt="" />
        <div className="load-bar"><i></i></div>
        <div className="load-txt">Where vision meets innovation</div>
      </div>
    </div>
  )
}
