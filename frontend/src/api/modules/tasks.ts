import { apiGet, apiPost, apiPut, apiDelete } from '../client'

export interface TaskItem {
  id: string
  title: string
  description?: string
  projectId: string
  category: string
  phase: string
  priority: string
  status: string
  ownerRole: string
  ownerAgentId?: string
  riskLevel: string
  docSyncRisk: string
  updatedAt: string
}

export interface TaskListResponse {
  items: TaskItem[]
  total: number
}

export const tasksApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return apiGet<TaskListResponse>(`/tasks${qs}`)
  },
  get: (id: string) => apiGet<TaskItem>(`/tasks/${id}`),
  create: (data: { project_id: string; title: string; category: string; priority?: string; status?: string; phase?: string; owner_role?: string }) =>
    apiPost<TaskItem>('/tasks', data),
  update: (id: string, data: Record<string, string>) =>
    apiPut<TaskItem>(`/tasks/${id}`, data),
  delete: (id: string) => apiDelete(`/tasks/${id}`),
  action: (id: string, action: string) => {
    // Map action to status and priority changes
    const statusMap: Record<string, { status?: string; priority?: string }> = {
      start: { status: 'in_progress' },
      review: { status: 'review' },
      complete: { status: 'done' },
      reject: { status: 'planned', priority: 'low' },
      restart: { status: 'planned' },
      block: { status: 'blocked' },
    }
    const updates = statusMap[action] || {}
    return apiPut<TaskItem>(`/tasks/${id}`, updates)
  },
}
