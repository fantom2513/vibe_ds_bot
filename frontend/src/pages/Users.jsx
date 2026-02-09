import { useState, useEffect } from 'react'
import { api } from '../api/client'

const LIST_TYPES = ['whitelist', 'blacklist']

export default function Users() {
  const [listType, setListType] = useState('blacklist')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ discord_id: '', username: '', reason: '' })
  const [bulkText, setBulkText] = useState('')

  const load = () => {
    setLoading(true)
    api.get(`/api/users?list_type=${listType}`)
      .then(setList)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [listType])

  const addUser = (e) => {
    e.preventDefault()
    const discordId = parseInt(form.discord_id, 10)
    if (isNaN(discordId)) {
      setError('discord_id должен быть числом')
      return
    }
    api.post('/api/users', {
      discord_id: discordId,
      list_type: listType,
      username: form.username || null,
      reason: form.reason || null,
    })
      .then(() => { load(); setForm({ discord_id: '', username: '', reason: '' }); setError(null) })
      .catch((err) => setError(err.message))
  }

  const removeUser = (discordId) => {
    if (!confirm(`Удалить ${discordId} из ${listType}?`)) return
    api.delete(`/api/users/${discordId}?list_type=${listType}`)
      .then(load)
      .catch((err) => setError(err.message))
  }

  const bulkAdd = (e) => {
    e.preventDefault()
    const lines = bulkText.trim().split(/\n/).filter(Boolean)
    const entries = lines.map((line) => {
      const parts = line.split(/[\t,;]+/).map((s) => s.trim())
      const discord_id = parseInt(parts[0], 10)
      return {
        discord_id: isNaN(discord_id) ? 0 : discord_id,
        list_type: listType,
        username: parts[1] || null,
        reason: parts[2] || null,
      }
    }).filter((e) => !isNaN(e.discord_id) && e.discord_id > 0)
    if (!entries.length) {
      setError('Нет валидных строк (формат: discord_id, username, reason)')
      return
    }
    api.post('/api/users/bulk', { entries })
      .then(() => { load(); setBulkText(''); setError(null) })
      .catch((err) => setError(err.message))
  }

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <h2>Whitelist / Blacklist</h2>
        <div className="form-group">
          <label>Тип списка</label>
          <select value={listType} onChange={(e) => setListType(e.target.value)}>
            {LIST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Добавить пользователя</h3>
          <form onSubmit={addUser} className="form-row">
            <div className="form-group">
              <label>discord_id *</label>
              <input type="number" value={form.discord_id} onChange={(e) => setForm({ ...form, discord_id: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="form-group">
              <label>reason</label>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">Добавить</button>
            </div>
          </form>
        </div>
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Массовое добавление</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Строки: discord_id, username, reason (разделитель — запятая, табуляция или точка с запятой)</p>
          <form onSubmit={bulkAdd}>
            <div className="form-group">
              <textarea rows={4} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="123456789, User1, причина" />
            </div>
            <button type="submit" className="btn btn-secondary">Добавить всех</button>
          </form>
        </div>
        <h3 style={{ margin: '1.5rem 0 0.75rem', fontSize: '1rem' }}>Текущий список: {listType}</h3>
        {loading ? <p>Загрузка…</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>discord_id</th>
                  <th>username</th>
                  <th>reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={`${u.discord_id}-${u.list_type}`}>
                    <td>{u.discord_id}</td>
                    <td>{u.username || '—'}</td>
                    <td>{u.reason || '—'}</td>
                    <td>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeUser(u.discord_id)}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && list.length === 0 && <p className="empty-state">Список пуст</p>}
      </div>
    </>
  )
}
