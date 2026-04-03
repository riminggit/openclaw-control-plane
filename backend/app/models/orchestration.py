"""
Orchestration Models for OpenClaw v3.

New SQLAlchemy models for the orchestration layer:
- CoordinatorSession, WorkerAgent
- AgentTeam, AgentTeamMember, AgentMessage
- ExecutionPlan, Subtask
- OrchestrationCheckpoint
- SessionMemory
- CostRecord
- SkillDefinition
- MCPServerConfig, MCPToolSnapshot
- OutboxMessage

Reference: docs/requirements/openclaw-v3/04-data-model.md
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Text, Integer, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# Coordinator & Worker
# ============================================================

class CoordinatorSession(Base):
    """协调器会话表"""
    __tablename__ = "coordinator_sessions"
    __table_args__ = (Index("ix_coordinator_sessions_workflow_instance_id", "workflow_instance_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    workflow_instance_id: Mapped[str] = mapped_column(
        String, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    coordinator_agent_id: Mapped[Optional[str]] = mapped_column(String)
    plan_mode: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0/1
    scratchpad_dir: Mapped[Optional[str]] = mapped_column(String)
    config_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    result_summary: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)
    completed_at: Mapped[Optional[str]] = mapped_column(String)
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    workers: Mapped[list["WorkerAgent"]] = relationship(
        "WorkerAgent", back_populates="coordinator", cascade="all, delete-orphan"
    )


class WorkerAgent(Base):
    """Worker Agent 实例表"""
    __tablename__ = "worker_agents"
    __table_args__ = (
        Index("ix_worker_agents_coordinator_id", "coordinator_id"),
        Index("ix_worker_agents_status", "status"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    coordinator_id: Mapped[str] = mapped_column(
        String, ForeignKey("coordinator_sessions.id", ondelete="CASCADE"), nullable=False
    )
    agent_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("agents.id", ondelete="SET NULL")
    )
    agent_type: Mapped[str] = mapped_column(String, nullable=False, default="worker")
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    task_description: Mapped[Optional[str]] = mapped_column(Text)
    session_key: Mapped[Optional[str]] = mapped_column(String)
    continue_mode: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0/1
    context_json: Mapped[Optional[str]] = mapped_column(Text)
    result_json: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)
    started_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    coordinator: Mapped["CoordinatorSession"] = relationship(
        "CoordinatorSession", back_populates="workers"
    )


# ============================================================
# Agent Team & Messaging
# ============================================================

class AgentTeam(Base):
    """Agent 团队表"""
    __tablename__ = "agent_teams"
    __table_args__ = (Index("ix_agent_teams_workflow_instance_id", "workflow_instance_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    leader_agent_id: Mapped[str] = mapped_column(String, nullable=False)
    workflow_instance_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("workflow_instances.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    config_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)
    dissolved_at: Mapped[Optional[str]] = mapped_column(String)

    # Relationships
    members: Mapped[list["AgentTeamMember"]] = relationship(
        "AgentTeamMember", back_populates="team", cascade="all, delete-orphan"
    )


class AgentTeamMember(Base):
    """团队成员表"""
    __tablename__ = "agent_team_members"

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    team_id: Mapped[str] = mapped_column(
        String, ForeignKey("agent_teams.id", ondelete="CASCADE"), nullable=False
    )
    agent_id: Mapped[str] = mapped_column(
        String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String, nullable=False, default="worker")
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    joined_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)
    left_at: Mapped[Optional[str]] = mapped_column(String)

    # Relationships
    team: Mapped["AgentTeam"] = relationship("AgentTeam", back_populates="members")


class AgentMessage(Base):
    """Agent 间消息表"""
    __tablename__ = "agent_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    from_agent_id: Mapped[str] = mapped_column(String, nullable=False)
    to_agent_id: Mapped[str] = mapped_column(String, nullable=False)
    team_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("agent_teams.id", ondelete="SET NULL")
    )
    coordinator_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("coordinator_sessions.id", ondelete="SET NULL")
    )
    message_type: Mapped[str] = mapped_column(String, nullable=False, default="notify")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)
    delivered_at: Mapped[Optional[str]] = mapped_column(String)


# ============================================================
# Execution Plan & Subtask
# ============================================================

class ExecutionPlan(Base):
    """动态执行计划表"""
    __tablename__ = "execution_plans"
    __table_args__ = (
        Index("ix_execution_plans_workflow_instance_id", "workflow_instance_id"),
        Index("ix_execution_plans_status", "status"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    workflow_instance_id: Mapped[str] = mapped_column(
        String, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False
    )
    source: Mapped[str] = mapped_column(String, nullable=False, default="planner_agent")
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    plan_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    approved_by: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)
    approved_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)

    # Relationships
    subtasks: Mapped[list["Subtask"]] = relationship(
        "Subtask", back_populates="plan", cascade="all, delete-orphan"
    )


class Subtask(Base):
    """子任务表"""
    __tablename__ = "subtasks"
    __table_args__ = (
        Index("ix_subtasks_plan_id", "plan_id"),
        Index("ix_subtasks_status", "status"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    plan_id: Mapped[str] = mapped_column(
        String, ForeignKey("execution_plans.id", ondelete="CASCADE"), nullable=False
    )
    parent_subtask_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("subtasks.id", ondelete="SET NULL")
    )
    step_execution_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("step_executions.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    depends_on: Mapped[Optional[str]] = mapped_column(Text)  # JSON array of subtask IDs
    assigned_agent_id: Mapped[Optional[str]] = mapped_column(String)
    input_json: Mapped[Optional[str]] = mapped_column(Text)
    output_json: Mapped[Optional[str]] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)
    started_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)

    # Relationships
    plan: Mapped["ExecutionPlan"] = relationship("ExecutionPlan", back_populates="subtasks")


# ============================================================
# Checkpoint
# ============================================================

class OrchestrationCheckpoint(Base):
    """编排检查点表"""
    __tablename__ = "orchestration_checkpoints"
    __table_args__ = (Index("ix_orch_ckpt_workflow_instance_id", "workflow_instance_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    workflow_instance_id: Mapped[str] = mapped_column(
        String, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False
    )
    step_execution_id: Mapped[str] = mapped_column(
        String, ForeignKey("step_executions.id", ondelete="CASCADE"), nullable=False
    )
    checkpoint_type: Mapped[str] = mapped_column(String, nullable=False, default="pre_execute")
    state_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    input_hash: Mapped[Optional[str]] = mapped_column(String)
    output_hash: Mapped[Optional[str]] = mapped_column(String)
    output_summary: Mapped[Optional[str]] = mapped_column(Text)
    attempt: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    idempotency_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)


# ============================================================
# Session Memory
# ============================================================

class SessionMemory(Base):
    """会话记忆表"""
    __tablename__ = "session_memories"
    __table_args__ = (Index("ix_session_memories_scope_scope_id", "scope", "scope_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    scope: Mapped[str] = mapped_column(String, nullable=False, default="session")
    scope_id: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_hash: Mapped[str] = mapped_column(String, nullable=False, default="")
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source: Mapped[str] = mapped_column(String, nullable=False, default="auto_extract")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)
    updated_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)


# ============================================================
# Cost Tracking
# ============================================================

class CostRecord(Base):
    """成本追踪记录表"""
    __tablename__ = "cost_records"
    __table_args__ = (
        Index("ix_cost_records_workflow_instance_id", "workflow_instance_id"),
        Index("ix_cost_records_created_at", "created_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    workflow_instance_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("workflow_instances.id", ondelete="SET NULL")
    )
    step_execution_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("step_executions.id", ondelete="SET NULL")
    )
    agent_id: Mapped[Optional[str]] = mapped_column(String)
    model: Mapped[str] = mapped_column(String, nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_creation_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    api_call_type: Mapped[str] = mapped_column(String, nullable=False, default="message")
    metadata_json: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)


# ============================================================
# Skill Definition
# ============================================================

class SkillDefinition(Base):
    """技能定义表"""
    __tablename__ = "skill_definitions"

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    display_name: Mapped[Optional[str]] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String, nullable=False, default="custom")
    when_to_use: Mapped[Optional[str]] = mapped_column(Text)
    allowed_tools: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    model: Mapped[Optional[str]] = mapped_column(String)
    argument_hint: Mapped[Optional[str]] = mapped_column(String)
    prompt_template: Mapped[Optional[str]] = mapped_column(Text)
    config_json: Mapped[Optional[str]] = mapped_column(Text)
    version: Mapped[str] = mapped_column(String, nullable=False, default="1.0.0")
    enabled: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 0/1
    tenant_id: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)
    updated_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)


# ============================================================
# MCP
# ============================================================

class MCPServerConfig(Base):
    """MCP 服务器配置表"""
    __tablename__ = "mcp_server_configs"

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    transport_type: Mapped[str] = mapped_column(String, nullable=False, default="stdio")
    connection_config: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    status: Mapped[str] = mapped_column(String, nullable=False, default="disconnected")
    tool_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_discovered_at: Mapped[Optional[str]] = mapped_column(String)
    enabled: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 0/1
    tenant_id: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)
    updated_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)

    # Relationships
    tools: Mapped[list["MCPToolSnapshot"]] = relationship(
        "MCPToolSnapshot", back_populates="server", cascade="all, delete-orphan"
    )


class MCPToolSnapshot(Base):
    """MCP 工具快照表"""
    __tablename__ = "mcp_tool_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    server_id: Mapped[str] = mapped_column(
        String, ForeignKey("mcp_server_configs.id", ondelete="CASCADE"), nullable=False
    )
    tool_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    input_schema: Mapped[Optional[str]] = mapped_column(Text)
    output_schema: Mapped[Optional[str]] = mapped_column(Text)
    version: Mapped[str] = mapped_column(String, nullable=False, default="1.0.0")
    discovered_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)

    # Relationships
    server: Mapped["MCPServerConfig"] = relationship("MCPServerConfig", back_populates="tools")


# ============================================================
# Outbox
# ============================================================

class OutboxMessage(Base):
    """Outbox 消息表"""
    __tablename__ = "outbox_messages"
    __table_args__ = (
        Index("ix_outbox_messages_workflow_instance_id", "workflow_instance_id"),
        Index("ix_outbox_messages_status", "status"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    workflow_instance_id: Mapped[str] = mapped_column(
        String, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False
    )
    step_execution_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("step_executions.id", ondelete="SET NULL")
    )
    message_type: Mapped[str] = mapped_column(String, nullable=False, default="command")
    target: Mapped[str] = mapped_column(String, nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    idempotency_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=_now)
    sent_at: Mapped[Optional[str]] = mapped_column(String)
    acknowledged_at: Mapped[Optional[str]] = mapped_column(String)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
