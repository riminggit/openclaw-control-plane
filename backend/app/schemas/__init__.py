"""Schemas for OpenClaw Control Plane."""

from app.schemas.common import HealthResponse, ReadyResponse
# from app.schemas.project import ProjectCreate, ProjectResponse  # Classes don't exist yet
# from app.schemas.task import TaskCreate, TaskResponse  # Classes don't exist yet
from app.schemas.workflow import (
    # Enums
    WorkflowStatus,
    StepStatus,
    ReviewAction,
    AgentStatus,
    TemplateStatus,
    # Common
    PaginationParams,
    PaginatedResponse,
    ErrorResponse,
    # Template
    StepNode,
    EdgeNode,
    DAGDefinition,
    WorkflowConfig,
    WorkflowTemplateCreate,
    WorkflowTemplateUpdate,
    WorkflowTemplateResponse,
    WorkflowTemplateListResponse,
    TemplateVersionResponse,
    TemplateVersionListResponse,
    RollbackRequest,
    DuplicateTemplateRequest,
    ExportOptions,
    # Instance
    CurrentStepInfo,
    WorkflowInstanceCreate,
    WorkflowInstanceResponse,
    WorkflowInstanceListResponse,
    WorkflowTerminateRequest,
    # Step
    StepExecutionResponse,
    StepExecutionListResponse,
    StepRetryRequest,
    StepSkipRequest,
    StepForceCompleteRequest,
    StepReassignRequest,
    StepProgressUpdate,
    StepInputResponse,
    StepOutputResponse,
    # Review
    ReviewResponse,
    ReviewDetailResponse,
    ReviewApproveRequest,
    ReviewRejectRequest,
    ReviewRequestChangesRequest,
    ReviewListResponse,
    ReviewStatsResponse,
    # Agent
    AgentResponse,
    AgentDetailResponse,
    AgentListResponse,
    AgentLoadStatsResponse,
    AgentLoadStatsListResponse,
    BatchCleanupRequest,
    # Artifact
    ArtifactResponse,
    ArtifactListResponse,
    # Log
    LogResponse,
    LogListResponse,
    # Event
    EventResponse,
    EventListResponse,
    # Stats
    WorkflowStatsResponse,
    AgentStatsResponse,
    TaskStatsResponse,
    HealthCheckResponse,
    # WebSocket
    WebSocketSubscribeMessage,
    WorkflowEventMessage,
    # Callback
    StepCallbackRequest,
    StepProgressCallbackRequest,
)

__all__ = [
    "HealthResponse", "ReadyResponse",
    "ProjectCreate", "ProjectResponse",
    "TaskCreate", "TaskResponse",
    # Workflow
    "WorkflowStatus", "StepStatus", "ReviewAction", "AgentStatus", "TemplateStatus",
    "PaginationParams", "PaginatedResponse", "ErrorResponse",
    "StepNode", "EdgeNode", "DAGDefinition", "WorkflowConfig",
    "WorkflowTemplateCreate", "WorkflowTemplateUpdate", "WorkflowTemplateResponse", "WorkflowTemplateListResponse",
    "TemplateVersionResponse", "TemplateVersionListResponse", "RollbackRequest", "DuplicateTemplateRequest", "ExportOptions",
    "CurrentStepInfo", "WorkflowInstanceCreate", "WorkflowInstanceResponse", "WorkflowInstanceListResponse", "WorkflowTerminateRequest",
    "StepExecutionResponse", "StepExecutionListResponse", "StepRetryRequest", "StepSkipRequest", 
    "StepForceCompleteRequest", "StepReassignRequest", "StepProgressUpdate", "StepInputResponse", "StepOutputResponse",
    "ReviewResponse", "ReviewDetailResponse", "ReviewApproveRequest", "ReviewRejectRequest", "ReviewRequestChangesRequest",
    "ReviewListResponse", "ReviewStatsResponse",
    "AgentResponse", "AgentDetailResponse", "AgentListResponse", "AgentLoadStatsResponse", "AgentLoadStatsListResponse", "BatchCleanupRequest",
    "ArtifactResponse", "ArtifactListResponse",
    "LogResponse", "LogListResponse",
    "EventResponse", "EventListResponse",
    "WorkflowStatsResponse", "AgentStatsResponse", "TaskStatsResponse", "HealthCheckResponse",
    "WebSocketSubscribeMessage", "WorkflowEventMessage",
    "StepCallbackRequest", "StepProgressCallbackRequest",
]
