import client from './client'

export const getRules = () => client.get('/rules').then(r => r.data)
export const createRule = (data) => client.post('/rules', data).then(r => r.data)
export const updateRule = (id, data) => client.put(`/rules/${id}`, data).then(r => r.data)
export const patchRule = (id, data) => client.patch(`/rules/${id}`, data).then(r => r.data)
export const deleteRule = (id) => client.delete(`/rules/${id}`)
export const toggleRule = (id) => client.patch(`/rules/${id}/toggle`).then(r => r.data)
