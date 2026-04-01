"""
Workflow Management Schemas

Pydantic schemas for workflow management API.
Based on docs/design/workflow-api-design.md
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from enum import Enum


# ============================================================
# Enums
# ============================================================

class WorkflowStatus(str, Enum):
    """工作流状态"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    TERMINATED = "terminated"


class StepStatus(str, Enum):
    """步骤状态"""
    PENDING = "pending"
    READY = "ready"
    ASSIGNED = "assigned"
    RUNNING = "running"
    AWAITING_REVIEW = "awaiting_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETRYING = "retrying"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class ReviewAction(str, Enum):
    """审核动作"""
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_CHANGES = "request_changes"


class AgentStatus(str, Enum):
    """Agent状态"""
    ONLINE = "online"
    DEGRADED = "degraded"
    OFFLINE = "offline"


class TemplateStatus(str, Enum):
    """模板状态"""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


# ============================================================
# Common Schemas
# ============================================================

class PaginationParams(BaseModel):
    """分页参数"""
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")


class PaginatedResponse(BaseModel):
    """分页响应"""
    total: int = Field(..., description="总数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")
    total_pages: int = Field(..., description="总页数")


class ErrorResponse(BaseModel):
    """错误响应"""
    error: Dict[str, Any] = Field(..., description="错误信息")


# ============================================================
# Workflow Template Schemas
# ============================================================

class StepNode(BaseModel):
    """DAG中的步骤节点"""
    id: str = Field(..., description="步骤 ID")
    name: str = Field(..., description="步骤名称")
    agent: Optional[str] = Field(None, description="Agent 名称或 ID")
    capabilities: Optional[List[str]] = Field(None, description="Agent 能力标签")
    estimated_duration: Optional[int] = Field(None, description="预估时长（分钟）")
    output: Optional[str] = Field(None, description="输出文件路径")
    validation: Optional[List[str]] = Field(None, description="验证规则")
    human_review: bool = Field(False, description="是否需要人工审核")
    depends_on: List[str] = Field(default_factory=list, description="依赖的步骤 ID")
    input_schema: Optional[Dict[str, Any]] = Field(None, description="输入参数 schema")
    output_schema: Optional[Dict[str, Any]] = Field(None, description="输出参数 schema")


class EdgeNode(BaseModel):
    """DAG中的边"""
    source: str = Field(..., description="源步骤 ID")
    target: str = Field(..., description="目标步骤 ID")


class DAGDefinition(BaseModel):
    """DAG 定义"""
    steps: List[StepNode] = Field(..., description="步骤列表")
    edges: List[EdgeNode] = Field(..., description="边列表")


class WorkflowConfig(BaseModel):
    """工作流配置"""
    single_step_timeout: Optional[int] = Field(1800, description="单步超时（秒）")
    workflow_timeout: Optional[int] = Field(86400, description="工作流超时（秒）")
    max_retries: Optional[int] = Field(3, description="最大重试次数")
    failure_strategy: Optional[str] = Field("escalate", description="失败策略")


class WorkflowTemplateCreate(BaseModel):
    """创建工作流模板请求"""
    name: str = Field(..., description="模板名称")
    description: Optional[str] = Field(None, description="模板描述")
    dag: DAGDefinition = Field(..., description="DAG 定义")
    config: Optional[WorkflowConfig] = Field(None, description="工作流配置")
    tags: Optional[List[str]] = Field(None, description="标签列表")


class WorkflowTemplateUpdate(BaseModel):
    """更新工作流模板请求"""
    name: Optional[str] = Field(None, description="模板名称")
    description: Optional[str] = Field(None, description="模板描述")
    dag: Optional[DAGDefinition] = Field(None, description="DAG 定义")
    config: Optional[WorkflowConfig] = Field(None, description="工作流配置")
    tags: Optional[List[str]] = Field(None, description="标签列表")


class WorkflowTemplateResponse(BaseModel):
    """工作流模板响应"""
    id: str
    name: str
    description: Optional[str]
    version: str
    status: TemplateStatus
    dag: DAGDefinition
    config: WorkflowConfig
    created_at: str
    created_by: str
    updated_at: str
    published_at: Optional[str]
    usage_count: int
    tags: Optional[List[str]]
    steps: Optional[List[StepNode]] = None

    class Config:
        from_attributes = True


class WorkflowTemplateListResponse(PaginatedResponse):
    """工作流模板列表响应"""
    data: List[WorkflowTemplateResponse]


# ============================================================
# Workflow Instance Schemas
# ============================================================

class CurrentStepInfo(BaseModel):
    """当前步骤信息"""
    step_id: str
    name: str
    status: StepStatus
    agent_name: Optional[str]
    progress: int


class WorkflowInstanceCreate(BaseModel):
    """创建工作流实例请求"""
    template_id: str = Field(..., description="模板 ID")
    input: Dict[str, Any] = Field(default_factory=dict, description="输入参数")
    execution_mode: Optional[str] = Field("standard", description="执行模式")


