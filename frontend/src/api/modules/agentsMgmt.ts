import { apiGet, apiPost, apiPatch, apiDelete } from '../client'

export interface Agent {
  id: string
  name: string
  description?: string
  model: string
  thinking?: boolean
  systemPrompt?: string
  status?: 'online' | 'offline'
  channels?: string[]
  createdAt?: string
  updatedAt?: string
}

export const agentsMgmtApi = {
  list: () => apiGet<Agent[]>('/agents-mgmt/list'),
  create: (data: Partial<Agent>) => apiPost<Agent>('/agents-mgmt', data as Record<string, unknown>),
  update: (id: string, data: Partial<Agent>) => apiPatch<Agent>(`/agents-mgmt/${id}`, data as Record<string, unknown>),
  remove: (id: string) => apiDelete(`/agents-mgmt/${id}`),
}
