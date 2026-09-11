import './Landing.css'
import LandingHero from '../components/landing/LandingHero'

export default function Landing() {
  return (
    <main id="top" className="landing">
      <header className="landing-header">
        <div className="landing-shell">
          <nav className="landing-nav" aria-label="Основная навигация">
            <a href="#interface">Интерфейс</a>
            <a href="#system">Устройство</a>
            <a href="#source">Исходный код</a>
          </nav>
        </div>
      </header>
      <LandingHero />
    </main>
  )
}
