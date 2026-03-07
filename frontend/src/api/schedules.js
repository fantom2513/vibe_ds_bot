import client from './client'

export const getSchedules = () => client.get('/schedules').then(r => r.data)
export const createSchedule = (data) => client.post('/schedules', data).then(r => r.data)
export const updateSchedule = (id, data) => client.patch(`/schedules/${id}`, data).then(r => r.data)
export const deleteSchedule = (id) => client.delete(`/schedules/${id}`)
