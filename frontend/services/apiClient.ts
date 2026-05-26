/*
API Client Service
Handles all HTTP communication with backend
*/

import axios, { AxiosInstance, AxiosError } from 'axios'
import { API_BASE_URL } from '@/lib/constants'

class APIClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        console.error('API Error:', error)
        throw error
      }
    )
  }

  // Generic GET
  async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    return this.client.get<T, T>(url, { params })
  }

  // Generic POST
  async post<T>(url: string, data?: any): Promise<T> {
    return this.client.post<T, T>(url, data)
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    return this.get('/health')
  }

  // API Info
  async apiInfo(): Promise<any> {
    return this.get('/api')
  }
}

export const apiClient = new APIClient()
