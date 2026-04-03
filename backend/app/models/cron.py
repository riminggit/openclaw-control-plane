"""
Cron and Trigger database models for Phase 3.

Provides persistent storage for scheduled jobs and their execution history.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import String, Text, Integer, Float, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def generate_uuid() -> str:
    return str(uuid4())


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class CronJob(Base):
    """
    A scheduled cron job definition.
    
    Supports cron expressions, one-time schedules, and interval-based execution.
    """
    __tablename__ = "cron_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Schedule configuration
    schedule_type: Mapped[str] = mapped_column(String(20), nullable=False, default="cron")  # cron | at | every
    cron_expr: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g., "0 9 * * 1-5"
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    interval_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # for 'every' type
    run_at: Mapped[str | None] = mapped_column(String(50), nullable=True)  # ISO datetime for 'at' type
    
    # Target configuration
    workflow_template_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    workflow_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    agent_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    message_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # State
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # active | paused | disabled | error
    last_run: Mapped[str | None] = mapped_column(String(50), nullable=True)
    next_run: Mapped[str | None] = mapped_column(String(50), nullable=True)
    run_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_runs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0 = unlimited
    
    # APScheduler job ID for tracking
    aps_job_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    # Timestamps
    created_at: Mapped[str] = mapped_column(String(50), nullable=False, default=utcnow)
    updated_at: Mapped[str] = mapped_column(String(50), nullable=False, default=utcnow)
    
    # Relationships
    executions: Mapped[list["CronExecution"]] = relationship(back_populates="job", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<CronJob(id={self.id[:8]}, name={self.name}, type={self.schedule_type})>"


class CronExecution(Base):
    """
    Record of a single cron job execution.
    """
    __tablename__ = "cron_executions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    job_id: Mapped[str] = mapped_column(String, ForeignKey("cron_jobs.id"), nullable=False)
    
    # Execution state
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending | running | success | failed | timeout | skipped
    
    # Timing
    started_at: Mapped[str] = mapped_column(String(50), nullable=False, default=utcnow)
    completed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    # Results
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Trigger info
    trigger_type: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")  # scheduled | manual
    
    # Relationship
    job: Mapped["CronJob"] = relationship(back_populates="executions")

    def __repr__(self) -> str:
        return f"<CronExecution(id={self.id[:8]}, job={self.job_id[:8]}, state={self.state})>"


class TriggerConfig(Base):
    """
    Configuration for a remote trigger (webhook, API callback, etc.).
    """
    __tablename__ = "trigger_configs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Type
    trigger_type: Mapped[str] = mapped_column(String(20), nullable=False, default="webhook")  # webhook | api_callback | event_bridge | custom
    
    # State
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # active | paused | disabled | error
    
    # Security
    secret: Mapped[str] = mapped_column(String(100), nullable=False, default=generate_uuid)  # for signature verification
    allowed_ips: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of IPs
    
    # Target configuration
    workflow_template_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    workflow_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    agent_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    # Rate limiting
    rate_limit_per_minute: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    
    # Headers validation
    expected_headers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    
    # Timestamps
    created_at: Mapped[str] = mapped_column(String(50), nullable=False, default=utcnow)
    updated_at: Mapped[str] = mapped_column(String(50), nullable=False, default=utcnow)
    
    # Relationships
    events: Mapped[list["TriggerEvent"]] = relationship(back_populates="trigger", cascade="all, delete-orphan")

    @property
    def webhook_url(self) -> str:
        return f"/api/v2/triggers/webhook/{self.id}"

    def __repr__(self) -> str:
        return f"<TriggerConfig(id={self.id[:8]}, name={self.name}, type={self.trigger_type})>"


class TriggerEvent(Base):
    """
    Record of a trigger invocation.
    """
    __tablename__ = "trigger_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    trigger_id: Mapped[str] = mapped_column(String, ForeignKey("trigger_configs.id"), nullable=False)
    
    # Request data
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    headers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    source_ip: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    # Verification
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    
    # Result
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Timestamp
    created_at: Mapped[str] = mapped_column(String(50), nullable=False, default=utcnow)
    
    # Relationship
    trigger: Mapped["TriggerConfig"] = relationship(back_populates="events")

    def __repr__(self) -> str:
        return f"<TriggerEvent(id={self.id[:8]}, trigger={self.trigger_id[:8]}, verified={self.verified})>"
