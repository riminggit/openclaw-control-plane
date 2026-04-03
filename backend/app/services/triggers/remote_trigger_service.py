"""
RemoteTriggerService — Webhook and remote trigger management.

Manages incoming webhooks and other remote triggers that can
start workflows or send notifications to agents.

All data is persisted to SQLite via TriggerConfig and TriggerEvent
DB models (defined in app.models.cron).

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5 P3-10
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.cron import TriggerConfig as TriggerConfigRecord
from app.models.cron import TriggerEvent as TriggerEventRecord


logger = logging.getLogger(__name__)


# ── DTO Enums & Dataclasses ────────────────────────────────────

class TriggerState(str, Enum):
    """Trigger lifecycle state."""
    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"
    ERROR = "error"


class TriggerType(str, Enum):
    """Type of remote trigger."""
    WEBHOOK = "webhook"
    API_CALLBACK = "api_callback"
    EVENT_BRIDGE = "event_bridge"
    CUSTOM = "custom"


@dataclass
class TriggerConfigDTO:
    """Configuration for a remote trigger (DTO)."""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: str = ""
    trigger_type: TriggerType = TriggerType.WEBHOOK
    state: TriggerState = TriggerState.ACTIVE
    secret: str = ""  # For webhook signature verification
    allowed_ips: list[str] = field(default_factory=list)  # IP whitelist
    workflow_template_id: str = ""
    workflow_params: dict[str, Any] = field(default_factory=dict)
    agent_id: str = ""  # Target agent for notification triggers
    headers: dict[str, str] = field(default_factory=dict)  # Expected headers
    rate_limit_per_minute: int = 60
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def webhook_url(self) -> str:
        """Generate the webhook URL for this trigger."""
        return f"/api/v2/triggers/webhook/{self.id}"


@dataclass
class TriggerEventDTO:
    """Record of a trigger invocation (DTO)."""
    id: str = field(default_factory=lambda: str(uuid4()))
    trigger_id: str = ""
    payload: dict[str, Any] = field(default_factory=dict)
    headers: dict[str, str] = field(default_factory=dict)
    source_ip: str = ""
    verified: bool = False
    result: Any = None
    error: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: dict[str, Any] = field(default_factory=dict)


# ── DB Record → DTO helpers ────────────────────────────────────

def _record_to_trigger_config_dto(rec: TriggerConfigRecord) -> TriggerConfigDTO:
    """Convert a TriggerConfig DB record to a TriggerConfigDTO."""
    allowed_ips: list[str] = []
    if rec.allowed_ips:
        try:
            allowed_ips = json.loads(rec.allowed_ips)
        except (json.JSONDecodeError, TypeError):
            allowed_ips = []

    return TriggerConfigDTO(
        id=rec.id,
        name=rec.name,
        description=rec.description or "",
        trigger_type=TriggerType(rec.trigger_type),
        state=TriggerState(rec.state),
        secret=rec.secret,
        allowed_ips=allowed_ips,
        workflow_template_id=rec.workflow_template_id or "",
        workflow_params=rec.workflow_params or {},
        agent_id=rec.agent_id or "",
        headers=rec.expected_headers or {},
        rate_limit_per_minute=rec.rate_limit_per_minute,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def _record_to_trigger_event_dto(rec: TriggerEventRecord) -> TriggerEventDTO:
    """Convert a TriggerEvent DB record to a TriggerEventDTO."""
    return TriggerEventDTO(
        id=rec.id,
        trigger_id=rec.trigger_id,
        payload=rec.payload or {},
        headers=rec.headers or {},
        source_ip=rec.source_ip or "",
        verified=rec.verified,
        result=rec.result,
        error=rec.error or "",
        created_at=rec.created_at,
    )


class RemoteTriggerService:
    """
    Manages remote triggers and webhooks for workflow automation.

    All data is persisted to the database via SQLAlchemy Session.
    The service is stateless and safe to use as a singleton.
    """

    async def create_trigger(self, db: Session, config: dict[str, Any]) -> TriggerConfigDTO:
        """Create a new remote trigger."""
        allowed_ips = config.get("allowed_ips", [])
        rec = TriggerConfigRecord(
            name=config.get("name", "Unnamed Trigger"),
            description=config.get("description", ""),
            trigger_type=config.get("trigger_type", "webhook"),
            state="active",
            secret=config.get("secret", "") or uuid4().hex,
            allowed_ips=json.dumps(allowed_ips) if allowed_ips else None,
            workflow_template_id=config.get("workflow_template_id") or None,
            workflow_params=config.get("workflow_params"),
            agent_id=config.get("agent_id") or None,
            expected_headers=config.get("headers"),
            rate_limit_per_minute=config.get("rate_limit_per_minute", 60),
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        logger.info("Created trigger %s (%s, type=%s)", rec.name, rec.id, rec.trigger_type)
        return _record_to_trigger_config_dto(rec)

    async def update_trigger(self, db: Session, trigger_id: str, patch: dict[str, Any]) -> TriggerConfigDTO:
        """Update a trigger's configuration."""
        rec = db.query(TriggerConfigRecord).filter(TriggerConfigRecord.id == trigger_id).first()
        if not rec:
            raise ValueError(f"Trigger {trigger_id} not found")

        for key, value in patch.items():
            if key == "allowed_ips" and isinstance(value, list):
                rec.allowed_ips = json.dumps(value) if value else None
            elif key == "headers":
                rec.expected_headers = value
            elif hasattr(rec, key):
                setattr(rec, key, value)

        rec.updated_at = datetime.now(timezone.utc).isoformat()
        db.commit()
        db.refresh(rec)
        return _record_to_trigger_config_dto(rec)

    async def delete_trigger(self, db: Session, trigger_id: str) -> bool:
        """Delete a trigger."""
        rec = db.query(TriggerConfigRecord).filter(TriggerConfigRecord.id == trigger_id).first()
        if not rec:
            return False
        db.delete(rec)
        db.commit()
        logger.info("Deleted trigger %s", trigger_id)
        return True

    async def handle_webhook(
        self,
        db: Session,
        trigger_id: str,
        payload: dict[str, Any],
        headers: dict[str, str] = None,
        source_ip: str = "",
    ) -> TriggerEventDTO:
        """
        Handle an incoming webhook request.

        Creates a TriggerEvent record in the DB.
        """
        rec = db.query(TriggerConfigRecord).filter(TriggerConfigRecord.id == trigger_id).first()
        if not rec:
            raise ValueError(f"Trigger {trigger_id} not found")

        # Verify signature if secret is configured
        verified = False
        if rec.secret:
            verified = self._verify_signature(payload, rec.secret, headers or {})
        else:
            verified = True

        # TODO: Phase 3 — trigger workflow via OrchestrationEngine
        event_rec = TriggerEventRecord(
            trigger_id=trigger_id,
            payload=payload,
            headers=headers or {},
            source_ip=source_ip,
            verified=verified,
            result={"status": "skeleton", "message": "Webhook received (mock)"},
        )
        db.add(event_rec)
        db.commit()
        db.refresh(event_rec)

        logger.info("Webhook received for trigger %s (verified=%s)", rec.name, verified)
        return _record_to_trigger_event_dto(event_rec)

    def _verify_signature(
        self,
        payload: dict[str, Any],
        secret: str,
        headers: dict[str, str],
    ) -> bool:
        """Verify webhook signature using HMAC-SHA256."""
        signature = headers.get("x-signature", headers.get("x-hub-signature-256", ""))
        if not signature:
            return False

        body = json.dumps(payload, sort_keys=True)
        expected = "sha256=" + hmac.new(
            secret.encode(), body.encode(), hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected)

    async def get_trigger(self, db: Session, trigger_id: str) -> TriggerConfigDTO | None:
        """Get a trigger by ID."""
        rec = db.query(TriggerConfigRecord).filter(TriggerConfigRecord.id == trigger_id).first()
        if not rec:
            return None
        return _record_to_trigger_config_dto(rec)

    async def list_triggers(
        self,
        db: Session,
        trigger_type: TriggerType | None = None,
        state: TriggerState | None = None,
    ) -> list[TriggerConfigDTO]:
        """List triggers, optionally filtered."""
        q = db.query(TriggerConfigRecord)
        if trigger_type:
            q = q.filter(TriggerConfigRecord.trigger_type == trigger_type.value)
        if state:
            q = q.filter(TriggerConfigRecord.state == state.value)
        return [_record_to_trigger_config_dto(t) for t in q.all()]

    async def get_events(self, db: Session, trigger_id: str, limit: int = 50) -> list[TriggerEventDTO]:
        """Get recent events for a trigger."""
        q = db.query(TriggerEventRecord).filter(
            TriggerEventRecord.trigger_id == trigger_id
        ).order_by(TriggerEventRecord.created_at.desc()).limit(limit)
        return [_record_to_trigger_event_dto(e) for e in q.all()]
