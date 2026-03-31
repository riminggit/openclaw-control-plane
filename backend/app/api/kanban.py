"""Phase 4: Real-time Kanban — Gateway cards aggregation + drag actions."""

import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db, ActivityLog

router = APIRouter(prefix="/api/kanban")

# ── In-memory cache for Gateway data (pushed by frontend) ──

_cached_sessions: list[dict] = []
_cached_crons: list[dict] = []
_cache_updated_at: str = ""


# ── Schemas ──

class GatewayCard(BaseModel):
    source: str       # 'gateway-session', 'gateway-cron', 'local'
    type: str         # 'session', 'cron', 'task'
    card_id: str
    label: str
    channel: str
    status: str
    column: str
    total_tokens: int = 0
    updated_at: str
    extra: dict = {}


class SyncRequest(BaseModel):
    sessions: list[dict] = []
    crons: list[dict] = []


class DragActionRequest(BaseModel):
    card_source: str    # 'gateway-session', 'gateway-cron', 'local'
    card_id: str
    from_column: str
    to_column: str
    reason: Optional[str] = None


class DragActionResponse(BaseModel):
    success: bool
    action: Optional[dict] = None
    error: Optional[str] = None
    activity_log_id: Optional[str] = None


# ── Session → Column mapping ──

def _session_to_column(session: dict) -> str:
    result = session.get("result") or ""
    status = session.get("status") or session.get("state") or "running"
    if result == "completed":
        return "done"
    if result == "failed":
        return "failed"
    if result == "error":
        return "failed"
    if status == "running" or status == "active":
        # Check idle time
        updated_at = session.get("updatedAt") or session.get("updated_at") or ""
        if updated_at:
            try:
                updated = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
                if updated.tzinfo is None:
                    updated = updated.replace(tzinfo=timezone.utc)
                minutes_ago = (datetime.now(timezone.utc) - updated).total_seconds() / 60
                if minutes_ago > 5:
                    return "planned"
            except Exception:
                pass
        return "in_progress"
    if status == "idle":
        return "planned"
    if status == "completed":
        return "done"
    return "planned"


def _cron_to_column(cron: dict) -> str:
    enabled = cron.get("enabled", True)
    running = cron.get("running", False)
    if not enabled:
        return "blocked"  # paused
    if running:
        return "in_progress"
    return "planned"


# ── POST /api/kanban/sync ──

@router.post("/sync")
def sync_gateway_data(req: SyncRequest):
    global _cached_sessions, _cached_crons, _cache_updated_at
    _cached_sessions = req.sessions or []
    _cached_crons = req.crons or []
    _cache_updated_at = datetime.now(timezone.utc).isoformat()
    return {"ok": True, "sessions_count": len(_cached_sessions), "crons_count": len(_cached_crons)}


# ── GET /api/kanban/gateway-cards ──

@router.get("/gateway-cards")
def get_gateway_cards():
    cards = []

    for s in _cached_sessions:
        col = _session_to_column(s)
        cards.append(GatewayCard(
            source="gateway-session",
            type="session",
            card_id=s.get("key", s.get("sessionKey", "")),
            label=s.get("label", s.get("key", "")),
            channel=s.get("channel", ""),
            status=s.get("result") or s.get("status", "running"),
            column=col,
            total_tokens=s.get("totalTokens", 0) or 0,
            updated_at=s.get("updatedAt", s.get("updated_at", "")),
            extra=s,
        ).model_dump())

    for c in _cached_crons:
        col = _cron_to_column(c)
        cards.append(GatewayCard(
            source="gateway-cron",
            type="cron",
            card_id=c.get("id", c.get("jobId", "")),
            label=c.get("label", c.get("name", c.get("id", ""))),
            channel="",
            status="disabled" if not c.get("enabled", True) else "active",
            column=col,
            updated_at=c.get("nextRunAt", c.get("updatedAt", "")),
            extra=c,
        ).model_dump())

    return {"cards": cards, "cache_updated_at": _cache_updated_at}


# ── POST /api/kanban/drag-action ──

@router.post("/drag-action")
def execute_drag_action(req: DragActionRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    action = None
    error = None

    try:
        # Determine what real action to take based on drag
        if req.card_source == "gateway-session":
            if req.to_column == "done":
                action = {"action": "session.stop", "session_key": req.card_id}
            elif req.to_column == "blocked":
                msg = f"BLOCKED: {req.reason}" if req.reason else "BLOCKED"
                action = {"action": "session.send", "session_key": req.card_id, "message": msg}
            elif req.from_column == "failed" and req.to_column == "in_progress":
                action = {"action": "session.send", "session_key": req.card_id, "message": "RETRY"}
            elif req.to_column == "planned":
                action = {"action": "session.send", "session_key": req.card_id, "message": "PAUSE"}
            else:
                action = {"action": "session.status_change", "session_key": req.card_id, "new_column": req.to_column}

        elif req.card_source == "gateway-cron":
            if req.to_column == "blocked":
                action = {"action": "cron.update", "job_id": req.card_id, "enabled": False}
            elif req.to_column in ("in_progress", "planned"):
                if req.from_column == "blocked":
                    action = {"action": "cron.update", "job_id": req.card_id, "enabled": True}
                else:
                    action = {"action": "cron.run", "job_id": req.card_id}
            else:
                action = {"action": "cron.update", "job_id": req.card_id, "enabled": True}

        elif req.card_source == "local":
            action = {"action": "task.update", "task_id": req.card_id, "new_status": req.to_column}

        else:
            error = f"Unknown card source: {req.card_source}"

    except Exception as e:
        error = str(e)

    # Write activity log
    log_id = str(uuid.uuid4())
    log_msg = f"Kanban drag: {req.card_source} '{req.card_id}' from {req.from_column} → {req.to_column}"
    if req.reason:
        log_msg += f" (reason: {req.reason})"

    try:
        db.add(ActivityLog(
            id=log_id,
            event_type="kanban_drag",
            actor_type="user",
            message=log_msg,
            metadata_json=f'{{"card_source":"{req.card_source}","card_id":"{req.card_id}","from":"{req.from_column}","to":"{req.to_column}","action":{repr(action)}}}',
            created_at=now,
        ))
        db.commit()
    except Exception:
        pass

    if error:
        return DragActionResponse(success=False, error=error, activity_log_id=log_id)
    return DragActionResponse(success=True, action=action, activity_log_id=log_id)
