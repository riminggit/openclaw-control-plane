"""Phase 4: Agent Lifecycle Manager API."""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import get_db, CleanupLog

router = APIRouter(prefix="/api/agents/lifecycle")

CLEANUP_RULES = {
    "zombie": {"max_age_minutes": 60, "action": "kill_and_clean"},
    "completed": {"max_age_minutes": 30, "action": "clean_only"},
    "failed": {"max_age_minutes": 10, "action": "clean_only"},
    "idle": {"max_age_minutes": 30, "action": "warn_only"},
}

# In-memory store for auto-cleanup config (could be DB later)
_auto_cleanup_config = {
    "enabled": False,
    "rules": {k: v.copy() for k, v in CLEANUP_RULES.items()},
    "interval_minutes": 15,
}

# Simulated session store (in production, read from Gateway RPC)
_sessions_store: list[dict] = []


# ── Sync endpoint (frontend pushes Gateway session data here) ──

class SyncSessionsRequest(BaseModel):
    sessions: list[dict] = Field(default_factory=list)

@router.post("/sync")
def sync_sessions(body: SyncSessionsRequest):
    """Accept Gateway session data from the frontend."""
    global _sessions_store
    _sessions_store = body.sessions or []
    return {"ok": True, "count": len(_sessions_store)}


def _classify_session(updated_at_str: str | None, status: str | None) -> str:
    """Classify a session's lifecycle state based on last activity."""
    now = datetime.now(timezone.utc)
    try:
        updated = datetime.fromisoformat(updated_at_str.replace("Z", "+00:00")) if updated_at_str else now
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
    except Exception:
        updated = now
    minutes_ago = (now - updated).total_seconds() / 60

    if status == "completed":
        return "COMPLETED"
    if status == "failed":
        return "FAILED"
    if minutes_ago <= 5:
        return "ACTIVE"
    if minutes_ago <= 30:
        return "IDLE"
    if minutes_ago <= 60:
        return "STALE"
    return "ZOMBIE"


# ── Schemas ──

class CleanupRequest(BaseModel):
    session_keys: list[str] = Field(default_factory=list)
    strategy: Optional[str] = None  # "zombie", "completed", "failed", or specific keys

class AutoCleanupConfig(BaseModel):
    enabled: bool = False
    rules: dict = Field(default_factory=dict)
    interval_minutes: int = 15


# ── Lifecycle list ──

@router.get("")
def list_lifecycle(db: Session = Depends(get_db)):
    # Use in-memory sessions (populated via snapshot or Gateway RPC)
    results = []
    now = datetime.now(timezone.utc)
    for s in _sessions_store:
        state = _classify_session(s.get("updatedAt"), s.get("status"))
        ua = s.get("updatedAt", "")
        try:
            mins_ago = round((now - datetime.fromisoformat(ua.replace("Z", "+00:00"))).total_seconds() / 60, 1) if ua else 0
        except Exception:
            mins_ago = 0
        results.append({
            "session_key": s.get("key", s.get("sessionKey", "")),
            "agent_id": s.get("agentId", s.get("label", "")),
            "agent_label": s.get("label", ""),
            "status": state,
            "channel": s.get("channel", ""),
            "model": s.get("model", ""),
            "total_tokens": s.get("totalTokens", 0),
            "last_active_at": ua,
            "created_at": s.get("createdAt", s.get("startedAt", "")),
        })
    # Sort by state priority
    state_order = {"ZOMBIE": 0, "FAILED": 1, "STALE": 2, "COMPLETED": 3, "IDLE": 4, "ACTIVE": 5}
    results.sort(key=lambda x: state_order.get(x["status"], 99))
    return results


@router.get("/stats")
def lifecycle_stats(db: Session = Depends(get_db)):
    sessions = list_lifecycle(db)
    states = {}
    for s in sessions:
        states[s["state"]] = states.get(s["state"], 0) + 1
    total_cleaned = db.query(CleanupLog).count()
    return {"state_distribution": states, "total_sessions": len(sessions), "total_cleaned": total_cleaned}


# ── Cleanup ──

