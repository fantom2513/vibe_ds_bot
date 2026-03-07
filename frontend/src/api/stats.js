import client from './client'

export const getStatsOverview = () => client.get('/stats/overview').then(r => r.data)
export const getBotInfo = () => client.get('/settings/bot-info').then(r => r.data)
export const getAllowedUsers = () => client.get('/settings/allowed-users').then(r => r.data)
