import { useState, useEffect } from 'react'
import { api } from '../api/client'

const ACTION_TYPES = ['mute', 'unmute', 'move', 'kick']
const TARGET_LIST_OPTIONS = ['', 'whitelist', 'blacklist']

function parseChannelIds(v) {
  if (!v || typeof v !== 'string') return null
  const arr = v.trim().split(/[\s,]+/).map((s) => parseInt(s, 10)).filter((n) => !isNaN(n))
  return arr.length ? arr : null
}

function formatChannelIds(arr) {
  return Array.isArray(arr) && arr.length ? arr.join(', ') : ''
}

export default function Rules() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    is_active: true,
    target_list: '',
    channel_ids: '',
    max_time_sec: '',
    action_type: 'mute',
    action_params: '{}',
    schedule_cron: '',
    schedule_tz: 'UTC',
    priority: 0,
  })

  const load = () => {
    setLoading(true)
    api.get('/api/rules')
      .then(setList)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({
      name: '',
      description: '',
      is_active: true,
      target_list: '',
      channel_ids: '',
      max_time_sec: '',
      action_type: 'mute',
      action_params: '{}',
      schedule_cron: '',
      schedule_tz: 'UTC',
      priority: 0,
    })
  }

  const openEdit = (r) => {
    setEditing(r.id)
    setForm({
      name: r.name,
      description: r.description || '',
      is_active: r.is_active,
      target_list: r.target_list || '',
      channel_ids: formatChannelIds(r.channel_ids),
      max_time_sec: r.max_time_sec ?? '',
      action_type: r.action_type || 'mute',
      action_params: typeof r.action_params === 'object' ? JSON.stringify(r.action_params, null, 2) : (r.action_params || '{}'),
      schedule_cron: r.schedule_cron || '',
      schedule_tz: r.schedule_tz || 'UTC',
      priority: r.priority ?? 0,
    })
  }

  const parseParams = () => {
    try {
      return form.action_params ? JSON.parse(form.action_params) : {}
    } catch (_) {
      return {}
    }
  }

  const saveRule = (e) => {
    e.preventDefault()
    const payload = {
      name: form.name,
      description: form.description || null,
      is_active: form.is_active,
      target_list: form.target_list || null,
      channel_ids: parseChannelIds(form.channel_ids),
      max_time_sec: form.max_time_sec === '' ? null : parseInt(form.max_time_sec, 10),
      action_type: form.action_type,
      action_params: parseParams(),
      schedule_cron: form.schedule_cron || null,
      schedule_tz: form.schedule_tz || 'UTC',
      priority: parseInt(form.priority, 10) || 0,
    }
    if (editing) {
      api.put(`/api/rules/${editing}`, payload).then(() => { load(); setEditing(null) }).catch((err) => setError(err.message))
    } else {
      api.post('/api/rules', payload).then(() => { load(); openCreate(); setError(null) }).catch((err) => setError(err.message))
    }
  }

  const toggleRule = (id) => {
    api.patch(`/api/rules/${id}/toggle`).then(load).catch((err) => setError(err.message))
  }

  const deleteRule = (id) => {
    if (!confirm('Удалить правило?')) return
    api.delete(`/api/rules/${id}`).then(() => { load(); setEditing(null) }).catch((err) => setError(err.message))
  }

  if (loading) return <div className="card">Загрузка…</div>

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <h2>Правила</h2>
        <div style={{ marginBottom: '1rem' }}>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Создать
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Активно</th>
                <th>Список</th>
                <th>Действие</th>
                <th>max_time_sec</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td><span className={`badge ${r.is_active ? 'badge-on' : 'badge-off'}`}>{r.is_active ? 'Да' : 'Нет'}</span></td>
                  <td>{r.target_list || '—'}</td>
                  <td>{r.action_type}</td>
                  <td>{r.max_time_sec ?? '—'}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleRule(r.id)}>Вкл/Выкл</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>Изменить</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteRule(r.id)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <p className="empty-state">Нет правил</p>}
      </div>

      {(editing !== null || (editing === null && form.name !== '')) && (
        <div className="card">
          <h2>{editing ? 'Редактировать правило' : 'Новое правило'}</h2>
          <form onSubmit={saveRule}>
            <div className="form-row">
              <div className="form-group">
                <label>Название *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Действие</label>
                <select value={form.action_type} onChange={(e) => setForm({ ...form, action_type: e.target.value })}>
                  {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Описание</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Список (whitelist/blacklist)</label>
                <select value={form.target_list} onChange={(e) => setForm({ ...form, target_list: e.target.value })}>
                  {TARGET_LIST_OPTIONS.map((o) => <option key={o || 'none'} value={o}>{o || '—'}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>channel_ids (через запятую)</label>
                <input value={form.channel_ids} onChange={(e) => setForm({ ...form, channel_ids: e.target.value })} placeholder="123, 456" />
              </div>
              <div className="form-group">
                <label>max_time_sec</label>
                <input type="number" value={form.max_time_sec} onChange={(e) => setForm({ ...form, max_time_sec: e.target.value })} placeholder="60" />
              </div>
              <div className="form-group">
                <label>Приоритет</label>
                <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>schedule_cron</label>
                <input value={form.schedule_cron} onChange={(e) => setForm({ ...form, schedule_cron: e.target.value })} />
              </div>
              <div className="form-group">
                <label>schedule_tz</label>
                <input value={form.schedule_tz} onChange={(e) => setForm({ ...form, schedule_tz: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>action_params (JSON)</label>
              <textarea rows={3} value={form.action_params} onChange={(e) => setForm({ ...form, action_params: e.target.value })} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Активно
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">Сохранить</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setEditing(null); setForm({ ...form, name: '' }) }}>Отмена</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
