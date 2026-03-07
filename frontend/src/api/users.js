import client from './client'

export const getUsers = (list_type) => client.get('/users', { params: { list_type } }).then(r => r.data)
export const addUser = (data) => client.post('/users', data).then(r => r.data)
export const deleteUser = (discord_id, list_type) =>
  client.delete(`/users/${discord_id}`, { params: { list_type } })
