"""MVP database layer — SQLite, matches docs/openclaw-control-plane-schema.sql."""

import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./control_plane.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


# ── MVP Models (TEXT PKs, no ENUMs, matches schema.sql exactly) ──

from sqlalchemy import String, Text, Integer, Date, ForeignKey, Boolean, Float  # noqa: E402
from sqlalchemy.orm import Mapped, mapped_column, relationship  # noqa: E402


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    owner_role: Mapped[str | None] = mapped_column(String, nullable=True)
    owner_agent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    archive_root_folder_token: Mapped[str | None] = mapped_column(String, nullable=True)
    archive_project_folder_token: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)
    tasks: Mapped[list["Task"]] = relationship(back_populates="project")


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    parent_task_id: Mapped[str | None] = mapped_column(String, ForeignKey("tasks.id"), nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String, nullable=False)
    phase: Mapped[str | None] = mapped_column(String, nullable=True)
    priority: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    status: Mapped[str] = mapped_column(String, nullable=False)
    source_channel: Mapped[str | None] = mapped_column(String, nullable=True)
    owner_role: Mapped[str | None] = mapped_column(String, nullable=True)
    owner_agent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    assignee_session_key: Mapped[str | None] = mapped_column(String, nullable=True)
    risk_level: Mapped[str] = mapped_column(String, nullable=False, default="low")
    doc_sync_risk: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    blocked_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_at: Mapped[str | None] = mapped_column(String, nullable=True)
    last_dispatch_at: Mapped[str | None] = mapped_column(String, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Workflow engine fields
    started_at: Mapped[str | None] = mapped_column(String, nullable=True)
    completed_at: Mapped[str | None] = mapped_column(String, nullable=True)
    gateway_session_id: Mapped[str | None] = mapped_column(String, nullable=True)
    review_gate_status: Mapped[str | None] = mapped_column(String, nullable=True)  # pending/approved/rejected
    review_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Progress estimation fields
    estimated_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_progress: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    progress_source: Mapped[str] = mapped_column(String, nullable=False, default="estimated")
    actual_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)
    project: Mapped["Project"] = relationship(back_populates="tasks")
    # State transition history
    transitions: Mapped[list["StateTransitionLog"]] = relationship(
        backref="task", cascade="all, delete-orphan",
        primaryjoin="Task.id == StateTransitionLog.task_id",
    )


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    task_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id"), nullable=False)
    depends_on_task_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id"), nullable=False)
    dependency_type: Mapped[str] = mapped_column(String, nullable=False, default="finish_to_start")
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class ReviewGate(Base):
    __tablename__ = "review_gates"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    task_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id"), nullable=False)
    gate_type: Mapped[str] = mapped_column(String, nullable=False)
    reviewer_role: Mapped[str | None] = mapped_column(String, nullable=True)
    reviewer_agent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    decision: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    round: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    decided_at: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class DispatchJob(Base):
    __tablename__ = "dispatch_jobs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    task_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id"), nullable=False)
    dispatch_mode: Mapped[str] = mapped_column(String, nullable=False)
    target_agent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    target_session_key: Mapped[str | None] = mapped_column(String, nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    run_status: Mapped[str] = mapped_column(String, nullable=False, default="queued")
    run_id: Mapped[str | None] = mapped_column(String, nullable=True)
    fallback_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fallback_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[str | None] = mapped_column(String, nullable=True)
    finished_at: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class StateTransitionLog(Base):
    __tablename__ = "state_transition_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    task_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id"), nullable=False)
    from_status: Mapped[str] = mapped_column(String, nullable=False)
    to_status: Mapped[str] = mapped_column(String, nullable=False)
    actor: Mapped[str] = mapped_column(String, nullable=False, default="system")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class TaskThought(Base):
    __tablename__ = "task_thoughts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    task_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id"), nullable=False)
    agent_id: Mapped[str] = mapped_column(String, nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    thinking_content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False, default="analysis")
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str | None] = mapped_column(String, ForeignKey("projects.id"), nullable=True)
    task_id: Mapped[str | None] = mapped_column(String, ForeignKey("tasks.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    actor_type: Mapped[str] = mapped_column(String, nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class Artifact(Base):
    __tablename__ = "artifacts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    task_id: Mapped[str | None] = mapped_column(String, ForeignKey("tasks.id"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(String, ForeignKey("projects.id"), nullable=True)
    artifact_type: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    local_path: Mapped[str | None] = mapped_column(String, nullable=True)
    storage_kind: Mapped[str] = mapped_column(String, nullable=False, default="local")
    feishu_doc_token: Mapped[str | None] = mapped_column(String, nullable=True)
    feishu_url: Mapped[str | None] = mapped_column(String, nullable=True)
    feishu_folder_token: Mapped[str | None] = mapped_column(String, nullable=True)
    version: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class AgentHealthSnapshot(Base):
    __tablename__ = "agent_health_snapshots"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    agent_id: Mapped[str] = mapped_column(String, nullable=False)
    session_key: Mapped[str | None] = mapped_column(String, nullable=True)
    current_task_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String, nullable=False)
    last_active_at: Mapped[str | None] = mapped_column(String, nullable=True)
    failures_24h: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_duration_ms_24h: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class ProjectMetricDaily(Base):
    __tablename__ = "project_metrics_daily"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    metric_date: Mapped[str] = mapped_column(String, nullable=False)
    total_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    done_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    blocked_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    review_pending_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active_agents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


# ── Phase 4: Cost Analytics ──

# Float already imported at top

class AgentTokenSnapshot(Base):
    __tablename__ = "agent_token_snapshots"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    agent_id: Mapped[str] = mapped_column(String, nullable=False)
    session_key: Mapped[str | None] = mapped_column(String, nullable=True)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    sampled_at: Mapped[str] = mapped_column(String, nullable=False)


class DailyCostSummary(Base):
    __tablename__ = "daily_cost_summary"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    date: Mapped[str] = mapped_column(String, nullable=False)
    agent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)


