/**
 * 工作流管理系统 - TypeScript 类型定义
 * 基于 API 设计文档 v1.0
 */

// ==================== 枚举定义 ====================

/**
 * 工作流状态
 */
export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TERMINATED = 'terminated'
}

/**
 * 步骤状态
 */
export enum StepStatus {
  PENDING = 'pending',
  READY = 'ready',
  ASSIGNED = 'assigned',
  RUNNING = 'running',
  AWAITING_REVIEW = 'awaiting_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETRYING = 'retrying',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped'
}

/**
 * 审核动作
 */
export enum ReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  REQUEST_CHANGES = 'request_changes'
}

/**
 * Agent 状态
 */
export enum AgentStatus {
  ONLINE = 'online',
  DEGRADED = 'degraded',
  OFFLINE = 'offline'
}

/**
 * 模板状态
 */
export enum TemplateStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

/**
 * 失败策略
 */
export enum FailureStrategy {
  RETRY = 'retry',
  SKIP = 'skip',
  ESCALATE = 'escalate',
  TERMINATE = 'terminate'
}

/**
 * 执行模式
 */
export enum ExecutionMode {
  STANDARD = 'standard',
  FAST_TRACK = 'fast_track',
  DEBUG = 'debug'
}

// ==================== 通用类型 ====================

/**
 * 分页请求参数
 */
