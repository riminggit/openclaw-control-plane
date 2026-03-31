"""Review model."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, generate_uuid

if TYPE_CHECKING:
    from app.models.task import Task
    from app.models.user import User


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    review_type: Mapped[str] = mapped_column(
        ENUM("code", "design", "requirement", "dba", name="review_type", create_type=False),
        nullable=False
    )
    decision: Mapped[str] = mapped_column(
        ENUM("PENDING_REVIEW", "APPROVED", "REJECTED", name="review_decision", create_type=False),
        nullable=False, server_default="PENDING_REVIEW"
    )
    comment: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    return_step: Mapped[str | None] = mapped_column(
        ENUM("planned", "development", "review", name="return_step", create_type=False),
        nullable=True
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # relationships
    task: Mapped["Task"] = relationship(back_populates="reviews")
    reviewer: Mapped["User"] = relationship(back_populates="reviews")