class BudgetAlert(Base):
    __tablename__ = "budget_alerts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    budget_type: Mapped[str] = mapped_column(String, nullable=False, default="daily")
    budget_limit_usd: Mapped[float] = mapped_column(Float, nullable=False)
    current_usage_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    alert_threshold_pct: Mapped[float] = mapped_column(Float, nullable=False, default=80.0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


# ── Phase 4: Lifecycle ──

class CleanupLog(Base):
    __tablename__ = "cleanup_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_key: Mapped[str] = mapped_column(String, nullable=False)
    agent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    agent_label: Mapped[str | None] = mapped_column(String, nullable=True)
    lifecycle_state: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    cleaned_at: Mapped[str] = mapped_column(String, nullable=False)


# ── Phase 4: Chat bookmarks ──

class ChatBookmark(Base):
    __tablename__ = "chat_bookmarks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_key: Mapped[str] = mapped_column(String, nullable=False)
    message_id: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    agent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    bookmarked_at: Mapped[str] = mapped_column(String, nullable=False)


# ── Init ──

def init_db():
    Base.metadata.create_all(bind=engine)


def seed_db():
    """Insert seed data if tables are empty."""
    db = SessionLocal()
    try:
        if db.query(Project).count() > 0:
            return
        now = datetime.now(timezone.utc).isoformat()
        proj = Project(
            id="proj-ocp-001", code="OCP", name="OpenClaw Control Plane MVP",
            description="任务编排与可视化面板 MVP", status="active",
            owner_role="rd-commander", owner_agent_id=None,
            created_at=now, updated_at=now,
        )
        db.add(proj)
        seeds = [
            ("task-rpm-01", "proj-ocp-001", None, "冻结核心字段", "requirement", "Sprint 0", "high", "done", None, "rd-product-manager", None, None, "low", False, None),
            ("task-rba-01", "proj-ocp-001", None, "初始化后端骨架", "backend", "Sprint 1", "high", "done", None, "rd-backend-arch", None, None, "low", False, None),
            ("task-rba-02", "proj-ocp-001", None, "MVP数据库落地+真实CRUD", "backend", "Sprint 1", "high", "in_progress", None, "rd-backend-dev", None, None, "low", False, None),
            ("task-rfa-01", "proj-ocp-001", None, "前端骨架搭建", "frontend", "Sprint 1", "high", "in_progress", None, "rd-frontend-arch", None, None, "low", False, None),
            ("task-rfa-02", "proj-ocp-001", None, "Dashboard接入真实API", "frontend", "Sprint 1", "medium", "planned", None, "rd-frontend-dev", None, None, "low", False, None),
            ("task-rda-01", "proj-ocp-001", None, "测试框架搭建", "test", "Sprint 2", "medium", "planned", None, "test-leader", None, None, "low", False, None),
        ]
        for s in seeds:
            db.add(Task(
                id=s[0], project_id=s[1], parent_task_id=s[2], title=s[3],
                category=s[4], phase=s[5], priority=s[6], status=s[7],
                source_channel=s[8], owner_role=s[9], owner_agent_id=s[10],
                assignee_session_key=s[11], risk_level=s[12], doc_sync_risk=s[13],
                blocked_reason=s[14], created_at=now, updated_at=now,
            ))
        db.commit()
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
