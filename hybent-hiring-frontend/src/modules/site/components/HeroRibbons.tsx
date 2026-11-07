/**
 * Flowing ribbons in the HYBENT mark's colours, sweeping across the lower part
 * of the hero (the same twist as the "H" in the logo). Static artwork: it only
 * drifts a little on scroll through the site's existing data-para parallax.
 */
/** "hero" sits under a page's hero; "soft" is the same but paler (pricing). */
export default function HeroRibbons({ variant = 'hero' }: { variant?: 'hero' | 'soft' }) {
  return (
    <div className={variant === 'hero' ? 'hero-ribbons' : `hero-ribbons hero-ribbons--${variant}`} aria-hidden="true" data-para="0.04">
      <svg viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="rb-a" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#22CFFF" stopOpacity="0" />
            <stop offset=".22" stopColor="#22CFFF" stopOpacity=".55" />
            <stop offset=".55" stopColor="#4C6FFF" stopOpacity=".5" />
            <stop offset=".85" stopColor="#A855F7" stopOpacity=".45" />
            <stop offset="1" stopColor="#E85CFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rb-b" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#A855F7" stopOpacity="0" />
            <stop offset=".3" stopColor="#A855F7" stopOpacity=".35" />
            <stop offset=".7" stopColor="#22CFFF" stopOpacity=".38" />
            <stop offset="1" stopColor="#22CFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rb-c" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#4C6FFF" stopOpacity="0" />
            <stop offset=".4" stopColor="#4C6FFF" stopOpacity=".22" />
            <stop offset=".8" stopColor="#E85CFF" stopOpacity=".26" />
            <stop offset="1" stopColor="#E85CFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rb-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".35" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="rb-mask">
            <rect width="1440" height="560" fill="url(#rb-fade)" />
          </mask>
          <filter id="rb-soft" x="-5%" y="-20%" width="110%" height="140%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
        <g mask="url(#rb-mask)" filter="url(#rb-soft)">
          {/* Back ribbon: wide and pale. */}
          <path fill="url(#rb-c)" d="M-80 470 C 260 300, 520 520, 820 400 S 1300 220, 1540 330 L 1540 410 C 1300 300, 1080 470, 820 480 S 260 400, -80 560 Z" />
          {/* Middle ribbon: twists over itself like the H mark. */}
          <path fill="url(#rb-b)" d="M-80 380 C 240 470, 470 300, 760 360 S 1180 520, 1540 400 L 1540 450 C 1200 560, 960 420, 760 410 S 260 520, -80 440 Z" />
          {/* Front ribbon: the brightest, thinnest band. */}
          <path fill="url(#rb-a)" d="M-80 420 C 220 340, 500 460, 780 420 S 1240 300, 1540 360 L 1540 384 C 1240 330, 1020 470, 780 452 S 240 380, -80 452 Z" />
          {/* Fine lines that run along the ribbons. */}
          <path fill="none" stroke="url(#rb-a)" strokeWidth="1.2" d="M-80 400 C 220 320, 500 440, 780 400 S 1240 280, 1540 340" />
          <path fill="none" stroke="url(#rb-b)" strokeWidth="1" d="M-80 470 C 240 520, 470 360, 760 390 S 1180 540, 1540 430" />
        </g>
      </svg>
    </div>
  )
}
