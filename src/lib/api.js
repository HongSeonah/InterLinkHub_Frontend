import axios from 'axios'
import { clearToken, getToken } from './auth'

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? '' : 'http://13.209.75.91:8080')

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearToken()
    }
    return Promise.reject(error)
  },
)

export async function apiGet(path, config) {
  const response = await api.get(path, config)
  return response.data?.data
}

export async function apiPost(path, body, config) {
  const response = await api.post(path, body, config)
  return response.data?.data
}

export async function apiPut(path, body, config) {
  const response = await api.put(path, body, config)
  return response.data?.data
}

export async function apiDelete(path, config) {
  const response = await api.delete(path, config)
  return response.data?.data
}

export async function apiPatch(path, body, config) {
  const response = await api.patch(path, body, config)
  return response.data?.data
}
