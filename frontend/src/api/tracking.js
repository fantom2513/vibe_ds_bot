import client from './client'

export const listTrackedMembers = () => client.get('/tracking/members').then(r => r.data)
export const createTrackedMember = data => client.post('/tracking/members', data).then(r => r.data)
export const updateTrackedMember = (discordId, data) =>
  client.patch(`/tracking/members/${discordId}`, data).then(r => r.data)
export const deleteTrackedMember = discordId => client.delete(`/tracking/members/${discordId}`)
export const getTrackingSettings = () => client.get('/tracking/settings').then(r => r.data)
export const setTrackingSettings = data => client.patch('/tracking/settings', data).then(r => r.data)
export const listTextChannels = () => client.get('/tracking/text-channels').then(r => r.data)
export const previewTrackingReport = period =>
  client.get('/tracking/preview', { params: { period } }).then(r => r.data)
