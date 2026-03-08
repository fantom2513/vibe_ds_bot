import client from './client'

export const membersApi = {
  search: (q = '', limit = 50) => client.get('/members', { params: { q, limit } }).then(r => r.data),
  getOne: (id) => client.get(`/members/${id}`).then(r => r.data),
  batch: (ids) => client.post('/members/batch', ids).then(r => r.data),
}
