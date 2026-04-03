"""
LSP Service API — Phase 3 P3-12/P3-13

REST API endpoints for the LSPService.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Any, Optional

from app.db import get_db
from app.services.lsp import get_lsp_service


router = APIRouter(prefix="/api/v2/lsp", tags=["v3", "lsp"])


# ── Request Schemas ─────────────────────────────────────────

class RegisterServerRequest(BaseModel):
    language: str = Field(..., min_length=1)
    command: str = Field(..., min_length=1)
    root_uri: str = ""


class AddDiagnosticsRequest(BaseModel):
    file_path: str = Field(..., min_length=1)
    diagnostics: list[dict[str, Any]] = Field(default_factory=list)


# ── Server Management Endpoints ─────────────────────────────

@router.get("/servers")
async def list_servers(language: str = "", db: Session = Depends(get_db)):
    """List LSP servers."""
    svc = get_lsp_service()
    servers = await svc.list_servers(db, language=language)
    return {"servers": [_server_to_dict(s) for s in servers], "total": len(servers)}


@router.post("/servers")
async def register_server(req: RegisterServerRequest, db: Session = Depends(get_db)):
    """Register a new LSP server."""
    svc = get_lsp_service()
    server = await svc.register_server(db, req.model_dump())
    return _server_to_dict(server)


@router.get("/servers/{server_id}")
async def get_server(server_id: str, db: Session = Depends(get_db)):
    """Get an LSP server by ID."""
    svc = get_lsp_service()
    server = await svc.get_server(db, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return _server_to_dict(server)


@router.post("/servers/{server_id}/start")
async def start_server(server_id: str, db: Session = Depends(get_db)):
    """Start an LSP server."""
    svc = get_lsp_service()
    try:
        server = await svc.start_server(db, server_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _server_to_dict(server)


@router.post("/servers/{server_id}/stop")
async def stop_server(server_id: str, db: Session = Depends(get_db)):
    """Stop an LSP server."""
    svc = get_lsp_service()
    try:
        server = await svc.stop_server(db, server_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _server_to_dict(server)


@router.delete("/servers/{server_id}")
async def remove_server(server_id: str, db: Session = Depends(get_db)):
    """Remove an LSP server."""
    svc = get_lsp_service()
    removed = await svc.remove_server(db, server_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Server not found")
    return {"ok": True}


# ── Diagnostics Endpoints ───────────────────────────────────

@router.get("/diagnostics")
async def get_diagnostics(file_path: str = "", db: Session = Depends(get_db)):
    """Get diagnostics, optionally filtered by file path."""
    svc = get_lsp_service()
    diagnostics = await svc.get_diagnostics(db, file_path=file_path)
    return {
        "diagnostics": [_diagnostic_to_dict(d) for d in diagnostics],
        "total": len(diagnostics),
    }


@router.post("/diagnostics")
async def add_diagnostics(req: AddDiagnosticsRequest, db: Session = Depends(get_db)):
    """Add diagnostics for a file (used by LSP notification handler)."""
    svc = get_lsp_service()
    await svc.add_diagnostics(db, req.file_path, req.diagnostics)
    return {"ok": True}


def _server_to_dict(server: Any) -> dict:
    return {
        "id": server.id,
        "language": server.language,
        "command": server.command,
        "root_uri": server.root_uri,
        "status": server.status,
        "pid": server.pid,
        "error_message": server.error_message,
        "started_at": server.started_at,
    }


def _diagnostic_to_dict(diag: Any) -> dict:
    return {
        "id": diag.id,
        "file_path": diag.file_path,
        "line": diag.line,
        "column": diag.column,
        "end_line": diag.end_line,
        "end_column": diag.end_column,
        "severity": diag.severity.value if hasattr(diag.severity, 'value') else diag.severity,
        "source": diag.source,
        "code": diag.code,
        "message": diag.message,
        "created_at": diag.created_at,
    }
