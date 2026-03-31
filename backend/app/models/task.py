"""Task and TaskDependency models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, CheckConstraint, text
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.agent import Agent
    from app.models.user import User
    from app.models.review import Review
    from app.models.artifact import Artifact
    from app.models.dispatch import Dispatch


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    parent_task_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(
        ENUM("P0", "P1", "P2", "P3", name="task_priority", create_type=False),
        nullable=False, server_default="P2"
    )
    status: Mapped[str] = mapped_column(
        ENUM("PLANNED", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE", "ARCHIVED", name="task_status", create_type=False),
        nullable=False, server_default="PLANNED"
    )
    category: Mapped[str | None] = mapped_column(
        ENUM("requirement", "backend", "frontend", "test", "dba", "design", "devops", "doc", name="task_category", create_type=False),
        nullable=True
    )
    risk_level: Mapped[str] = mapped_column(
        ENUM("low", "medium", "high", "critical", name="risk_level", create_type=False),
        nullable=False, server_default="low"
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    block_reason: Mapped[str | None] = mapped_column(
        ENUM("dependency_missing", "resource_insufficient", "requirement_changed", "other", name="block_reason", create_type=False),
        nullable=True
    )
    block_detail: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))

    # relationships
    project: Mapped["Project"] = relationship(back_populates="tasks")
    parent: Mapped["Task | None"] = relationship(remote_side="Task.id", foreign_keys=[parent_task_id])
    assignee: Mapped["Agent | None"] = relationship()
    created_by_user: Mapped["User | None"] = relationship(back_populates="created_tasks")  # noqa: F821
    reviews: Mapped[list["Review"]] = relationship(back_populates="task", cascade="all, delete-orphan")  # noqa: F821
    artifacts: Mapped[list["Artifact"]] = relationship(back_populates="task", cascade="all, delete-orphan")  # noqa: F821
    dispatches: Mapped[list["Dispatch"]] = relationship(back_populates="task", cascade="all, delete-orphan")  # noqa: F821

    # dependency relationships
    dependencies: Mapped[list["TaskDependency"]] = relationship(
        foreign_keys="TaskDependency.task_id", back_populates="task"
    )
    depended_by: Mapped[list["TaskDependency"]] = relationship(
        foreign_keys="TaskDependency.depends_on_id", back_populates="depends_on_task"
    )


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (
        CheckConstraint("task_id <> depends_on_id", name="ck_no_self_dependency"),
    )

    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    depends_on_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    # relationships
    task: Mapped["Task"] = relationship(foreign_keys=[task_id], back_populates="dependencies")
    depends_on_task: Mapped["Task"] = relationship(foreign_keys=[depends_on_id], back_populates="depended_by")
