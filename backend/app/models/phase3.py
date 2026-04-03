"""
Phase 3 extended database models for Verification, Plugins, and LSP services.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5
"""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import String, Text, Integer, Float, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _uuid() -> str:
    return str(uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Verification Models ──────────────────────────────────────────

class VerificationReportRecord(Base):
    """Persistent verification report."""
    __tablename__ = "verification_reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    step_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    workflow_instance_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    overall_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    overall_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(50), nullable=False, default=_now)
    completed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    results: Mapped[list["VerificationResultRecord"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )


class VerificationResultRecord(Base):
    """Individual criterion result within a verification report."""
    __tablename__ = "verification_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    report_id: Mapped[str] = mapped_column(String, ForeignKey("verification_reports.id"), nullable=False)
    criterion_id: Mapped[str] = mapped_column(String(100), nullable=False)
    criterion_name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    report: Mapped["VerificationReportRecord"] = relationship(back_populates="results")


# ── Plugin Models ─────────────────────────────────────────────────

class PluginRecord(Base):
    """Registered plugin with lifecycle state."""
    __tablename__ = "plugins"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False, default="0.1.0")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    author: Mapped[str | None] = mapped_column(String(200), nullable=True)
    homepage: Mapped[str | None] = mapped_column(String(500), nullable=True)
    entry_point: Mapped[str | None] = mapped_column(String(500), nullable=True)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="discovered")
    skills: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # JSON array of strings
    tools: Mapped[dict | None] = mapped_column(JSON, nullable=True)   # JSON array of strings
    hooks: Mapped[dict | None] = mapped_column(JSON, nullable=True)   # JSON array of strings
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    loaded_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[str] = mapped_column(String(50), nullable=False, default=_now)
    updated_at: Mapped[str] = mapped_column(String(50), nullable=False, default=_now)


# ── LSP Models ────────────────────────────────────────────────────

class LSPServerRecord(Base):
    """Registered LSP server."""
    __tablename__ = "lsp_servers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    language: Mapped[str] = mapped_column(String(50), nullable=False)
    command: Mapped[str] = mapped_column(String(500), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="stopped")
    workspace_root: Mapped[str | None] = mapped_column(String(500), nullable=True)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[str] = mapped_column(String(50), nullable=False, default=_now)
    updated_at: Mapped[str] = mapped_column(String(50), nullable=False, default=_now)

    diagnostics: Mapped[list["LSPDiagnosticRecord"]] = relationship(
        back_populates="server", cascade="all, delete-orphan"
    )


class LSPDiagnosticRecord(Base):
    """LSP diagnostic entry."""
    __tablename__ = "lsp_diagnostics"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    server_id: Mapped[str] = mapped_column(String, ForeignKey("lsp_servers.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="information")
    line: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    column: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[str] = mapped_column(String(50), nullable=False, default=_now)

    server: Mapped["LSPServerRecord"] = relationship(back_populates="diagnostics")
