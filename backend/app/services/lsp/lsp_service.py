"""
LSPService — Language Server Protocol integration.

Manages LSP server connections for real-time code diagnostics,
providing agents with IDE-quality code analysis capabilities.

All data is persisted to SQLite via LSPServerRecord and
LSPDiagnosticRecord DB models.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5 P3-12
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import IntEnum
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.phase3 import LSPServerRecord, LSPDiagnosticRecord


logger = logging.getLogger(__name__)


# ── DTO Enums & Dataclasses ────────────────────────────────────

class DiagnosticSeverity(IntEnum):
    """LSP diagnostic severity levels."""
    ERROR = 1
    WARNING = 2
    INFORMATION = 3
    HINT = 4


@dataclass
class LSPDiagnostic:
    """A single LSP diagnostic item."""
    id: str = field(default_factory=lambda: str(uuid4()))
    file_path: str = ""
    line: int = 0
    column: int = 0
    end_line: int = 0
    end_column: int = 0
    severity: DiagnosticSeverity = DiagnosticSeverity.ERROR
    source: str = ""  # e.g., "pyright", "eslint"
    code: str = ""
    message: str = ""
    related_info: list[dict[str, Any]] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class LSPServerInfo:
    """Information about a managed LSP server."""
    id: str = field(default_factory=lambda: str(uuid4()))
    language: str = ""  # e.g., "python", "typescript", "go"
    command: str = ""  # Command to start the LSP server
    root_uri: str = ""
    status: str = "stopped"  # stopped | starting | running | error
    pid: int | None = None
    diagnostics: list[LSPDiagnostic] = field(default_factory=list)
    error_message: str = ""
    started_at: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


# ── DB Record → DTO helpers ────────────────────────────────────

def _record_to_server_info(rec: LSPServerRecord) -> LSPServerInfo:
    """Convert an LSPServerRecord to an LSPServerInfo DTO."""
    return LSPServerInfo(
        id=rec.id,
        language=rec.language,
        command=rec.command,
        root_uri=rec.workspace_root or "",
        status=rec.state,
        pid=None,  # Not tracked in DB model
        diagnostics=[],  # Not eagerly loaded by default
        error_message=rec.error_message or "",
        started_at=rec.started_at,
        metadata=rec.config or {},
    )


def _record_to_diagnostic(rec: LSPDiagnosticRecord) -> LSPDiagnostic:
    """Convert an LSPDiagnosticRecord to an LSPDiagnostic DTO."""
    severity_map = {
        "error": DiagnosticSeverity.ERROR,
        "warning": DiagnosticSeverity.WARNING,
        "information": DiagnosticSeverity.INFORMATION,
        "hint": DiagnosticSeverity.HINT,
    }
    return LSPDiagnostic(
        id=rec.id,
        file_path=rec.file_path,
        line=rec.line,
        column=rec.column,
        end_line=0,  # Not in DB model
        end_column=0,  # Not in DB model
        severity=severity_map.get(rec.severity, DiagnosticSeverity.INFORMATION),
        source=rec.source or "",
        code=rec.code or "",
        message=rec.message,
        created_at=rec.created_at,
    )


class LSPService:
    """
    Manages LSP server instances and collects diagnostics.

    All data is persisted to the database via SQLAlchemy Session.
    The service is stateless and safe to use as a singleton.
    """

    async def register_server(self, db: Session, config: dict[str, Any]) -> LSPServerInfo:
        """
        Register an LSP server configuration.

        Args:
            db: SQLAlchemy session.
            config: Server config with {language, command, root_uri}.
        """
        rec = LSPServerRecord(
            name=config.get("language", "unknown"),
            language=config.get("language", "unknown"),
            command=config.get("command", ""),
            workspace_root=config.get("root_uri", ""),
            state="stopped",
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        logger.info("Registered LSP server for %s (id=%s)", rec.language, rec.id)
        return _record_to_server_info(rec)

    async def start_server(self, db: Session, server_id: str) -> LSPServerInfo:
        """
        Start an LSP server process.

        Updates the DB record state to 'running'.
        """
        rec = db.query(LSPServerRecord).filter(LSPServerRecord.id == server_id).first()
        if not rec:
            raise ValueError(f"Server {server_id} not found")

        rec.state = "starting"
        db.commit()

        try:
            # TODO: Phase 3 — real LSP server process management
            rec.state = "running"
            rec.started_at = datetime.now(timezone.utc).isoformat()
            logger.info("Started LSP server %s for %s", server_id, rec.language)
        except Exception as e:
            rec.state = "error"
            rec.error_message = str(e)
            logger.error("Failed to start LSP server %s: %s", server_id, e)

        db.commit()
        db.refresh(rec)
        return _record_to_server_info(rec)

    async def stop_server(self, db: Session, server_id: str) -> LSPServerInfo:
        """Stop an LSP server process."""
        rec = db.query(LSPServerRecord).filter(LSPServerRecord.id == server_id).first()
        if not rec:
            raise ValueError(f"Server {server_id} not found")

        # TODO: Phase 3 — real process termination
        rec.state = "stopped"
        rec.started_at = None
        db.commit()
        db.refresh(rec)
        logger.info("Stopped LSP server %s", server_id)
        return _record_to_server_info(rec)

    async def get_diagnostics(self, db: Session, file_path: str = "") -> list[LSPDiagnostic]:
        """
        Get diagnostics, optionally filtered by file path.

        Queries the LSPDiagnosticRecord table.
        """
        q = db.query(LSPDiagnosticRecord)
        if file_path:
            q = q.filter(LSPDiagnosticRecord.file_path == file_path)
        return [_record_to_diagnostic(d) for d in q.all()]

    async def add_diagnostics(
        self,
        db: Session,
        file_path: str,
        diagnostics: list[dict[str, Any]],
        server_id: str = "",
    ) -> None:
        """
        Add diagnostics for a file (used by LSP notification handler).

        If server_id is not provided, attempts to find any existing server.
        """
        # Resolve server_id if not provided
        if not server_id:
            any_server = db.query(LSPServerRecord).first()
            if any_server:
                server_id = any_server.id
            else:
                logger.warning("No LSP server found, skipping diagnostics for %s", file_path)
                return

        severity_map = {
            1: "error",
            2: "warning",
            3: "information",
            4: "hint",
        }

        # Remove existing diagnostics for this file from this server
        db.query(LSPDiagnosticRecord).filter(
            LSPDiagnosticRecord.server_id == server_id,
            LSPDiagnosticRecord.file_path == file_path,
        ).delete()

        for d in diagnostics:
            raw_severity = d.get("severity", 3)
            severity_str = severity_map.get(raw_severity, "information") if isinstance(raw_severity, int) else str(raw_severity)
            diag_rec = LSPDiagnosticRecord(
                server_id=server_id,
                file_path=file_path,
                severity=severity_str,
                line=d.get("line", 0),
                column=d.get("column", 0),
                message=d.get("message", ""),
                source=d.get("source", ""),
                code=d.get("code", ""),
            )
            db.add(diag_rec)

        db.commit()
        logger.debug("Added %d diagnostics for %s", len(diagnostics), file_path)

    async def get_server(self, db: Session, server_id: str) -> LSPServerInfo | None:
        """Get server info by ID."""
        rec = db.query(LSPServerRecord).filter(LSPServerRecord.id == server_id).first()
        if not rec:
            return None
        return _record_to_server_info(rec)

    async def list_servers(self, db: Session, language: str = "") -> list[LSPServerInfo]:
        """List LSP servers, optionally filtered by language."""
        q = db.query(LSPServerRecord)
        if language:
            q = q.filter(LSPServerRecord.language == language)
        return [_record_to_server_info(s) for s in q.all()]

    async def remove_server(self, db: Session, server_id: str) -> bool:
        """Remove an LSP server configuration."""
        rec = db.query(LSPServerRecord).filter(LSPServerRecord.id == server_id).first()
        if not rec:
            return False
        db.delete(rec)
        db.commit()
        logger.info("Removed LSP server %s", server_id)
        return True
