import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function Schedules() {
  const [schedules, setSchedules] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ rule_id: '', cron_expr: '', action: 'enable', timezone: 'UTC' })

  const load = () => {
    setLoading(true)
    Promise.all([api.get('/api/schedules'), api.get('/api/rules')])
      .then(([s, r]) => {
        setSchedules(s)
        setRules(r)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const createSchedule = (e) => {
    e.preventDefault()
    const ruleId = parseInt(form.rule_id, 10)
    if (!form.cron_expr || isNaN(ruleId)) {
      setError('Укажите rule_id и cron_expr')
      return
    }
    api.post('/api/schedules', {
      rule_id: ruleId,
      cron_expr: form.cron_expr,
      action: form.action,
      timezone: form.timezone || 'UTC',
    })
      .then(() => { load(); setForm({ rule_id: '', cron_expr: '', action: 'enable', timezone: 'UTC' }); setError(null) })
      .catch((err) => setError(err.message))
  }

  const deleteSchedule = (id) => {
    if (!confirm('Удалить расписание?')) return
    api.delete(`/api/schedules/${id}`).then(load).catch((err) => setError(err.message))
  }

  if (loading) return <div className="card">Загрузка…</div>

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <h2>Расписания</h2>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Создать расписание</h3>
          <form onSubmit={createSchedule} className="form-row">
            <div className="form-group">
              <label>rule_id *</label>
              <select value={form.rule_id} onChange={(e) => setForm({ ...form, rule_id: e.target.value })} required>
                <option value="">—</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>{r.id} — {r.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>cron_expr *</label>
              <input value={form.cron_expr} onChange={(e) => setForm({ ...form, cron_expr: e.target.value })} placeholder="0 9 * * *" required />
            </div>
            <div className="form-group">
              <label>action</label>
              <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                <option value="enable">enable</option>
                <option value="disable">disable</option>
              </select>
            </div>
            <div className="form-group">
              <label>timezone</label>
              <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">Создать</button>
            </div>
          </form>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>rule_id</th>
                <th>cron_expr</th>
                <th>action</th>
                <th>timezone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.rule_id}</td>
                  <td><code>{s.cron_expr}</code></td>
                  <td>{s.action}</td>
                  <td>{s.timezone}</td>
                  <td>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteSchedule(s.id)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {schedules.length === 0 && <p className="empty-state">Нет расписаний</p>}
      </div>
    </>
  )
}
