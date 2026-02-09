import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function Dashboard() {
  const [data, setData] = useState({ active_rules: [], recent_logs: [], voice_online_count: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.get('/api/dashboard')
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="card">Загрузка…</div>
  if (error) return <div className="alert alert-error">{error}</div>

  return (
    <>
      <div className="card">
        <h2>Обзор</h2>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>В голосе</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{data.voice_online_count ?? '—'}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Активных правил</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{data.active_rules?.length ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Активные правила</h2>
        {data.active_rules?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Действие</th>
                  <th>Список</th>
                  <th>Приоритет</th>
                </tr>
              </thead>
              <tbody>
                {data.active_rules.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.action_type}</td>
                    <td>{r.target_list || '—'}</td>
                    <td>{r.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">Нет активных правил</p>
        )}
      </div>

      <div className="card">
        <h2>Последние логи</h2>
        {data.recent_logs?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>discord_id</th>
                  <th>Действие</th>
                  <th>rule_id</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.executed_at).toLocaleString()}</td>
                    <td>{log.discord_id}</td>
                    <td>{log.action_type || '—'}</td>
                    <td>{log.rule_id ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">Нет логов</p>
        )}
      </div>
    </>
  )
}
