import { useState, useEffect } from 'react'
import { getApiKey, setApiKey, getApiBaseUrl, setApiBaseUrl } from '../lib/storage'

export default function Settings() {
  const [apiKey, setApiKeyLocal] = useState('')
  const [baseUrl, setBaseUrlLocal] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setApiKeyLocal(getApiKey())
    setBaseUrlLocal(getApiBaseUrl())
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    setApiKey(apiKey)
    setApiBaseUrl(baseUrl || undefined)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="card">
      <h2>Настройки API</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        API key сохраняется в localStorage и подставляется в заголовок X-API-Key для всех запросов.
      </p>
      <form className="settings-form" onSubmit={handleSave}>
        <div className="form-group">
          <label>Base URL API</label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrlLocal(e.target.value)}
            placeholder="http://localhost:8000"
          />
        </div>
        <div className="form-group">
          <label>X-API-Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKeyLocal(e.target.value)}
            placeholder="Секретный ключ из API_SECRET_KEY"
            autoComplete="off"
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary">
            Сохранить
          </button>
          {saved && <span className="alert-success" style={{ padding: '0.35rem 0.75rem', margin: 0 }}>Сохранено</span>}
        </div>
      </form>
    </div>
  )
}
