import client from './client'

export const getStackingPairs = () => client.get('/stacking-pairs').then(r => r.data)
export const createStackingPair = (data) => client.post('/stacking-pairs', data).then(r => r.data)
export const toggleStackingPair = (id) => client.patch(`/stacking-pairs/${id}/toggle`).then(r => r.data)
export const deleteStackingPair = (id) => client.delete(`/stacking-pairs/${id}`)
