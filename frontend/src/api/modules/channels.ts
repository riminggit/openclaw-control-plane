import { apiGet, apiPost, apiPatch } from '../client'

export interface Channel {
  type: string
  name: string
  icon?: string
  status: 'connected' | 'disconnected' | 'unconfigured'
  config?: Record<string, string>
}

export const channelsApi = {
  list: () => apiGet<Channel[]>('/channels/list'),
  status: () => apiGet<Channel[]>('/channels/status'),
  save: (type: string, config: Record<string, string>) => apiPatch<Channel>(`/channels/${type}`, config as unknown as Record<string, unknown>),
  test: (type: string) => apiPost<{ success: boolean; message?: string }>(`/channels/${type}/test`, {}),
}
