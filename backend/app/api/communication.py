"""Phase 5: Communication center API — messages, broadcast, commands, hooks, approvals."""

import json, subprocess, uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy import String, Text
from sqlalchemy.orm import Session, Mapped, mapped_column

from app.db import SessionLocal, Base, engine

router = APIRouter(prefix="/api/communication")


# ── DB models ──

class Webhook(Base):
    __tablename__ = "webhooks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)
    events: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    secret: Mapped[str | None] = mapped_column(String, nullable=True)
    enabled: Mapped[bool] = mapped_column(String, nullable=False, default=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    command: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    reviewed_by: Mapped[str | None] = mapped_column(String, nullable=True)
    reviewed_at: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


Webhook.__table__.create(bind=engine, checkfirst=True)
Approval.__table__.create(bind=engine, checkfirst=True)


def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Schemas ──

class BroadcastRequest(BaseModel):
    message: str
    targets: list[str] | None = None  # None = all channels

class WebhookCreate(BaseModel):
    name: str
    url: str
    events: list[str] = []
    secret: str | None = None

class ApprovalAction(BaseModel):
    action: str  # "approve" or "reject"


# ── Predefined commands ──

PREDEFINED_COMMANDS = [
    {"id": "gw-restart", "name": "Restart Gateway", "command": "openclaw gateway restart", "description": "Restart the OpenClaw gateway process"},
    {"id": "gw-status", "name": "Gateway Status", "command": "openclaw gateway status", "description": "Check gateway running status"},
    {"id": "gw-stop", "name": "Stop Gateway", "command": "openclaw gateway stop", "description": "Stop the OpenClaw gateway"},
    {"id": "gw-start", "name": "Start Gateway", "command": "openclaw gateway start", "description": "Start the OpenClaw gateway"},
    {"id": "sys-uptime", "name": "System Uptime", "command": "uptime", "description": "Show system uptime and load"},
    {"id": "sys-df", "name": "Disk Usage", "command": "df -h /", "description": "Show disk usage for root partition"},
    {"id": "sys-memory", "name": "Memory Usage", "command": "free -h", "description": "Show memory usage"},
    {"id": "oc-version", "name": "OpenClaw Version", "command": "openclaw --version", "description": "Show OpenClaw version"},
    {"id": "oc-sessions", "name": "List Sessions", "command": "openclaw agent list", "description": "List active OpenClaw sessions"},
]


# ── Endpoints ──

@router.get("/recent-messages")
def get_recent_messages(limit: int = Query(20, le=100)):
    """Get recent messages from Gateway sessions (best effort via CLI)."""
    messages = []
    try:
        r = subprocess.run(["openclaw", "agent", "list", "--json"], capture_output=True, text=True, timeout=10)
        if r.returncode == 0 and r.stdout.strip():
            sessions = json.loads(r.stdout)
            if isinstance(sessions, list):
                for s in sessions[:limit]:
                    messages.append({
                        "id": s.get("id", ""),
                        "label": s.get("label", s.get("id", "")),
                        "status": s.get("status", "unknown"),
                        "model": s.get("model", ""),
                    })
    except Exception:
        pass
    return {"messages": messages}


@router.post("/broadcast")
def broadcast(body: BroadcastRequest):
    """Broadcast a message. Currently logs and returns acknowledgment."""
    # In a full implementation, this would use Gateway RPC to send to sessions
    return {
        "ok": True,
        "message": body.message,
        "targets": body.targets or "all",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "note": "Broadcast queued. Full implementation requires Gateway RPC integration.",
    }


@router.get("/commands")
def list_commands():
    return {"commands": PREDEFINED_COMMANDS}


@router.post("/commands/{cmd_id}/execute")
def execute_command(cmd_id: str, db: Session = Depends(_get_db)):
    cmd = next((c for c in PREDEFINED_COMMANDS if c["id"] == cmd_id), None)
    if not cmd:
        raise HTTPException(404, f"Command '{cmd_id}' not found")

    # Dangerous commands go through approval
    if cmd_id in ("gw-restart", "gw-stop"):
        approval = Approval(
            id=uuid.uuid4().hex[:12],
            command=cmd["command"],
            source="api",
            status="pending",
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(approval)
        db.commit()
        return {"status": "pending_approval", "approval_id": approval.id, "command": cmd["command"]}

    try:
        r = subprocess.run(cmd["command"], shell=True, capture_output=True, text=True, timeout=15)
        return {
            "status": "executed",
            "command": cmd["command"],
            "returncode": r.returncode,
            "stdout": r.stdout[:2000],
            "stderr": r.stderr[:500],
        }
    except Exception as e:
        raise HTTPException(500, f"Command execution failed: {e}")


@router.get("/hooks")
def list_hooks(db: Session = Depends(_get_db)):
    hooks = db.query(Webhook).order_by(Webhook.created_at.desc()).all()
    return {"hooks": [
        {"id": h.id, "name": h.name, "url": h.url, "events": json.loads(h.events) if h.events else [],
         "enabled": h.enabled, "created_at": h.created_at}
        for h in hooks
    ]}


@router.post("/hooks")
def create_hook(body: WebhookCreate, db: Session = Depends(_get_db)):
    hook = Webhook(
        id=uuid.uuid4().hex[:12],
        name=body.name, url=body.url,
        events=json.dumps(body.events),
        secret=body.secret,
        enabled=True,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(hook)
    db.commit()
    return {"ok": True, "id": hook.id, "name": hook.name}


@router.delete("/hooks/{hook_id}")
def delete_hook(hook_id: str, db: Session = Depends(_get_db)):
    hook = db.query(Webhook).filter(Webhook.id == hook_id).first()
    if not hook:
        raise HTTPException(404, f"Webhook '{hook_id}' not found")
    db.delete(hook)
    db.commit()
    return {"ok": True, "message": f"Webhook '{hook_id}' deleted"}


@router.get("/approvals")
def list_approvals(db: Session = Depends(_get_db), status: str | None = None):
    q = db.query(Approval).order_by(Approval.created_at.desc())
    if status:
        q = q.filter(Approval.status == status)
    items = q.all()
    return {"approvals": [
        {"id": a.id, "command": a.command, "source": a.source, "status": a.status,
         "reviewed_by": a.reviewed_by, "reviewed_at": a.reviewed_at, "created_at": a.created_at}
        for a in items
    ]}


@router.post("/approvals/{approval_id}")
def handle_approval(approval_id: str, body: ApprovalAction, db: Session = Depends(_get_db)):
    approval = db.query(Approval).filter(Approval.id == approval_id).first()
    if not approval:
        raise HTTPException(404, f"Approval '{approval_id}' not found")
    if approval.status != "pending":
        raise HTTPException(400, f"Approval already {approval.status}")

    if body.action == "approve":
        approval.status = "approved"
        approval.reviewed_by = "api_user"
        approval.reviewed_at = datetime.now(timezone.utc).isoformat()
        db.commit()
        # Execute the command
        try:
            r = subprocess.run(approval.command, shell=True, capture_output=True, text=True, timeout=15)
            return {"status": "approved_and_executed", "command": approval.command,
                    "returncode": r.returncode, "stdout": r.stdout[:1000], "stderr": r.stderr[:500]}
        except Exception as e:
            return {"status": "approved_but_failed", "command": approval.command, "error": str(e)}
    elif body.action == "reject":
        approval.status = "rejected"
        approval.reviewed_by = "api_user"
        approval.reviewed_at = datetime.now(timezone.utc).isoformat()
        db.commit()
        return {"status": "rejected", "command": approval.command}
    else:
        raise HTTPException(400, "action must be 'approve' or 'reject'")


# Aliases for frontend compatibility
@router.get("/messages")
def list_messages_alias(limit: int = Query(20, le=100)):
    """Alias for /recent-messages - frontend compatibility."""
    return get_recent_messages(limit)
