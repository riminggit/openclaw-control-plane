import { apiGet, apiPost, apiDelete } from '../client'

export interface ProjectItem {
  id: string
  code: string
  name: string
  status: string
  ownerRole: string
  taskCount: number
  blockedTaskCount: number
  archiveFolderToken?: string
  updatedAt: string
}

export interface ProjectListResponse {
  items: ProjectItem[]
  total: number
}

export const projectsApi = {
  list: () => apiGet<ProjectListResponse>('/projects'),
  get: (id: string) => apiGet<ProjectItem>(`/projects/${id}`),
  create: (data: { name: string; code: string; description?: string }) =>
    apiPost<ProjectItem>('/projects', data),
  delete: (id: string) => apiDelete(`/projects/${id}`),
}