class WorkflowInstanceResponse(BaseModel):
    """工作流实例响应"""
    id: str
    template_id: str
    template_name: Optional[str] = None
    template_version: str
    status: WorkflowStatus
    input: Dict[str, Any]
    output: Optional[Dict[str, Any]]
    progress: int
    estimated_remaining: Optional[int]
    created_at: str
    created_by: str
    started_at: Optional[str]
    completed_at: Optional[str]
    duration: Optional[int]
    error_message: Optional[str]
    termination_reason: Optional[str]
    current_step: Optional[CurrentStepInfo] = None
    steps: Optional[List["StepExecutionResponse"]] = None

    class Config:
        from_attributes = True


class WorkflowInstanceListResponse(PaginatedResponse):
    """工作流实例列表响应"""
    data: List[WorkflowInstanceResponse]


class TerminateWorkflowRequest(BaseModel):
    """终止工作流请求"""
    reason: str = Field(..., description="终止原因")


# ============================================================
# Step Execution Schemas
# ============================================================

class StepExecutionResponse(BaseModel):
    """步骤执行响应"""
    id: str
    workflow_instance_id: str
    step_id: str
    name: str
    status: StepStatus
    agent_id: Optional[str]
    agent_name: Optional[str]
    input: Optional[Dict[str, Any]]
    output: Optional[Dict[str, Any]]
    progress: int
    progress_message: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]
    duration: Optional[int]
    retry_count: int
    max_retries: int
    error_message: Optional[str]
    force_completed: bool = False
    human_review: bool = False
    review: Optional["ReviewResponse"] = None
    artifacts: Optional[List["ArtifactResponse"]] = None

    class Config:
        from_attributes = True


class StepExecutionListResponse(PaginatedResponse):
    """步骤执行列表响应"""
    data: List[StepExecutionResponse]


class RetryStepRequest(BaseModel):
    """重试步骤请求"""
    pass


class SkipStepRequest(BaseModel):
    """跳过步骤请求"""
    reason: str = Field(..., description="跳过原因")


class ForceCompleteStepRequest(BaseModel):
    """强制完成步骤请求"""
    reason: str = Field(..., description="强制完成原因")
    output: Optional[Dict[str, Any]] = Field(None, description="输出数据")


class ReassignAgentRequest(BaseModel):
    """重新分配 Agent 请求"""
    agent_id: str = Field(..., description="Agent ID")


class ProgressUpdateRequest(BaseModel):
    """Agent 上报进度请求"""
    progress: int = Field(..., ge=0, le=100, description="进度百分比")
    message: Optional[str] = Field(None, description="进度消息")
    estimated_remaining: Optional[int] = Field(None, description="预估剩余时间（秒）")


class StepInputResponse(BaseModel):
    """步骤输入响应"""
    input: Dict[str, Any]
    dependencies: List[Dict[str, Any]]


class StepOutputResponse(BaseModel):
    """步骤输出响应"""
    output: Dict[str, Any]
    artifacts: List["ArtifactResponse"]


# ============================================================
# Review Schemas
# ============================================================

class ReviewResponse(BaseModel):
    """审核记录响应"""
    id: str
    workflow_instance_id: str
    workflow_name: Optional[str] = None
    step_execution_id: str
    step_name: Optional[str] = None
    reviewer_id: str
    reviewer_name: Optional[str]
    action: Optional[ReviewAction]
    comment: Optional[str]
    created_at: str
    updated_at: str
    timeout_at: Optional[str]
    timeout_action: str
    remaining_time: Optional[int]
    review_round: int

    class Config:
        from_attributes = True


class ReviewDetailResponse(ReviewResponse):
    """审核详情响应"""
    outputs: Optional[Dict[str, Any]] = None
    history: Optional[List[Dict[str, Any]]] = None


class ReviewListResponse(PaginatedResponse):
    """审核列表响应"""
    data: List[ReviewResponse]


class ApproveReviewRequest(BaseModel):
    """通过审核请求"""
    comment: Optional[str] = Field(None, description="审核意见")


class RejectReviewRequest(BaseModel):
    """拒绝审核请求"""
    comment: str = Field(..., description="拒绝原因")


class RequestChangesReviewRequest(BaseModel):
    """要求修改请求"""
    comment: str = Field(..., description="修改要求")


class ReviewStatsResponse(BaseModel):
    """审核统计响应"""
    total_pending: int
    total_completed_today: int
    timeout_warnings: int
    avg_review_time_seconds: int
    by_action: Dict[str, int]


# ============================================================
# Agent Schemas
# ============================================================

