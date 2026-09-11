import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined'
import CodeRounded from '@mui/icons-material/CodeRounded'
import DataObjectRounded from '@mui/icons-material/DataObjectRounded'
import DnsOutlined from '@mui/icons-material/DnsOutlined'
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import SmartToyOutlined from '@mui/icons-material/SmartToyOutlined'
import StorageRounded from '@mui/icons-material/StorageRounded'

const TECHNOLOGIES = [
  ['React', CodeRounded],
  ['FastAPI', DataObjectRounded],
  ['PostgreSQL', StorageRounded],
  ['discord.py', SmartToyOutlined],
  ['Docker', Inventory2Outlined],
  ['Nginx', DnsOutlined],
  ['GitHub Actions', AccountTreeOutlined],
]

export default function TechnologyContour() {
  return (
    <section id="source" className="landing-technology" aria-labelledby="technology-title">
      <div className="landing-shell landing-technology__grid">
        <div className="landing-technology__copy">
          <p className="landing-eyebrow">Контур проекта</p>
          <h2 id="technology-title">Технологии и доставка</h2>
          <p>Инструменты собраны вокруг одного проекта и его понятного пути к развёртыванию.</p>
        </div>
        <div className="landing-technology__details">
          <ul className="landing-technology__list">
            {TECHNOLOGIES.map(([name, Icon]) => (
              <li key={name} aria-label={name}>
                <Icon aria-hidden="true" />
                <span>{name}</span>
              </li>
            ))}
          </ul>
          <p className="landing-technology__pipeline">GitHub Actions → Docker → Nginx → production</p>
          <div className="landing-technology__links">
            <a href="https://github.com/fantom2513/vibe_ds_bot" target="_blank" rel="noreferrer">
              Открыть репозиторий
            </a>
            <a href="https://github.com/fantom2513/vibe_ds_bot/actions" target="_blank" rel="noreferrer">
              Открыть workflow
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
