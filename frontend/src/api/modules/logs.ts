import { apiGet } from '../client'

export interface LogLine {
  timestamp?: string
  level?: string
  message: string
  source?: string
}

export const logsApi = {
  tail: (source: string, lines = 200) => apiGet<string>(`/logs/tail?source=${source}&lines=${lines}`),
  search: (q: string, source: string) => apiGet<string>(`/logs/search?q=${encodeURIComponent(q)}&source=${source}`),
  sources: () => apiGet<string[]>('/logs/sources'),
}
