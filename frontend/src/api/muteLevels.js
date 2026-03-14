import client from './client'

export const getMuteLevels = () => client.get('/mute-levels').then(r => r.data)
export const createMuteLevel = (data) => client.post('/mute-levels', data).then(r => r.data)
export const updateMuteLevel = (level, data) => client.patch(`/mute-levels/${level}`, data).then(r => r.data)
export const deleteMuteLevel = (level) => client.delete(`/mute-levels/${level}`)

export const getMuteLeaderboard = () => client.get('/mute-xp/leaderboard').then(r => r.data)
export const getMuteXP = (discordId) => client.get(`/mute-xp/${discordId}`).then(r => r.data)
export const adjustMuteXP = (discordId, xp) => client.patch(`/mute-xp/${discordId}`, { xp }).then(r => r.data)

export const getGuildRoles = () => client.get('/guild/roles').then(r => r.data)

export const getDebugMode = () => client.get('/settings/debug-mode').then(r => r.data)
export const setDebugMode = (enabled) => client.patch('/settings/debug-mode', { enabled }).then(r => r.data)
