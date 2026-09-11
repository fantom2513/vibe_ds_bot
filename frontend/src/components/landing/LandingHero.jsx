export default function LandingHero() {
  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-shell landing-hero__grid">
        <div className="landing-hero__copy">
          <p className="landing-eyebrow">Vibe</p>
          <h1 id="landing-title">Тишина — тоже состояние системы.</h1>
          <p>Discord-бот, backend и интерфейс управления в одном авторском проекте.</p>
          <div className="landing-actions">
            <a className="landing-button landing-button--primary" href="#interface">
              Посмотреть систему
            </a>
            <a className="landing-button landing-button--quiet" href="/admin">
              Открыть админку
            </a>
          </div>
        </div>
        <img className="landing-hero__core" src="/landing/singularity-core-v3.png" alt="" />
      </div>
    </section>
  )
}