@router.post("/cleanup")
def cleanup_sessions(body: CleanupRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    cleaned = []
    if body.session_keys:
        keys_to_clean = body.session_keys
    elif body.strategy and body.strategy in CLEANUP_RULES:
        keys_to_clean = []
        for s in _sessions_store:
            key = s.get("key", s.get("sessionKey", ""))
            state = _classify_session(s.get("updatedAt"), s.get("status"))
            if state == body.strategy.upper():
                keys_to_clean.append(key)
    else:
        return {"cleaned": [], "message": "No targets specified"}

    for key in keys_to_clean:
        s = next((x for x in _sessions_store if x.get("key") == key or x.get("sessionKey") == key), None)
        if s:
            state = _classify_session(s.get("updatedAt"), s.get("status"))
            rule = CLEANUP_RULES.get(state.lower(), {"action": "clean_only"})
            log = CleanupLog(
                id=str(uuid.uuid4()), session_key=key,
                agent_id=s.get("agentId"), agent_label=s.get("label"),
                lifecycle_state=state, action=rule["action"],
                detail=f"Cleaned via {body.strategy or 'manual'}", cleaned_at=now,
            )
            db.add(log)
            cleaned.append({"session_key": key, "state": state, "action": rule["action"]})

    # Remove from store
    _sessions_store[:] = [s for s in _sessions_store if s.get("key", s.get("sessionKey")) not in keys_to_clean]
    db.commit()
    return {"cleaned": cleaned, "count": len(cleaned)}


@router.post("/cleanup/auto")
def auto_cleanup(db: Session = Depends(get_db)):
    """Execute automatic cleanup based on rules."""
    now = datetime.now(timezone.utc).isoformat()
    cleaned = []
    for s in _sessions_store:
        key = s.get("key", s.get("sessionKey", ""))
        state = _classify_session(s.get("updatedAt"), s.get("status"))
        rule = CLEANUP_RULES.get(state.lower())
        if rule and rule["action"] != "warn_only":
            log = CleanupLog(
                id=str(uuid.uuid4()), session_key=key,
                agent_id=s.get("agentId"), agent_label=s.get("label"),
                lifecycle_state=state, action=rule["action"],
                detail="Auto cleanup", cleaned_at=now,
            )
            db.add(log)
            cleaned.append({"session_key": key, "state": state, "action": rule["action"]})

    cleaned_keys = {c["session_key"] for c in cleaned}
    _sessions_store[:] = [s for s in _sessions_store if s.get("key", s.get("sessionKey")) not in cleaned_keys]
    db.commit()
    return {"cleaned": cleaned, "count": len(cleaned), "config": _auto_cleanup_config}


# ── Auto cleanup config ──

@router.get("/auto-cleanup")
def get_auto_cleanup():
    return _auto_cleanup_config


@router.post("/auto-cleanup")
def set_auto_cleanup(body: AutoCleanupConfig):
    _auto_cleanup_config["enabled"] = body.enabled
    if body.rules:
        _auto_cleanup_config["rules"].update(body.rules)
    if body.interval_minutes:
        _auto_cleanup_config["interval_minutes"] = body.interval_minutes
    return _auto_cleanup_config


# ── Cleanup history ──

@router.get("/history")
@router.get("/cleanup-logs")
def cleanup_history(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    rows = db.query(CleanupLog).order_by(CleanupLog.cleaned_at.desc()).limit(limit).all()
    return [{"id": r.id, "session_key": r.session_key, "agent_id": r.agent_id, "agent_label": r.agent_label,
             "lifecycle_state": r.lifecycle_state, "action": r.action, "detail": r.detail, "cleaned_at": r.cleaned_at}
            for r in rows]


# ── Aliases for frontend compatibility ──

@router.get("/config")
def get_config_alias():
    return _auto_cleanup_config

@router.post("/config")
def set_config_alias(body: AutoCleanupConfig):
    _auto_cleanup_config["enabled"] = body.enabled
    if body.rules:
        _auto_cleanup_config["rules"].update(body.rules)
    if body.interval_minutes:
        _auto_cleanup_config["interval_minutes"] = body.interval_minutes
    return _auto_cleanup_config
