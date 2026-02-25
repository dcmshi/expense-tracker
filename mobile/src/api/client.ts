import axios, { AxiosError, AxiosResponse } from 'axios'

export interface ApiError {
  status: number
  message: string
  details?: unknown
}

const client = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Log outgoing requests in development
if (__DEV__) {
  client.interceptors.request.use((config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
      params: config.params,
      data: config.data,
    })
    return config
  })
}

// Normalise error responses to ApiError
client.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const apiError: ApiError = {
      status: error.response?.status ?? 0,
      message:
        (error.response?.data as { error?: string })?.error ??
        error.message ??
        'Unknown error',
      details: error.response?.data,
    }
    return Promise.reject(apiError)
  },
)

export default client
