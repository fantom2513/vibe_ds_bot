const STORY_STEPS = [
  { id: 'overview', title: 'Состояние сервера', label: '01 / overview' },
  { id: 'rule', title: 'Логика правила', label: '02 / rule' },
  { id: 'log', title: 'Проверяемый результат', label: '03 / log' },
]

function StoryDemo({ id }) {
  if (id === 'overview') {
    return (
      <dl className="landing-story__status">
        <div><dt>Контекст</dt><dd>Демонстрационный сервер</dd></div>
        <div><dt>Набор</dt><dd>Пример данных</dd></div>
        <div><dt>Сценарий</dt><dd>Проверка правила</dd></div>
      </dl>
    )
  }

  if (id === 'rule') {
    return (
      <ol className="landing-story__rule">
        <li>Событие приходит из Discord.</li>
        <li>Правило сверяет канал и временное окно.</li>
        <li>Действие сохраняется для проверки.</li>
      </ol>
    )
  }

  return (
    <table className="landing-story__log">
      <caption>Фрагмент журнала</caption>
      <tbody>
        <tr><th scope="row">21:00</th><td>Rule evaluated</td></tr>
        <tr><th scope="row">21:00</th><td>Quiet mode applied</td></tr>
      </tbody>
    </table>
  )
}

export default function LandingStory() {
  return (
    <section id="interface" className="landing-story" aria-labelledby="landing-story-title">
      <div className="landing-shell landing-story__grid">
        <div className="landing-story__copy">
          <p className="landing-eyebrow">Продуктовый контур</p>
          <h2 id="landing-story-title">От сигнала к понятному результату.</h2>
          <p>Интерфейс показывает не декоративную активность, а путь каждого решения: состояние, правило и запись о выполнении.</p>
        </div>
        <div className="landing-story__cards">
          {STORY_STEPS.map((step) => (
            <article key={step.id} className="landing-story__card" aria-labelledby={`story-${step.id}`}>
              <p className="landing-story__label">{step.label}</p>
              <h3 id={`story-${step.id}`}>{step.title}</h3>
              <StoryDemo id={step.id} />
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
