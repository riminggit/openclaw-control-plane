"""Artifact model."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, Text, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from app.models.task import Task
    from app.models.project import Project


class Artifact(Base, TimestampMixin):
    __tablename__ = "artifacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(
        ENUM("prd", "design", "test_report", "api_doc", name="artifact_type", create_type=False),
        nullable=False
    )
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    feishu_doc_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_folder_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sync_status: Mapped[str] = mapped_column(
        ENUM("PENDING", "SYNCING", "SYNCED", "FAILED", name="sync_status", create_type=False),
        nullable=False, server_default="PENDING"
    )
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    task: Mapped["Task"] = relationship(back_populates="artifacts")
    project: Mapped["Project | None"] = relationship(back_populates="artifacts")
