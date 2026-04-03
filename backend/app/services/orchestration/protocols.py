"""
Orchestration Protocols & Type Definitions for OpenClaw v3.

Defines the core abstractions that bridge the orchestration layer
(LangGraph-style state machine) with the execution layer (Claude Code SDK)
and the tool layer (MCP).

Reference: docs/requirements/openclaw-v3/06-core-modules.md
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional, Protocol


# ============================================================
# StepKind — Step Type Enumeration
# ============================================================

class StepKind(str, Enum):
    """
    Enumeration of all supported step types in the orchestration engine.

    Each StepKind determines how a step is executed:
    - Who executes it (Agent / Human / System)
    - What context is needed
    - How completion is determined
    """

    # --- Existing step types (backward compatible) ---

    AGENT_SESSION = "agent_session"
    """Bind to a Gateway/Agent session, send prompt/task. Execution by Agent."""

    HUMAN_GATE = "human_gate"
    """Human review gate. Pauses workflow until approved/rejected."""

    # --- New step types (v3) ---

    TOOL_ONLY = "tool_only"
    """Tool call only, no conversation round. Direct MCP/Gateway tool execution."""

    COMMAND = "command"
    """Invoke a registered command (RPC). Parameters validated by JSON Schema."""

    PLANNER = "planner"
    """Produces an ExecutionPlan draft. Uses LLM + schema validation."""

    SUBWORKFLOW = "subworkflow"
    """Nested sub-template or sub-Plan execution."""

    WAIT_EVENT = "wait_event"
    """Wait for an external event (Webhook / message / signal)."""

    COORDINATOR = "coordinator"
    """Coordinator mode: spawns and manages Worker Agents."""

    VERIFICATION = "verification"
    """Independent verification step. Isolated from implementation Agent."""


# ============================================================
# OrchestrationProfile — Orchestration Semantic Label
# ============================================================

class OrchestrationProfile(str, Enum):
    """
    Orchestration profile determines the scheduling semantics for a
    workflow instance.

    New orchestration capabilities are introduced through new profiles.
    The dispatcher branches by profile; old instances keep their old profile.

    Reference: docs/requirements/openclaw-v3/08-migration-strategy.md §3.5
    """

    STATIC_DAG_V1 = "static-dag-v1"
    """Legacy static DAG execution. No dynamic plans, no checkpoints."""

    STATIC_DAG_V2 = "static-dag-v2"
    """Enhanced static DAG with checkpoints, conditions, parallel gates."""

    PLAN_SUBTASK_V2 = "plan-subtask-v2"
    """Dynamic ExecutionPlan + Subtask decomposition. Planner-driven."""

    COORDINATOR_V2 = "coordinator-v2"
    """Coordinator Mode: multi-Worker orchestration with plan support."""


# ============================================================
# RuntimeContractVersion — Gateway/Executor Contract
# ============================================================

class RuntimeContractVersion(str, Enum):
    """
    Version of the integration contract between the control plane
    and the Gateway/Executor.

    The executor can be upgraded independently as long as it implements
    the same contract version.

    Reference: docs/requirements/openclaw-v3/08-migration-strategy.md §3.5
    """

    V1 = "v1"
    """Original contract: basic session/tool/command RPC."""

    V2 = "v2"
    """Enhanced contract: ToolContext, idempotency, checkpoint signals."""


# ============================================================
# ToolContext — Per-Step Tool Permission Context
# ============================================================

@dataclass
class ToolContext:
    """
    Tool permission context carried by each step.

    The Gateway/Executor validates this context before executing any tool.
    Default-deny: only explicitly allowed tools can be used.

    Reference: docs/requirements/openclaw-v3/02-functional-requirements.md FR-07
    """

    tenant_id: str
    """Tenant identifier for multi-tenancy isolation."""

    workflow_id: str
    """Workflow instance ID."""

    step_id: str
    """Step execution ID."""

    actor: str
    """Actor (user or agent) initiating the tool call."""

    allowlist: list[str] = field(default_factory=list)
    """Explicitly allowed tool names. Empty = no tools allowed."""

    denylist: list[str] = field(default_factory=list)
    """Explicitly denied tool names. Takes precedence over allowlist."""

    mcp_servers: list[str] = field(default_factory=list)
    """Allowed MCP server names for this step."""

    max_cost_usd: Optional[float] = None
    """Maximum cost budget for this step (USD). None = no limit."""

    max_tokens: Optional[int] = None
    """Maximum token budget for this step. None = no limit."""

    def __post_init__(self) -> None:
        object.__setattr__(self, "_deny_set", frozenset(self.denylist))
        object.__setattr__(self, "_allow_set", frozenset(self.allowlist))

    def is_tool_allowed(self, tool_name: str) -> bool:
        """Check if a tool is allowed by this context."""
        if tool_name in self._deny_set:
            return False
        if not self._allow_set:
            return False  # default deny
        return tool_name in self._allow_set

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary for JSON storage."""
        return {
            "tenant_id": self.tenant_id,
            "workflow_id": self.workflow_id,
            "step_id": self.step_id,
            "actor": self.actor,
            "allowlist": self.allowlist,
            "denylist": self.denylist,
            "mcp_servers": self.mcp_servers,
            "max_cost_usd": self.max_cost_usd,
            "max_tokens": self.max_tokens,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ToolContext:
        """Deserialize from dictionary."""
        return cls(
            tenant_id=data.get("tenant_id", ""),
            workflow_id=data.get("workflow_id", ""),
            step_id=data.get("step_id", ""),
            actor=data.get("actor", ""),
            allowlist=data.get("allowlist", []),
            denylist=data.get("denylist", []),
            mcp_servers=data.get("mcp_servers", []),
            max_cost_usd=data.get("max_cost_usd"),
            max_tokens=data.get("max_tokens"),
        )


# ============================================================
# Idempotency — Step Execution Idempotency
# ============================================================

@dataclass
class IdempotencyKey:
    """
    Idempotency key for step execution.

    Ensures that retried or duplicated step executions produce the same
    result without side effects.

    Reference: docs/requirements/openclaw-v3/03-nonfunctional-requirements.md NFR-R3
    """

    workflow_instance_id: str
    step_id: str
    attempt: int

    def __str__(self) -> str:
        return f"{self.workflow_instance_id}:{self.step_id}:{self.attempt}"


# ============================================================
# CheckpointData — Step Checkpoint
# ============================================================

@dataclass
class CheckpointData:
    """
    Checkpoint data for a step execution.

    Persisted before and after each step execution to enable recovery.

    Reference: docs/requirements/openclaw-v3/03-nonfunctional-requirements.md NFR-R1
    """

    checkpoint_type: str  # pre_execute / post_execute / on_failure
    state_json: str
    input_hash: Optional[str] = None
    output_hash: Optional[str] = None
    output_summary: Optional[str] = None
    attempt: int = 0
    idempotency_key: str = ""


# ============================================================
# OrchestrationEvent — Event for EventRouter
# ============================================================

class OrchestrationEventType(str, Enum):
    """Types of orchestration events."""

    # Instance events
    INSTANCE_STARTED = "instance.started"
    INSTANCE_PAUSED = "instance.paused"
    INSTANCE_RESUMED = "instance.resumed"
    INSTANCE_COMPLETED = "instance.completed"
    INSTANCE_FAILED = "instance.failed"
    INSTANCE_TERMINATED = "instance.terminated"

    # Step events
    STEP_STARTED = "step.started"
    STEP_COMPLETED = "step.completed"
    STEP_FAILED = "step.failed"
    STEP_RETRYING = "step.retrying"
    STEP_SKIPPED = "step.skipped"

    # Checkpoint events
    CHECKPOINT_CREATED = "checkpoint.created"
    CHECKPOINT_RESTORED = "checkpoint.restored"

    # Coordinator events
    COORDINATOR_SESSION_CREATED = "coordinator.session_created"
    COORDINATOR_WORKER_SPAWNED = "coordinator.worker_spawned"
    COORDINATOR_WORKER_COMPLETED = "coordinator.worker_completed"
    COORDINATOR_WORKER_FAILED = "coordinator.worker_failed"
    COORDINATOR_SESSION_COMPLETED = "coordinator.session_completed"

    # Plan events
    PLAN_CREATED = "plan.created"
    PLAN_APPROVED = "plan.approved"
    PLAN_REJECTED = "plan.rejected"
    PLAN_MODIFIED = "plan.modified"

    # Cost events
    COST_ALERT = "cost.alert"
    COST_RECORDED = "cost.recorded"

    # MCP events
    MCP_SERVER_CONNECTED = "mcp.server_connected"
    MCP_SERVER_DISCONNECTED = "mcp.server_disconnected"
    MCP_TOOLS_DISCOVERED = "mcp.tools_discovered"


@dataclass
class OrchestrationEvent:
    """Orchestration event for routing and persistence."""

    event_type: OrchestrationEventType
    payload: dict[str, Any]
    instance_id: Optional[str] = None
    step_id: Optional[str] = None
    actor_type: str = "system"  # user / agent / system
    actor_id: Optional[str] = None
    schema_version: str = "1"


# ============================================================
# Abstract Protocols (Interfaces)
# ============================================================

class StepExecutorProtocol(Protocol):
    """Protocol for step executors — one per StepKind."""

    async def execute(self, step: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        """Execute a step and return the result."""
        ...

    async def validate_input(self, step: dict[str, Any]) -> bool:
        """Validate step input before execution."""
        ...


class CheckpointStoreProtocol(Protocol):
    """Protocol for checkpoint storage backends."""

    async def save(self, checkpoint: CheckpointData) -> str:
        """Save a checkpoint and return its ID."""
        ...

    async def load(self, checkpoint_id: str) -> Optional[CheckpointData]:
        """Load a checkpoint by ID."""
        ...

    async def list_for_instance(self, instance_id: str) -> list[CheckpointData]:
        """List all checkpoints for a workflow instance."""
        ...


class EventPublisherProtocol(Protocol):
    """Protocol for event publishing (WebSocket, message queue, etc.)."""

    async def publish(self, event: OrchestrationEvent) -> None:
        """Publish an orchestration event."""
        ...
