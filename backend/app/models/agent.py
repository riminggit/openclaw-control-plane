"""Agent model."""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Agent(Base):
    """
    Agent 信息表
    
    This model matches the database schema defined in workflow-schema.sql
    and includes all fields needed for the workflow management system.
    """
    __tablename__ = "agents"
    __table_args__ = {'extend_existing': True}  # Allow redefinition if needed
    
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    display_name: Mapped[Optional[str]] = mapped_column(String)
    capabilities: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON array
    status: Mapped[str] = mapped_column(String, nullable=False, default="offline")  # online / degraded / offline
    current_task_id: Mapped[Optional[str]] = mapped_column(String)
    current_workflow_instance_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("workflow_instances.id", ondelete="SET NULL"))
    current_step_execution_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("step_executions.id", ondelete="SET NULL"))
    last_heartbeat: Mapped[Optional[str]] = mapped_column(String)
    config: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    metadata_json: Mapped[Optional[str]] = mapped_column("metadata", Text)  # Map to 'metadata' column in DB
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
