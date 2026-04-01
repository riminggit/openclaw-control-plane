"""Task workflow API — state machine, review gate, dispatch, intervention."""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db, Task, ReviewGate, DispatchJob, StateTransitionLog, ActivityLog
from app.services.state_machine import (
    validate_transition, StateTransitionError, log_transition,
    TERMINAL_STATUSES, ACTIVE_STATUSES,
)

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


# ── Schemas ───────────────────────────────────────────────

class CreateTaskRequest(BaseModel):
    project_id: Optional[str] = "proj-ocp-001"
    title: str
    description: Optional[str] = None
    category: str = "general"
    phase: Optional[str] = None
    priority: str = "medium"
    status: str = "planned"
    owner_role: Optional[str] = None
    owner_agent_id: Optional[str] = None
    risk_level: str = "low"
    due_at: Optional[str] = None
    source_channel: Optional[str] = None
    estimated_duration_seconds: Optional[int] = None

class ReviewRequest(BaseModel):
    decision: str = Field(..., pattern=r"^(approve|reject)$")
    comment: Optional[str] = None
    reviewer_role: Optional[str] = None
    reviewer_agent_id: Optional[str] = None

class DispatchRequest(BaseModel):
    target_agent_id: str
    target_session_key: Optional[str] = None
    dispatch_mode: str = Field("sessions_spawn", pattern=r"^(sessions_spawn|direct)$")
    payload: Optional[dict] = None

class InterventionRequest(BaseModel):
    reason: Optional[str] = None


# ── List & Create ─────────────────────────────────────────

