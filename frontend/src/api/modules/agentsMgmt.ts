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
  workspace?: string
}

interface RawAgent {
  id: string
  name: string
  config?: {
    model?: string | { primary?: string; fallbacks?: string[] }
    workspace?: string
    agentDir?: string
    subagents?: { allowAgents: string[] }
    [key: string]: unknown
  }
}

function normalizeAgent(raw: RawAgent): Agent {
  const model = raw.config?.model
  return {
    id: raw.id,
    name: raw.name,
    description: raw.name,
    model: typeof model === 'string' ? model : model?.primary || 'unknown',
    status: 'online' as const,
    channels: [],
    workspace: raw.config?.workspace,
  }
}

export const agentsMgmtApi = {
  list: () => apiGet<{ agents: RawAgent[]; total: number }>('/agents-mgmt/list')
    .then(d => (d.agents || []).map(normalizeAgent)),
  create: (data: Partial<Agent>) => apiPost<Agent>('/agents-mgmt', data as Record<string, unknown>),
  update: (id: string, data: Partial<Agent>) => apiPatch<Agent>(`/agents-mgmt/${id}`, data as Record<string, unknown>),
  remove: (id: string) => apiDelete(`/agents-mgmt/${id}`),
}
