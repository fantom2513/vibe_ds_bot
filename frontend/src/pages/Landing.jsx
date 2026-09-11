import './Landing.css'
import LandingHero from '../components/landing/LandingHero'
import LandingStory from '../components/landing/LandingStory'
import TechnologyContour from '../components/landing/TechnologyContour'

export default function Landing() {
  return (
    <main id="top" className="landing">
      <header className="landing-header">
        <div className="landing-shell">
          <nav className="landing-nav" aria-label="Основная навигация">
            <a href="#interface">Интерфейс</a>
            <a href="#source">Устройство</a>
            <a href="#source">Исходный код</a>
          </nav>
        </div>
      </header>
      <LandingHero />
      <LandingStory />
      <TechnologyContour />
    </main>
  )
}
