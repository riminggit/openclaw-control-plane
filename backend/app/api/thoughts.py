"""Agent thinking chain API — capture and retrieve agent thought steps."""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db, TaskThought, Task

router = APIRouter(prefix="/api", tags=["thoughts"])


# ── Schemas ───────────────────────────────────────────────

class CreateThoughtRequest(BaseModel):
    task_id: str
    agent_id: str
    step_number: Optional[int] = None
    thinking_content: str = Field(..., min_length=1)
    category: str = Field("analysis", pattern=r"^(planning|analysis|coding|review|reflection)$")
    token_count: int = Field(0, ge=0)

class ThoughtItem(BaseModel):
    id: str
    task_id: str
    agent_id: str
    step_number: int
    thinking_content: str
    category: str
    token_count: int
    created_at: str


# ── Endpoints ─────────────────────────────────────────────

@router.post("/thoughts", status_code=201)
def create_thought(body: CreateThoughtRequest, db: Session = Depends(get_db)):
    # Verify task exists
    task = db.query(Task).filter(Task.id == body.task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    # Auto-increment step_number if not provided
    if body.step_number is None:
        last = db.query(TaskThought).filter(
            TaskThought.task_id == body.task_id,
            TaskThought.agent_id == body.agent_id,
        ).order_by(TaskThought.step_number.desc()).first()
        step = (last.step_number + 1) if last else 1
    else:
        step = body.step_number

    now = datetime.now(timezone.utc).isoformat()
    thought = TaskThought(
        id=f"tt-{__import__('uuid').uuid4().hex[:12]}",
        task_id=body.task_id,
        agent_id=body.agent_id,
        step_number=step,
        thinking_content=body.thinking_content,
        category=body.category,
        token_count=body.token_count,
        created_at=now,
    )
    db.add(thought)
    db.commit()
    db.refresh(thought)
    return ThoughtItem(
        id=thought.id, task_id=thought.task_id, agent_id=thought.agent_id,
        step_number=thought.step_number, thinking_content=thought.thinking_content,
        category=thought.category, token_count=thought.token_count,
        created_at=thought.created_at,
    )


@router.get("/tasks/{task_id}/thoughts")
def list_task_thoughts(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    thoughts = db.query(TaskThought).filter(
        TaskThought.task_id == task_id
    ).order_by(TaskThought.step_number.asc()).all()
    return {
        "task_id": task_id,
        "total": len(thoughts),
        "thoughts": [
            ThoughtItem(id=t.id, task_id=t.task_id, agent_id=t.agent_id,
                       step_number=t.step_number, thinking_content=t.thinking_content,
                       category=t.category, token_count=t.token_count,
                       created_at=t.created_at)
            for t in thoughts
        ],
    }


@router.get("/tasks/{task_id}/thoughts/latest")
def get_latest_thought(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    thought = db.query(TaskThought).filter(
        TaskThought.task_id == task_id
    ).order_by(TaskThought.step_number.desc()).first()
    if not thought:
        return {"task_id": task_id, "thought": None}
    return {
        "task_id": task_id,
        "thought": ThoughtItem(
            id=thought.id, task_id=thought.task_id, agent_id=thought.agent_id,
            step_number=thought.step_number, thinking_content=thought.thinking_content,
            category=thought.category, token_count=thought.token_count,
            created_at=thought.created_at,
        ),
    }


@router.get("/agents/{agent_id}/recent-thoughts")
def get_agent_recent_thoughts(
    agent_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    thoughts = db.query(TaskThought).filter(
        TaskThought.agent_id == agent_id
    ).order_by(TaskThought.created_at.desc()).limit(limit).all()
    return {
        "agent_id": agent_id,
        "total": len(thoughts),
        "thoughts": [
            ThoughtItem(id=t.id, task_id=t.task_id, agent_id=t.agent_id,
                       step_number=t.step_number, thinking_content=t.thinking_content,
                       category=t.category, token_count=t.token_count,
                       created_at=t.created_at)
            for t in thoughts
        ],
    }


@router.delete("/tasks/{task_id}/thoughts", status_code=204)
def clear_task_thoughts(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    count = db.query(TaskThought).filter(TaskThought.task_id == task_id).count()
    db.query(TaskThought).filter(TaskThought.task_id == task_id).delete()
    db.commit()
    return None
