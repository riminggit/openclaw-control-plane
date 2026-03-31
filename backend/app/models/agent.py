"""Agent model."""

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Boolean, DateTime, text
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, generate_uuid


class Agent(Base, TimestampMixin):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        ENUM("online", "offline", name="agent_status", create_type=False),
        nullable=False, server_default="offline"
    )
    current_task_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
