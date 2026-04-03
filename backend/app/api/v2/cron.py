"""
Cron Service API — Phase 3 P3-9

REST API endpoints for the backend CronService.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Optional

from app.services.cron import get_cron_service, CronJobState, CronExecutionState


router = APIRouter(prefix="/api/v2/cron", tags=["v3", "cron"])


# ── Request Schemas ─────────────────────────────────────────

class CreateCronJobRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = ""
    schedule_type: str = "cron"  # cron | at | every
    cron_expr: str = ""
    timezone: str = "UTC"
    interval_ms: int = 0
    run_at: Optional[str] = None
    workflow_template_id: str = ""
    workflow_params: dict[str, Any] = Field(default_factory=dict)
    agent_id: str = ""
    message_template: str = ""
    max_runs: int = 0


class UpdateCronJobRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cron_expr: Optional[str] = None
    timezone: Optional[str] = None
    interval_ms: Optional[int] = None
    workflow_params: Optional[dict[str, Any]] = None
    max_runs: Optional[int] = None
    state: Optional[str] = None


# ── Endpoints ───────────────────────────────────────────────

@router.get("/jobs")
async def list_jobs(state: str = "", workflow_template_id: str = ""):
    """List cron jobs."""
    svc = get_cron_service()
    jobs = await svc.list_jobs(state=state, workflow_template_id=workflow_template_id)
    return {"jobs": [_job_to_dict(j) for j in jobs], "total": len(jobs)}


@router.post("/jobs")
async def create_job(req: CreateCronJobRequest):
    """Create a new cron job."""
    svc = get_cron_service()
    job = await svc.create_job(req.model_dump())
    return _job_to_dict(job)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get a cron job by ID."""
    svc = get_cron_service()
    job = await svc.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_dict(job)


@router.patch("/jobs/{job_id}")
async def update_job(job_id: str, req: UpdateCronJobRequest):
    """Update a cron job."""
    svc = get_cron_service()
    patch = {k: v for k, v in req.model_dump().items() if v is not None}
    try:
        job = await svc.update_job(job_id, patch)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _job_to_dict(job)


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a cron job."""
    svc = get_cron_service()
    deleted = await svc.delete_job(job_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"ok": True}


@router.post("/jobs/{job_id}/pause")
async def pause_job(job_id: str):
    """Pause a cron job."""
    svc = get_cron_service()
    try:
        job = await svc.pause_job(job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _job_to_dict(job)


@router.post("/jobs/{job_id}/resume")
async def resume_job(job_id: str):
    """Resume a paused cron job."""
    svc = get_cron_service()
    try:
        job = await svc.resume_job(job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _job_to_dict(job)


@router.post("/jobs/{job_id}/trigger")
async def trigger_job(job_id: str):
    """Manually trigger a cron job execution."""
    svc = get_cron_service()
    try:
        execution = await svc.trigger_job(job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _execution_to_dict(execution)


@router.get("/jobs/{job_id}/executions")
async def get_executions(job_id: str, limit: int = 50):
    """Get execution history for a cron job."""
    svc = get_cron_service()
    executions = await svc.get_executions(job_id, limit=limit)
    return {"executions": [_execution_to_dict(e) for e in executions], "total": len(executions)}


# ── Helpers ─────────────────────────────────────────────────

def _job_to_dict(job: Any) -> dict:
    """Convert a CronJob model to a JSON-serializable dict."""
    return {
        "id": job.id,
        "name": job.name,
        "description": job.description,
        "schedule_type": job.schedule_type,
        "cron_expr": job.cron_expr,
        "timezone": job.timezone,
        "interval_ms": job.interval_ms,
        "run_at": job.run_at,
        "workflow_template_id": job.workflow_template_id,
        "workflow_params": job.workflow_params,
        "agent_id": job.agent_id,
        "message_template": job.message_template,
        "state": job.state,
        "last_run": job.last_run,
        "next_run": job.next_run,
        "run_count": job.run_count,
        "max_runs": job.max_runs,
        "aps_job_id": job.aps_job_id,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


def _execution_to_dict(execution: Any) -> dict:
    """Convert a CronExecution model to a JSON-serializable dict."""
    return {
        "id": execution.id,
        "job_id": execution.job_id,
        "state": execution.state,
        "started_at": execution.started_at,
        "completed_at": execution.completed_at,
        "duration_ms": execution.duration_ms,
        "result": execution.result,
        "error": execution.error,
        "trigger_type": execution.trigger_type,
    }
