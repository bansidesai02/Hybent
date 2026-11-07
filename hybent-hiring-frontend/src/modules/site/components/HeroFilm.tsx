import { LaunchFilm } from '@/modules/hiring/components/LaunchFilm'

/**
 * The home hero's right side: the 46-second Hybent Hiring launch film in a
 * frame of the brand gradient (cyan → blue → violet → pink).
 */
export default function HeroFilm() {
  return (
    <div className="hero-film" data-rv="scale" data-delay="200">
      <div className="hero-film__frame">
        <span className="hero-film__glow hero-film__glow--a" aria-hidden="true" />
        <span className="hero-film__glow hero-film__glow--b" aria-hidden="true" />
        <div className="hero-film__card">
          <LaunchFilm />
        </div>
      </div>

    </div>
  )
}