export interface PaginationParams {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * 成功响应
 */
export interface SuccessResponse {
  success: boolean;
  message?: string;
}

// ==================== DAG 相关类型 ====================

/**
 * DAG 步骤定义
 */
export interface DAGStep {
  id: string;
  name: string;
  agent: string;
  capabilities?: string[];
  estimated_duration?: number;
  output?: string;
  validation?: string[];
  human_review?: boolean;
  depends_on: string[];
}

/**
 * DAG 边定义
 */
export interface DAGEdge {
  source: string;
  target: string;
}

/**
 * DAG 结构
 */
export interface DAG {
  steps: DAGStep[];
  edges: DAGEdge[];
}

/**
 * 工作流配置
 */
export interface WorkflowConfig {
  single_step_timeout?: number;
  workflow_timeout?: number;
  max_retries?: number;
  failure_strategy?: FailureStrategy;
}

// ==================== 工作流模板相关类型 ====================

/**
 * 工作流模板（列表项）
 */
export interface WorkflowTemplateListItem {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: TemplateStatus;
  usage_count: number;
  tags?: string[];
  created_at: string;
  created_by: string;
  updated_at: string;
  published_at?: string;
  step_count: number;
}

/**
 * 工作流模板（详情）
 */
export interface WorkflowTemplate extends WorkflowTemplateListItem {
  dag: DAG;
  config: WorkflowConfig;
  steps: Array<{
    id: string;
    name: string;
    agent: string;
    estimated_duration?: number;
    human_review?: boolean;
  }>;
}

/**
 * 创建模板请求
 */
export interface CreateTemplateRequest {
  name: string;
  description?: string;
  dag: DAG;
  config?: WorkflowConfig;
  tags?: string[];
}

/**
 * 更新模板请求
 */
export interface UpdateTemplateRequest extends CreateTemplateRequest {}

/**
 * 模板列表查询参数
 */
export interface TemplateListParams extends PaginationParams {
  status?: TemplateStatus;
  search?: string;
  tags?: string;
  created_by?: string;
}

/**
 * 模板版本
 */
export interface TemplateVersion {
  version: string;
  change_summary: string;
  created_at: string;
  created_by: string;
}

// ==================== 工作流实例相关类型 ====================

/**
 * 当前步骤信息
 */
export interface CurrentStep {
  step_id: string;
  name: string;
  status: StepStatus;
  agent_name: string;
  progress?: number;
}

/**
 * 工作流实例（列表项）
 */
export interface WorkflowInstanceListItem {
  id: string;
  template_id: string;
  template_name: string;
  template_version: string;
  status: WorkflowStatus;
  input: Record<string, any>;
  output?: Record<string, any>;
  progress: number;
  estimated_remaining?: number;
  created_at: string;
  created_by: string;
  started_at?: string;
  completed_at?: string;
  duration?: number;
  current_step?: CurrentStep;
}

/**
 * 步骤执行记录
 */
export interface StepExecution {
  id: string;
  step_id: string;
  name: string;
  status: StepStatus;
  agent_id?: string;
  agent_name?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  progress?: number;
  progress_message?: string;
  started_at?: string;
  completed_at?: string;
  duration?: number;
  retry_count: number;
  max_retries?: number;
  error_message?: string;
  force_completed?: boolean;
  human_review?: boolean;
}

/**
 * 工作流实例（详情）
 */
export interface WorkflowInstance extends WorkflowInstanceListItem {
  error_message?: string;
  termination_reason?: string;
  steps: StepExecution[];
}

/**
 * 启动工作流请求
 */
export interface StartWorkflowRequest {
  template_id: string;
  input: Record<string, any>;
  execution_mode?: ExecutionMode;
}

/**
 * 终止工作流请求
 */
export interface TerminateWorkflowRequest {
  reason: string;
}

/**
 * 工作流实例列表查询参数
 */
export interface WorkflowListParams extends PaginationParams {
  status?: WorkflowStatus;
  template_id?: string;
  created_by?: string;
  start_date?: string;
  end_date?: string;
}

/**
 * 日志条目
 */
export interface LogEntry {
  id: string;
  step_execution_id?: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  metadata?: Record<string, any>;
}

/**
 * 日志查询参数
 */
export interface LogQueryParams {
  level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  step_id?: string;
  start_time?: string;
  end_time?: string;
  search?: string;
  limit?: number;
}

/**
 * 事件时间线条目
 */
export interface TimelineEvent {
  id: string;
  event_type: string;
  timestamp: string;
  actor_type: 'user' | 'agent' | 'system';
  actor_id: string;
  event_data: Record<string, any>;
}

// ==================== 步骤执行相关类型 ====================

/**
 * 审核信息
 */
export interface ReviewInfo {
  id: string;
  reviewer_id: string;
  reviewer_name: string;
  action?: ReviewAction;
  timeout_at: string;
  remaining_time: number;
}

/**
 * 产出物信息
 */
export interface Artifact {
  id: string;
  name: string;
  artifact_type: string;
  size_bytes: number;
  storage_path?: string;
  download_url?: string;
  preview_url?: string;
}

/**
 * 步骤详情（扩展）
 */
export interface StepExecutionDetail extends StepExecution {
  workflow_instance_id: string;
  review?: ReviewInfo;
  artifacts?: Artifact[];
}

/**
 * 重试步骤请求
 */
export interface RetryStepRequest {
  // 无需参数
}

/**
 * 跳过步骤请求
 */
export interface SkipStepRequest {
  reason: string;
}

/**
 * 强制完成步骤请求
 */
export interface ForceCompleteStepRequest {
  reason: string;
  output?: Record<string, any>;
}

/**
 * 重新分配 Agent 请求
 */
export interface ReassignAgentRequest {
  agent_id: string;
}

/**
 * 上报进度请求
 */
export interface ReportProgressRequest {
  progress: number;
  message?: string;
  estimated_remaining?: number;
}

/**
 * 步骤输出
 */
export interface StepOutput {
  output: Record<string, any>;
  artifacts: Artifact[];
}

/**
 * 步骤输入
 */
export interface StepInput {
  input: Record<string, any>;
  dependencies: Array<{
    step_id: string;
    step_name: string;
    output: Record<string, any>;
  }>;
}

// ==================== 人工审核相关类型 ====================

/**
 * 审核输出
 */
export interface ReviewOutput {
  summary: string;
  files?: Array<{
    name: string;
    size_bytes: number;
    preview_url?: string;
    download_url?: string;
    id?: string;
  }>;
  reasoning?: string;
  dependencies?: Array<{
    step_id: string;
    step_name: string;
    output_summary: string;
  }>;
}

/**
 * 审核记录（列表项）
 */
export interface ReviewListItem {
  id: string;
  workflow_instance_id: string;
  workflow_name: string;
  step_execution_id: string;
  step_name: string;
  reviewer_id: string;
  reviewer_name: string;
  created_at: string;
  timeout_at: string;
  remaining_time: number;
  review_round: number;
  outputs: ReviewOutput;
}

/**
 * 审核历史
 */
export interface ReviewHistory {
  round: number;
  action: ReviewAction;
  comment: string;
  created_at: string;
  reviewer_name: string;
}

/**
 * 审核记录（详情）
 */
export interface ReviewDetail extends ReviewListItem {
  action?: ReviewAction;
  comment?: string;
  updated_at: string;
  timeout_action?: string;
  history?: ReviewHistory[];
}

/**
 * 审核请求
 */
export interface ReviewRequest {
  comment: string;
}

/**
 * 审核列表查询参数
 */
export interface ReviewListParams extends PaginationParams {
  reviewer_id?: string;
}

/**
 * 审核统计
 */
export interface ReviewStats {
  total_pending: number;
  total_completed_today: number;
  timeout_warnings: number;
  avg_review_time_seconds: number;
  by_action: Record<ReviewAction, number>;
}

// ==================== Agent 管理相关类型 ====================

/**
 * Agent 当前任务
 */
export interface AgentCurrentTask {
  workflow_instance_id: string;
  step_execution_id: string;
  step_name: string;
  progress?: number;
}

/**
 * Agent 统计
 */
export interface AgentStatistics {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  avg_task_duration: number;
  success_rate: number;
}

/**
 * Agent（列表项）
 */
export interface AgentListItem {
  id: string;
  name: string;
  display_name: string;
  capabilities: string[];
  status: AgentStatus;
  current_task_id?: string;
  current_workflow_instance_id?: string;
  current_step_execution_id?: string;
  last_heartbeat: string;
  created_at: string;
}

/**
 * Agent（详情）
 */
export interface AgentDetail extends AgentListItem {
  current_task?: AgentCurrentTask;
  config?: Record<string, any>;
  metadata?: Record<string, any>;
  statistics: AgentStatistics;
  updated_at: string;
}

/**
 * Agent 列表查询参数
 */
export interface AgentListParams {
  status?: AgentStatus;
  capability?: string;
  search?: string;
}

/**
 * 批量清理请求
 */
export interface BatchCleanupRequest {
  agent_ids: string[];
}

/**
 * Agent 负载统计
 */
export interface AgentLoadStats {
  agent_id: string;
  agent_name: string;
  status: AgentStatus;
  current_tasks: number;
  running_tasks: number;
  avg_task_duration: number;
}

/**
 * Agent 负载统计响应
 */
export interface AgentLoadStatsResponse {
  data: AgentLoadStats[];
  total_agents: number;
  online_agents: number;
  offline_agents: number;
}

// ==================== 统计与监控相关类型 ====================

/**
 * 工作流统计
 */
export interface WorkflowStats {
  total: number;
  by_status: Record<WorkflowStatus, number>;
  success_rate: number;
  avg_duration_seconds: number;
  by_template: Array<{
    template_id: string;
    template_name: string;
    count: number;
    success_rate: number;
    avg_duration_seconds: number;
  }>;
  time_series: Array<{
    date: string;
    total: number;
    completed: number;
    failed: number;
  }>;
}

/**
 * Agent 统计汇总
 */
export interface AgentStatsSummary {
  total_agents: number;
  online_agents: number;
  offline_agents: number;
  by_agent: Array<{
    agent_id: string;
    agent_name: string;
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    success_rate: number;
    avg_task_duration: number;
    total_tokens: number;
    estimated_cost_usd: number;
  }>;
  total_tasks: number;
  total_tokens: number;
  total_cost_usd: number;
}

/**
 * 任务统计
 */
export interface TaskStats {
  total: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  avg_duration_seconds: number;
  time_series: Array<{
    date: string;
    total: number;
    completed: number;
    failed: number;
  }>;
}

/**
 * 系统健康检查
 */
export interface HealthCheck {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  components: {
    database: string;
    redis: string;
    gateway: string;
    agents: {
      online: number;
      offline: number;
    };
  };
  version: string;
}

/**
 * 审核统计汇总
 */
export interface ReviewStatsSummary {
  total: number;
  pending: number;
  by_action: Record<ReviewAction, number>;
  avg_review_time_seconds: number;
  timeout_count: number;
  by_reviewer: Array<{
    reviewer_id: string;
    reviewer_name: string;
    total_reviews: number;
    avg_review_time_seconds: number;
  }>;
}

/**
 * 统计查询参数
 */
export interface StatsQueryParams {
  start_date?: string;
  end_date?: string;
  template_id?: string;
}

// ==================== WebSocket 事件类型 ====================

/**
 * WebSocket 订阅消息
 */
export interface WSSubscribeMessage {
  action: 'subscribe' | 'unsubscribe';
  channel: string;
}

/**
 * WebSocket 事件
 */
export interface WSEvent<T = any> {
  event: string;
  channel: string;
  timestamp: string;
  data: T;
}

/**
 * 工作流事件数据
 */
export interface WorkflowEventData {
  workflow_id: string;
  template_name?: string;
  created_by?: string;
  current_step?: CurrentStep;
  duration?: number;
  progress?: number;
}

/**
 * 步骤事件数据
 */
export interface StepEventData {
  workflow_id: string;
  step_id: string;
  step_name?: string;
  agent_id?: string;
  agent_name?: string;
  progress?: number;
  message?: string;
  estimated_remaining?: number;
  duration?: number;
  output?: Record<string, any>;
  review_id?: string;
  reviewer_id?: string;
  timeout_at?: string;
}

/**
 * 审核事件数据
 */
export interface ReviewEventData {
  review_id: string;
  workflow_id: string;
  step_name?: string;
  reviewer_id: string;
  timeout_at?: string;
  remaining_time?: number;
  comment?: string;
}

/**
 * Agent 事件数据
 */
export interface AgentEventData {
  agent_id: string;
  agent_name?: string;
  workflow_id?: string;
  step_id?: string;
  step_name?: string;
}

// ==================== React Flow 节点类型 ====================

/**
 * DAG 节点数据
 */
export interface DAGNodeData {
  label: string;
  status: StepStatus;
  agent: string;
  progress?: number;
  human_review?: boolean;
  estimated_duration?: number;
}

/**
 * DAG 节点
 */
export interface DAGNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: DAGNodeData;
}

/**
 * DAG 边（用于 React Flow）
 */
export interface DAGFlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
}