class AgentResponse(BaseModel):
    """Agent 响应"""
    id: str
    name: str
    display_name: Optional[str]
    capabilities: List[str]
    status: AgentStatus
    current_task_id: Optional[str]
    current_workflow_instance_id: Optional[str]
    current_step_execution_id: Optional[str]
    last_heartbeat: Optional[str]
    config: Optional[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]]
    statistics: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class AgentListResponse(PaginatedResponse):
    """Agent 列表响应"""
    data: List[AgentResponse]


class AgentLoadStatsResponse(BaseModel):
    """Agent 负载统计响应"""
    agent_id: str
    agent_name: str
    status: AgentStatus
    current_tasks: int
    running_tasks: int
    avg_task_duration: int


class AgentLoadStatsListResponse(BaseModel):
    """Agent 负载统计列表响应"""
    data: List[AgentLoadStatsResponse]
    total_agents: int
    online_agents: int
    offline_agents: int


class BatchCleanupRequest(BaseModel):
    """批量清理请求"""
    agent_ids: List[str] = Field(..., description="Agent ID 列表")


# ============================================================
# Artifact Schemas
# ============================================================

class ArtifactResponse(BaseModel):
    """产出物响应"""
    id: str
    workflow_instance_id: str
    step_execution_id: Optional[str]
    artifact_type: str
    name: str
    description: Optional[str]
    storage_kind: str
    storage_path: Optional[str]
    size_bytes: Optional[int]
    checksum: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


class ArtifactListResponse(PaginatedResponse):
    """产出物列表响应"""
    data: List[ArtifactResponse]


# ============================================================
# Log Schemas
# ============================================================

class LogResponse(BaseModel):
    """日志响应"""
    id: str
    step_execution_id: Optional[str]
    timestamp: str
    level: str
    message: str
    metadata: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class LogListResponse(PaginatedResponse):
    """日志列表响应"""
    data: List[LogResponse]


# ============================================================
# Event Schemas
# ============================================================

class EventResponse(BaseModel):
    """事件响应"""
    id: str
    event_type: str
    timestamp: str
    actor_type: Optional[str]
    actor_id: Optional[str]
    event_data: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class EventListResponse(PaginatedResponse):
    """事件列表响应"""
    data: List[EventResponse]


# ============================================================
# Statistics Schemas
# ============================================================

class WorkflowStatsResponse(BaseModel):
    """工作流统计响应"""
    total: int
    by_status: Dict[str, int]
    success_rate: float
    avg_duration_seconds: int
    by_template: List[Dict[str, Any]]
    time_series: List[Dict[str, Any]]


class AgentStatsResponse(BaseModel):
    """Agent 统计响应"""
    total_agents: int
    online_agents: int
    offline_agents: int
    by_agent: List[Dict[str, Any]]
    total_tasks: int
    total_tokens: int
    total_cost_usd: float


class TaskStatsResponse(BaseModel):
    """任务统计响应"""
    total: int
    by_status: Dict[str, int]
    by_category: Dict[str, int]
    avg_duration_seconds: int
    time_series: List[Dict[str, Any]]


class HealthCheckResponse(BaseModel):
    """健康检查响应"""
    status: str
    timestamp: str
    components: Dict[str, Any]
    version: str


# ============================================================
# WebSocket Schemas
# ============================================================

class WebSocketSubscribeMessage(BaseModel):
    """WebSocket 订阅消息"""
    action: Literal["subscribe", "unsubscribe"]
    channel: str


class WorkflowEventMessage(BaseModel):
    """工作流事件消息"""
    event: str
    channel: str
    timestamp: str
    data: Dict[str, Any]


# ============================================================
# Callback Schemas (Internal)
# ============================================================

class StepCallbackRequest(BaseModel):
    """步骤完成回调请求"""
    status: StepStatus
    output: Optional[Dict[str, Any]] = None
    artifacts: Optional[List[Dict[str, Any]]] = None
    metrics: Optional[Dict[str, Any]] = None


class StepProgressCallbackRequest(BaseModel):
    """步骤进度回调请求"""
    progress: int = Field(..., ge=0, le=100)
    message: Optional[str] = None
    estimated_remaining: Optional[int] = None


# ============================================================
# Template Version Schemas
# ============================================================

class TemplateVersionResponse(BaseModel):
    """模板版本响应"""
    version: str
    change_summary: Optional[str]
    created_at: str
    created_by: str


class TemplateVersionListResponse(PaginatedResponse):
    """模板版本列表响应"""
    data: List[TemplateVersionResponse]


class RollbackRequest(BaseModel):
    """回滚请求"""
    version: str = Field(..., description="目标版本")


# ============================================================
# Duplicate Template Schemas
# ============================================================

class DuplicateTemplateRequest(BaseModel):
    """复制模板请求"""
    name: str = Field(..., description="新模板名称")
    description: Optional[str] = Field(None, description="新模板描述")


# ============================================================
# Export Schemas
# ============================================================

class ExportOptions(BaseModel):
    """导出选项"""
    format: Optional[str] = Field("json", description="导出格式")
