import client from './client'

export const getLogs = (params) => client.get('/logs', { params }).then(r => r.data)

export const exportCsv = (filters) => {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v != null && v !== ''))
  )
  window.open(`/api/logs/export?${params}`)
}