@router.get("/tasks")
def list_tasks(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    owner_role: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Task)
    if project_id:
        q = q.filter(Task.project_id == project_id)
    if status:
        q = q.filter(Task.status == status)
    if owner_role:
        q = q.filter(Task.owner_role == owner_role)
    if category:
        q = q.filter(Task.category == category)
    if priority:
        q = q.filter(Task.priority == priority)

    total = q.count()
    items = q.order_by(Task.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    def _td(t):
        return {"id": t.id, "projectId": t.project_id, "title": t.title, "description": t.description,
                "category": t.category, "phase": t.phase, "priority": t.priority, "status": t.status,
                "ownerRole": t.owner_role or "", "ownerAgentId": t.owner_agent_id, "riskLevel": t.risk_level,
                "docSyncRisk": "low" if not t.doc_sync_risk else "high", "createdAt": t.created_at, "updatedAt": t.updated_at}
    return {"items": [_td(t) for t in items], "total": total, "page": page, "page_size": page_size}


@router.post("/tasks", status_code=201)
def create_task(body: CreateTaskRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    task_id = f"task-{__import__('uuid').uuid4().hex[:12]}"
    task = Task(
        id=task_id,
        project_id=body.project_id,
        title=body.title,
        description=body.description,
        category=body.category,
        phase=body.phase,
        priority=body.priority,
        status=body.status,
        owner_role=body.owner_role,
        owner_agent_id=body.owner_agent_id,
        risk_level=body.risk_level,
        due_at=body.due_at,
        source_channel=body.source_channel,
        estimated_duration_seconds=body.estimated_duration_seconds,
        created_at=now,
        updated_at=now,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"id": task.id, "projectId": task.project_id, "title": task.title, "description": task.description,
            "category": task.category, "phase": task.phase, "priority": task.priority, "status": task.status,
            "ownerRole": task.owner_role or "", "ownerAgentId": task.owner_agent_id, "riskLevel": task.risk_level,
            "docSyncRisk": "low" if not task.doc_sync_risk else "high", "createdAt": task.created_at, "updatedAt": task.updated_at}


@router.get("/tasks/{task_id}")
def get_task(task_id: str, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    return {"id": t.id, "projectId": t.project_id, "title": t.title, "description": t.description,
            "category": t.category, "phase": t.phase, "priority": t.priority, "status": t.status,
            "ownerRole": t.owner_role or "", "ownerAgentId": t.owner_agent_id, "riskLevel": t.risk_level,
            "docSyncRisk": "low" if not t.doc_sync_risk else "high", "createdAt": t.created_at, "updatedAt": t.updated_at}


# ── Review Gate ───────────────────────────────────────────

@router.post("/tasks/{task_id}/review")
def review_task(task_id: str, body: ReviewRequest, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    target = "approved" if body.decision == "approve" else "rejected"

    try:
        validate_transition(task.status, target)
    except StateTransitionError as e:
        raise HTTPException(400, str(e))

    old_status = task.status
    task.status = target
    task.review_gate_status = body.decision
    task.review_log = body.comment or ""
    task.updated_at = datetime.now(timezone.utc).isoformat()
    if body.decision == "reject":
        # rejected → planned (for rework) via a second validated transition
        task.status = "planned"
        log_transition(db, task_id, old_status, "rejected", body.reviewer_role or "system", body.comment)
        log_transition(db, task_id, "rejected", "planned", body.reviewer_role or "system", "Auto-return for rework")

    log_transition(db, task_id, old_status, task.status, body.reviewer_role or "system", body.comment)

    # Create ReviewGate record
    now = datetime.now(timezone.utc).isoformat()
    existing_gates = db.query(ReviewGate).filter(ReviewGate.task_id == task_id).order_by(ReviewGate.round.desc()).first()
    next_round = (existing_gates.round + 1) if existing_gates else 1
    gate = ReviewGate(
        id=f"rg-{__import__('uuid').uuid4().hex[:12]}",
        task_id=task_id,
        gate_type="workflow",
        reviewer_role=body.reviewer_role,
        reviewer_agent_id=body.reviewer_agent_id,
        decision=body.decision,
        comments=body.comment,
        round=next_round,
        decided_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(gate)

    # Activity log
    _log_activity(db, task, "review", body.reviewer_role or "system",
                  f"Review {body.decision}: {body.comment or ''}")

    db.commit()
    db.refresh(task)
    return {"task_id": task_id, "old_status": old_status, "new_status": task.status,
            "decision": body.decision}


# ── Dispatch ──────────────────────────────────────────────

@router.post("/tasks/{task_id}/dispatch")
def dispatch_task(task_id: str, body: DispatchRequest, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    if task.status not in ("approved", "stopped"):
        raise HTTPException(400, f"Cannot dispatch task in status '{task.status}'. Must be 'approved' or 'stopped'.")

    now = datetime.now(timezone.utc).isoformat()
    old_status = task.status
    task.status = "dispatched"
    task.owner_agent_id = body.target_agent_id
    task.assignee_session_key = body.target_session_key
    task.last_dispatch_at = now
    task.updated_at = now

    log_transition(db, task_id, old_status, "dispatched", "system",
                   f"Agent: {body.target_agent_id}, Mode: {body.dispatch_mode}")

    # Create DispatchJob record
    import json
    job = DispatchJob(
        id=f"dj-{__import__('uuid').uuid4().hex[:12]}",
        task_id=task_id,
        dispatch_mode=body.dispatch_mode,
        target_agent_id=body.target_agent_id,
        target_session_key=body.target_session_key,
        payload_json=json.dumps(body.payload, ensure_ascii=False) if body.payload else None,
        run_status="dispatched",
        created_at=now,
        updated_at=now,
    )
    db.add(job)

    # Auto-transition to in_progress
    task.status = "in_progress"
    task.started_at = now
    log_transition(db, task_id, "dispatched", "in_progress", "system", "Auto-advance after dispatch")

    _log_activity(db, task, "dispatch", "system",
                  f"Dispatched to {body.target_agent_id} via {body.dispatch_mode}")

    db.commit()
    db.refresh(task)
    return {"task_id": task_id, "status": task.status, "dispatched_to": body.target_agent_id,
            "job_id": job.id}


# ── Stop ──────────────────────────────────────────────────

@router.post("/tasks/{task_id}/stop")
def stop_task(task_id: str, body: InterventionRequest = InterventionRequest(), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    try:
        validate_transition(task.status, "stopped")
    except StateTransitionError as e:
        raise HTTPException(400, str(e))

    old_status = task.status
    task.status = "stopped"
    task.updated_at = datetime.now(timezone.utc).isoformat()
    log_transition(db, task_id, old_status, "stopped", "system", body.reason)
    _log_activity(db, task, "stop", "system", body.reason or "Task stopped")
    db.commit()
    return {"task_id": task_id, "old_status": old_status, "new_status": "stopped"}


# ── Resume (re-dispatch stopped task) ─────────────────────

@router.post("/tasks/{task_id}/resume")
def resume_task(task_id: str, body: InterventionRequest = InterventionRequest(), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    if task.status != "stopped":
        raise HTTPException(400, f"Cannot resume task in status '{task.status}'. Must be 'stopped'.")

    old_status = task.status
    task.status = "dispatched"
    task.updated_at = datetime.now(timezone.utc).isoformat()
    log_transition(db, task_id, old_status, "dispatched", "system", "Resumed: " + (body.reason or ""))

    # Auto-advance to in_progress
    task.status = "in_progress"
    log_transition(db, task_id, "dispatched", "in_progress", "system", "Auto-advance after resume")
    _log_activity(db, task, "resume", "system", body.reason or "Task resumed")
    db.commit()
    return {"task_id": task_id, "new_status": "in_progress"}


# ── Cancel ────────────────────────────────────────────────

@router.delete("/tasks/{task_id}/cancel")
def cancel_task(task_id: str, body: InterventionRequest = InterventionRequest(), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    if task.status in TERMINAL_STATUSES:
        raise HTTPException(400, f"Cannot cancel task in terminal status '{task.status}'")

    try:
        validate_transition(task.status, "cancelled")
    except StateTransitionError as e:
        raise HTTPException(400, str(e))

    old_status = task.status
    task.status = "cancelled"
    task.updated_at = datetime.now(timezone.utc).isoformat()
    log_transition(db, task_id, old_status, "cancelled", "system", body.reason)
    _log_activity(db, task, "cancel", "system", body.reason or "Task cancelled")
    db.commit()
    return {"task_id": task_id, "old_status": old_status, "new_status": "cancelled"}


# ── State Transitions History ─────────────────────────────

@router.get("/tasks/{task_id}/transitions")
def get_transitions(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    logs = db.query(StateTransitionLog).filter(
        StateTransitionLog.task_id == task_id
    ).order_by(StateTransitionLog.created_at.asc()).all()
    return {
        "task_id": task_id,
        "current_status": task.status,
        "transitions": [
            {"id": l.id, "from": l.from_status, "to": l.to_status,
             "actor": l.actor, "reason": l.reason, "created_at": l.created_at}
            for l in logs
        ],
    }


# ── Heartbeat (agent health overview) ─────────────────────

@router.get("/heartbeat")
def heartbeat(db: Session = Depends(get_db)):
    """Return health overview of agents based on their active tasks."""
    from sqlalchemy import func as sa_func

    # Agent task counts by status
    agent_stats = db.query(
        Task.owner_agent_id,
        Task.status,
        sa_func.count().label("cnt"),
    ).filter(
        Task.owner_agent_id.isnot(None),
        Task.status.in_(ACTIVE_STATUSES),
    ).group_by(Task.owner_agent_id, Task.status).all()

    from collections import defaultdict
    agent_map: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in agent_stats:
        agent_map[row.owner_agent_id][row.status] += 1

    # Dispatch jobs status
    recent_jobs = db.query(DispatchJob).order_by(DispatchJob.created_at.desc()).limit(10).all()

    agents = []
    for agent_id, statuses in agent_map.items():
        total = sum(statuses.values())
        agents.append({
            "agent_id": agent_id,
            "status": "active" if total > 0 else "idle",
            "task_counts": dict(statuses),
            "total_active_tasks": total,
        })

    return {
        "agents": agents,
        "recent_dispatches": [
            {"id": j.id, "task_id": j.task_id, "target": j.target_agent_id,
             "status": j.run_status, "created_at": j.created_at}
            for j in recent_jobs
        ],
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Helpers ───────────────────────────────────────────────

def _log_activity(db, task: Task, event_type: str, actor: str, message: str):
    log = ActivityLog(
        id=f"al-{__import__('uuid').uuid4().hex[:12]}",
        project_id=task.project_id,
        task_id=task.id,
        event_type=event_type,
        actor_type="agent" if actor and not actor.startswith("system") else "system",
        actor_id=actor,
        message=message,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(log)
