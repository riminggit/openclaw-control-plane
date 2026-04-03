"""
Orchestration services for OpenClaw v3.

Modules:
    protocols: Core type definitions and interfaces
    engine: OrchestrationEngine — workflow execution engine
    context_manager: ContextManager — token budget and auto-compact
    cost_tracker: CostTracker — model-level cost tracking
    session_memory: SessionMemoryService — automatic memory extraction
    swarm_service: SwarmService — agent team/swarm management
    skill_registry: SkillRegistry — skill registration and execution
    mcp_manager: MCPManager — MCP dynamic tool discovery
    plan_mode: PlanMode — dynamic plan creation and subtask decomposition
"""

# Phase 0: Core types and interfaces
from app.services.orchestration.protocols import (
    StepKind,
    OrchestrationProfile,
    RuntimeContractVersion,
    ToolContext,
    IdempotencyKey,
    CheckpointData,
    OrchestrationEvent,
    OrchestrationEventType,
    StepExecutorProtocol,
    CheckpointStoreProtocol,
    EventPublisherProtocol,
)

# Phase 1: Core services
from app.services.orchestration.engine import (
    OrchestrationEngine,
    EngineStatus,
    StepResult,
    WorkflowRunState,
)
from app.services.orchestration.context_manager import (
    ContextManager,
    TokenBudget,
    CompactResult,
)
from app.services.orchestration.cost_tracker import (
    CostTracker,
    CostEntry,
    CostSummary,
    ModelUsage,
    BudgetAlert,
)
from app.services.orchestration.session_memory import (
    SessionMemoryService,
    MemoryEntry,
    MemoryExtractionResult,
    ConversationTurn,
)

# Phase 2: Advanced services
from app.services.orchestration.swarm_service import (
    SwarmService,
    TeamInfo,
    MessagePayload,
    TeamOperationResult,
)
from app.services.orchestration.skill_registry import (
    SkillRegistry,
    SkillDefinition as SkillDef,
    SkillExecutionResult,
)
from app.services.orchestration.mcp_manager import (
    MCPManager,
    MCPServerInfo,
    MCPToolInfo,
    MCPToolRegistry,
    ToolCallResult,
    DiscoveryResult,
)
from app.services.orchestration.plan_mode import (
    PlanMode,
    PlanDefinition,
    SubtaskDefinition,
    PlanExecutionState,
    PlanValidationResult,
    PlanStatus,
    SubtaskStatus,
    PlanSource,
)

__all__ = [
    # Phase 0: Protocols
    "StepKind",
    "OrchestrationProfile",
    "RuntimeContractVersion",
    "ToolContext",
    "IdempotencyKey",
    "CheckpointData",
    "OrchestrationEvent",
    "OrchestrationEventType",
    "StepExecutorProtocol",
    "CheckpointStoreProtocol",
    "EventPublisherProtocol",
    # Phase 1: Core
    "OrchestrationEngine",
    "EngineStatus",
    "StepResult",
    "WorkflowRunState",
    "ContextManager",
    "TokenBudget",
    "CompactResult",
    "CostTracker",
    "CostEntry",
    "CostSummary",
    "ModelUsage",
    "BudgetAlert",
    "SessionMemoryService",
    "MemoryEntry",
    "MemoryExtractionResult",
    "ConversationTurn",
    # Phase 2: Advanced
    "SwarmService",
    "TeamInfo",
    "MessagePayload",
    "TeamOperationResult",
    "SkillRegistry",
    "SkillExecutionResult",
    "MCPManager",
    "MCPServerInfo",
    "MCPToolInfo",
    "MCPToolRegistry",
    "ToolCallResult",
    "DiscoveryResult",
    "PlanMode",
    "PlanDefinition",
    "SubtaskDefinition",
    "PlanExecutionState",
    "PlanValidationResult",
    "PlanStatus",
    "SubtaskStatus",
    "PlanSource",
]
