import axios from 'axios'

const client = axios.create({ baseURL: '/api' })

client.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  }
)

export default client
