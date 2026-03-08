import client from './client'

export const getKickTargets = () => client.get('/kick-targets').then(r => r.data)
export const createKickTarget = (data) => client.post('/kick-targets', data).then(r => r.data)
export const updateKickTarget = (discordId, data) => client.patch(`/kick-targets/${discordId}`, data).then(r => r.data)
export const deleteKickTarget = (discordId) => client.delete(`/kick-targets/${discordId}`)
