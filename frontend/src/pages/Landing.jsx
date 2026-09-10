import './Landing.css'

export default function Landing() {
  return (
    <main id="top" className="landing">
      <header className="landing-header">
        <nav className="landing-nav" aria-label="Основная навигация">
          <a href="#interface">Интерфейс</a>
          <a href="#system">Устройство</a>
          <a href="#source">Исходный код</a>
        </nav>
      </header>
      <h1>Тишина — тоже состояние системы.</h1>
      <a href="/admin">Открыть админку</a>
    </main>
  )
}
