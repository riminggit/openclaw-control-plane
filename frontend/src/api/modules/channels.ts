import { apiGet, apiPost, apiPatch } from '../client'

export interface Channel {
  type: string
  name: string
  icon?: string
  status: 'connected' | 'disconnected' | 'unconfigured'
  config?: Record<string, string>
  enabled?: boolean
  plugin_loaded?: boolean
}

interface RawChannel {
  type: string
  enabled?: boolean
  config?: Record<string, string>
  plugin_loaded?: boolean
}

function normalizeChannel(raw: RawChannel): Channel {
  return {
    ...raw,
    name: raw.type,
    status: raw.enabled ? 'connected' as const : raw.plugin_loaded ? 'disconnected' as const : 'unconfigured' as const,
  }
}

export const channelsApi = {
  list: () => apiGet<{ channels: RawChannel[]; total: number }>('/channels/list').then(d => (d.channels || []).map(normalizeChannel)),
  status: () => apiGet<{ channels: RawChannel[] }>('/channels/status').then(d => (d.channels || []).map(normalizeChannel)),
  save: (type: string, config: Record<string, string>) => apiPatch<Channel>(`/channels/${type}`, config as unknown as Record<string, unknown>),
  test: (type: string) => apiPost<{ success: boolean; message?: string }>(`/channels/${type}/test`, {}),
}
