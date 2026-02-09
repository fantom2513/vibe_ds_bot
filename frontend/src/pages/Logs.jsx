import { useState, useEffect } from 'react'
import { api } from '../api/client'

const PAGE_SIZE = 50

function formatDate(d) {
  if (!d) return ''
  const x = new Date(d)
  return x.toISOString().slice(0, 19).replace('T', ' ')
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    discord_id: '',
    rule_id: '',
    action_type: '',
    date_from: '',
    date_to: '',
    offset: 0,
    limit: PAGE_SIZE,
  })
  const [applyKey, setApplyKey] = useState(0)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', String(filters.limit))
    params.set('offset', String(filters.offset))
    if (filters.discord_id) params.set('discord_id', filters.discord_id)
    if (filters.rule_id) params.set('rule_id', filters.rule_id)
    if (filters.action_type) params.set('action_type', filters.action_type)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    api.get(`/api/logs?${params.toString()}`)
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filters.offset, filters.limit, applyKey])

  const applyFilters = (e) => {
    e?.preventDefault()
    setFilters((f) => ({ ...f, offset: 0 }))
    setApplyKey((k) => k + 1)
  }

  const prevPage = () => setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))
  const nextPage = () => setFilters((f) => ({ ...f, offset: f.offset + f.limit }))

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <h2>Логи</h2>
        <form onSubmit={applyFilters} className="form-row" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label>discord_id</label>
            <input type="number" value={filters.discord_id} onChange={(e) => setFilters({ ...filters, discord_id: e.target.value })} placeholder="ID" />
          </div>
          <div className="form-group">
            <label>rule_id</label>
            <input type="number" value={filters.rule_id} onChange={(e) => setFilters({ ...filters, rule_id: e.target.value })} />
          </div>
          <div className="form-group">
            <label>action_type</label>
            <input value={filters.action_type} onChange={(e) => setFilters({ ...filters, action_type: e.target.value })} placeholder="mute, kick, ..." />
          </div>
          <div className="form-group">
            <label>date_from (ISO)</label>
            <input type="datetime-local" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
          </div>
          <div className="form-group">
            <label>date_to (ISO)</label>
            <input type="datetime-local" value={filters.date_to ? filters.date_to.slice(0, 16) : ''} onChange={(e) => setFilters({ ...filters, date_to: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
          </div>
          <div className="form-group" style={{ alignSelf: 'flex-end' }}>
            <button type="submit" className="btn btn-primary">Применить</button>
          </div>
        </form>
        {loading ? (
          <p>Загрузка…</p>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Время</th>
                    <th>discord_id</th>
                    <th>action_type</th>
                    <th>rule_id</th>
                    <th>channel_id</th>
                    <th>details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>{formatDate(log.executed_at)}</td>
                      <td>{log.discord_id}</td>
                      <td>{log.action_type || '—'}</td>
                      <td>{log.rule_id ?? '—'}</td>
                      <td>{log.channel_id ?? '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.details && Object.keys(log.details).length ? JSON.stringify(log.details) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {logs.length === 0 && <p className="empty-state">Нет записей</p>}
            <div className="pagination">
              <button type="button" className="btn btn-secondary btn-sm" onClick={prevPage} disabled={filters.offset === 0}>
                Назад
              </button>
              <span>offset: {filters.offset}, показано: {logs.length}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={nextPage} disabled={logs.length < filters.limit}>
                Вперёд
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
