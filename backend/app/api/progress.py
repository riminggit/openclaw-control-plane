"""Task progress estimation API — estimated time, real-time progress."""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from app.db import get_db, Task

router = APIRouter(prefix="/api", tags=["progress"])

# Default estimated durations in seconds: (category, priority) -> seconds
DEFAULT_DURATIONS: dict[str, dict[str, int]] = {
    "general":  {"low": 600, "medium": 1800, "high": 3600},
    "backend":  {"low": 1800, "medium": 3600, "high": 7200},
    "frontend": {"low": 900, "medium": 2700, "high": 5400},
    "docs":     {"low": 300, "medium": 900, "high": 1800},
    "design":   {"low": 600, "medium": 1800, "high": 3600},
    "test":     {"low": 600, "medium": 1800, "high": 3600},
    "devops":   {"low": 900, "medium": 2700, "high": 5400},
    "requirement": {"low": 300, "medium": 900, "high": 1800},
}


def _get_estimated_duration(category: str, priority: str, db: Session) -> int:
    """Get estimated duration: historical average if available, else default."""
    # Try historical average from completed tasks
    cat = category or "general"
    pri = (priority or "medium").lower()
    # Map priority aliases
    pri_map = {"p0": "high", "p1": "high", "p2": "medium", "p3": "low",
               "urgent": "high", "high": "high", "medium": "medium", "low": "low"}
    pri = pri_map.get(pri, pri)

    avg = db.query(
        sa_func.avg(Task.actual_duration_seconds)
    ).filter(
        Task.category == cat,
        Task.priority == pri,
        Task.actual_duration_seconds.isnot(None),
        Task.actual_duration_seconds > 0,
    ).scalar()

    if avg and avg > 0:
        return int(avg)

    # Fallback to defaults
    cat_defaults = DEFAULT_DURATIONS.get(cat, DEFAULT_DURATIONS["general"])
    return cat_defaults.get(pri, 1800)


def _parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        # Handle various ISO formats
        s = s.replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


class ProgressResponse(BaseModel):
    task_id: str
    status: str
    estimated_duration_seconds: int
    estimated_progress: float
    progress_source: str
    elapsed_seconds: int
    remaining_seconds: int
    is_overtime: bool
    actual_duration_seconds: int | None = None


@router.get("/tasks/{task_id}/progress")
def get_progress(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    # Calculate or use stored estimate
    if task.estimated_duration_seconds is None:
        task.estimated_duration_seconds = _get_estimated_duration(task.category, task.priority, db)
        db.commit()

    estimated = task.estimated_duration_seconds
    now = datetime.now(timezone.utc)

    # Calculate elapsed time
    started = _parse_iso(task.started_at)
    elapsed = int((now - started).total_seconds()) if started else 0

    # If task is terminal, use actual duration
    if task.status in ("completed", "failed", "cancelled", "stopped"):
        completed = _parse_iso(task.completed_at) or now
        actual = int((completed - started).total_seconds()) if started else 0
        if actual > 0:
            task.actual_duration_seconds = actual
            task.estimated_progress = 100.0
            db.commit()
        return ProgressResponse(
            task_id=task_id, status=task.status,
            estimated_duration_seconds=estimated,
            estimated_progress=100.0,
            progress_source=task.progress_source,
            elapsed_seconds=elapsed,
            remaining_seconds=0,
            is_overtime=elapsed > estimated,
            actual_duration_seconds=task.actual_duration_seconds,
        )

    # For active tasks, calculate time-based progress
    if task.status in ("dispatched", "in_progress") and estimated > 0:
        progress = min((elapsed / estimated) * 100, 99.0)
        task.estimated_progress = round(progress, 1)
        task.progress_source = "estimated"
        db.commit()
    elif task.estimated_progress > 0:
        progress = task.estimated_progress
    else:
        progress = 0.0

    remaining = max(estimated - elapsed, 0)

    return ProgressResponse(
        task_id=task_id, status=task.status,
        estimated_duration_seconds=estimated,
        estimated_progress=round(progress, 1),
        progress_source=task.progress_source,
        elapsed_seconds=elapsed,
        remaining_seconds=remaining,
        is_overtime=elapsed > estimated if estimated > 0 else False,
    )


@router.put("/tasks/{task_id}/progress")
def update_progress(task_id: str, progress: float, source: str = "manual", db: Session = Depends(get_db)):
    """Manually update task progress (e.g., from Gateway events)."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.estimated_progress = max(0.0, min(progress, 100.0))
    task.progress_source = source
    task.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    return {"task_id": task_id, "progress": task.estimated_progress, "source": source}
