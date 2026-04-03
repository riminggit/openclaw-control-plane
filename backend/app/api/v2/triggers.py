"""
Remote Triggers API — Phase 3 P3-10/P3-11

REST API endpoints for the RemoteTriggerService,
including webhook receiving endpoints.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Any, Optional

from app.db import get_db
from app.services.triggers import get_trigger_service, TriggerState, TriggerType


router = APIRouter(prefix="/api/v2/triggers", tags=["v3", "triggers"])


# ── Request Schemas ─────────────────────────────────────────

class CreateTriggerRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = ""
    trigger_type: str = "webhook"  # webhook | api_callback | event_bridge | custom
    secret: str = ""
    allowed_ips: list[str] = Field(default_factory=list)
    workflow_template_id: str = ""
    workflow_params: dict[str, Any] = Field(default_factory=dict)
    agent_id: str = ""
    headers: dict[str, str] = Field(default_factory=dict)
    rate_limit_per_minute: int = 60


class UpdateTriggerRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    secret: Optional[str] = None
    allowed_ips: Optional[list[str]] = None
    workflow_params: Optional[dict[str, Any]] = None
    rate_limit_per_minute: Optional[int] = None


# ── CRUD Endpoints ──────────────────────────────────────────

@router.get("")
async def list_triggers(trigger_type: str = "", state: str = "", db: Session = Depends(get_db)):
    """List triggers, optionally filtered."""
    svc = get_trigger_service()
    filter_type = TriggerType(trigger_type) if trigger_type else None
    filter_state = TriggerState(state) if state else None
    triggers = await svc.list_triggers(db, trigger_type=filter_type, state=filter_state)
    return {"triggers": [_trigger_to_dict(t) for t in triggers], "total": len(triggers)}


@router.post("")
async def create_trigger(req: CreateTriggerRequest, db: Session = Depends(get_db)):
    """Create a new trigger."""
    svc = get_trigger_service()
    trigger = await svc.create_trigger(db, req.model_dump())
    return _trigger_to_dict(trigger)


@router.get("/{trigger_id}")
async def get_trigger(trigger_id: str, db: Session = Depends(get_db)):
    """Get a trigger by ID."""
    svc = get_trigger_service()
    trigger = await svc.get_trigger(db, trigger_id)
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return _trigger_to_dict(trigger)


@router.patch("/{trigger_id}")
async def update_trigger(trigger_id: str, req: UpdateTriggerRequest, db: Session = Depends(get_db)):
    """Update a trigger."""
    svc = get_trigger_service()
    patch = {k: v for k, v in req.model_dump().items() if v is not None}
    try:
        trigger = await svc.update_trigger(db, trigger_id, patch)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _trigger_to_dict(trigger)


@router.delete("/{trigger_id}")
async def delete_trigger(trigger_id: str, db: Session = Depends(get_db)):
    """Delete a trigger."""
    svc = get_trigger_service()
    deleted = await svc.delete_trigger(db, trigger_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return {"ok": True}


@router.get("/{trigger_id}/events")
async def get_events(trigger_id: str, limit: int = 50, db: Session = Depends(get_db)):
    """Get recent events for a trigger."""
    svc = get_trigger_service()
    events = await svc.get_events(db, trigger_id, limit=limit)
    return {"events": [_event_to_dict(e) for e in events], "total": len(events)}


# ── Webhook Receiver ────────────────────────────────────────

@router.post("/webhook/{trigger_id}")
async def receive_webhook(trigger_id: str, request: Request, db: Session = Depends(get_db)):
    """
    Receive an incoming webhook.

    This is the public endpoint that external services call.
    It verifies the signature and triggers the associated workflow.
    """
    svc = get_trigger_service()

    # Extract headers
    headers = dict(request.headers)
    source_ip = request.client.host if request.client else ""

    # Parse payload
    try:
        payload = await request.json()
    except Exception:
        payload = {"raw_body": str(await request.body())}

    try:
        event = await svc.handle_webhook(
            db,
            trigger_id=trigger_id,
            payload=payload,
            headers=headers,
            source_ip=source_ip,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {
        "ok": True,
        "event_id": event.id,
        "verified": event.verified,
    }


def _trigger_to_dict(trigger: Any) -> dict:
    return {
        "id": trigger.id,
        "name": trigger.name,
        "description": trigger.description,
        "trigger_type": trigger.trigger_type.value if hasattr(trigger.trigger_type, 'value') else trigger.trigger_type,
        "state": trigger.state.value if hasattr(trigger.state, 'value') else trigger.state,
        "webhook_url": trigger.webhook_url,
        "allowed_ips": trigger.allowed_ips,
        "workflow_template_id": trigger.workflow_template_id,
        "agent_id": trigger.agent_id,
        "rate_limit_per_minute": trigger.rate_limit_per_minute,
        "created_at": trigger.created_at,
        "updated_at": trigger.updated_at,
    }


def _event_to_dict(event: Any) -> dict:
    return {
        "id": event.id,
        "trigger_id": event.trigger_id,
        "verified": event.verified,
        "source_ip": event.source_ip,
        "result": event.result,
        "error": event.error,
        "created_at": event.created_at,
    }
