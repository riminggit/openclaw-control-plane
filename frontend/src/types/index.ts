// ===== Generic API Types =====

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface ApiError {
  status: number
  message: string
  details?: Record<string, string[]>
}

// ===== Enums =====

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'ON_HOLD'
export type TaskStatus = 'PLANNED' | 'IN_PROGRESS' | 'REVIEW' | 'BLOCKED' | 'DONE'
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'
export type ReviewType = 'CODE_REVIEW' | 'DESIGN_REVIEW' | 'TEST_REVIEW' | 'DEPLOY_REVIEW'
export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'ERROR'
export type DispatchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type ArtifactType = 'CODE' | 'DOCUMENT' | 'DESIGN' | 'TEST_REPORT' | 'BUILD'
export type AdapterStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
export type LogLevel = 'stdout' | 'stderr'

// ===== Project =====

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  created_at: string
  updated_at: string
  metadata?: Record<string, unknown>
}

export interface CreateProjectRequest {
  name: string
  description: string
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
  status?: ProjectStatus
}

// ===== Task =====

export interface Task {
  id: string
  project_id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee_id?: string
  assignee_name?: string
  blocked_by: string[]
  depends_on: string[]
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
}

export interface CreateTaskRequest {
  project_id: string
  title: string
  description: string
  priority: TaskPriority
  status?: TaskStatus
  assignee_id?: string
  depends_on?: string[]
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee_id?: string
  depends_on?: string[]
}

export interface TaskFilters {
  project_id?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee_id?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  search?: string
}

// ===== Agent =====

export interface Agent {
  id: string
  name: string
  type: string
  status: AgentStatus
  capabilities: string[]
  current_task_id?: string
  current_task_title?: string
  last_heartbeat: string
  metadata?: Record<string, unknown>
}

// ===== Review =====

export interface Review {
  id: string
  task_id: string
  task_title?: string
  type: ReviewType
  status: ReviewStatus
  reviewer_id?: string
  reviewer_name?: string
  submitter_id?: string
  submitter_name?: string
  content: string
  result?: string
  created_at: string
  updated_at: string
  reviewed_at?: string
}

export interface CreateReviewRequest {
  task_id: string
  type: ReviewType
  content: string
}

export interface ReviewActionRequest {
  status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'
  result?: string
}

// ===== Dispatch =====

export interface Dispatch {
  id: string
  task_id: string
  task_title?: string
  agent_id: string
  agent_name?: string
  status: DispatchStatus
  started_at?: string
  completed_at?: string
  error_message?: string
  logs_url?: string
}

export interface CreateDispatchRequest {
  task_id: string
  agent_id: string
}

// ===== Artifact =====

export interface Artifact {
  id: string
  task_id: string
  task_title?: string
  type: ArtifactType
  name: string
  url: string
  size?: number
  sync_status: 'SYNCED' | 'SYNCING' | 'FAILED' | 'PENDING'
  created_at: string
  metadata?: Record<string, unknown>
}

// ===== Dashboard =====

export interface DashboardStats {
  total_projects: number
  active_tasks: number
  blocked_tasks: number
  pending_reviews: number
  online_agents: number
  total_agents: number
}

export interface ActivityItem {
  id: string
  type: 'task_status_changed' | 'review_submitted' | 'agent_status_changed' | 'dispatch_status_changed'
  description: string
  timestamp: string
  actor?: string
  metadata?: Record<string, unknown>
}

export interface RiskItem {
  task_id: string
  task_title: string
  project_id: string
  risk_type: 'BLOCKED' | 'OVERDUE' | 'HIGH_PRIORITY'
  description: string
  severity: 'high' | 'medium' | 'low'
}

// ===== Adapter =====

export interface Adapter {
  id: string
  name: string
  type: string
  status: AdapterStatus
  config: Record<string, unknown>
  last_sync_at?: string
  error_message?: string
  created_at: string
  updated_at: string
}

// ===== WebSocket Events =====

export interface WsEvent {
  type: string
  timestamp: string
  data: Record<string, unknown>
}

export interface LogEntry {
  type: 'log' | 'adapter_lost' | 'keep_alive'
  timestamp: string
  level: LogLevel
  content: string
  sequence_id: number
}

// ===== Notification =====

export interface Notification {
  id: string
  type: string
  title: string
  content: string
  read: boolean
  created_at: string
}
