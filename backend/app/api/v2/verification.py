"""
Verification API — Phase 3 P3-2

REST API endpoints for the VerificationService.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Any, Optional

from app.db import get_db
from app.services.verification import get_verification_service


router = APIRouter(prefix="/api/v2/verification", tags=["v3", "verification"])


# ── Request / Response Schemas ──────────────────────────────

class CriterionInput(BaseModel):
    id: str = ""
    name: str = ""
    description: str = ""
    type: str = "auto"  # auto | manual | lint | test


class CreateReportRequest(BaseModel):
    task_id: str = Field(..., min_length=1)
    step_id: str = ""
    workflow_instance_id: str = ""
    criteria: list[CriterionInput] = Field(default_factory=list)


class PatchReportRequest(BaseModel):
    criteria: list[CriterionInput] = Field(default_factory=list)


# ── Endpoints ───────────────────────────────────────────────

@router.post("/reports")
async def create_report(req: CreateReportRequest, db: Session = Depends(get_db)):
    """Create a new verification report."""
    svc = get_verification_service()
    criteria = [c.model_dump() for c in req.criteria]
    report = await svc.create_report(
        db,
        task_id=req.task_id,
        step_id=req.step_id,
        workflow_instance_id=req.workflow_instance_id,
        criteria=criteria or None,
    )
    return _report_to_dict(report)


@router.post("/reports/{report_id}/run")
async def run_verification(report_id: str, db: Session = Depends(get_db)):
    """Run verification for a report."""
    svc = get_verification_service()
    try:
        report = await svc.run_verification(db, report_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _report_to_dict(report)


@router.get("/reports/{report_id}")
async def get_report(report_id: str, db: Session = Depends(get_db)):
    """Get a verification report by ID."""
    svc = get_verification_service()
    report = await svc.get_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return _report_to_dict(report)


@router.get("/reports")
async def list_reports(
    task_id: str = "",
    workflow_instance_id: str = "",
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List verification reports."""
    svc = get_verification_service()
    reports = await svc.list_reports(db, task_id=task_id, workflow_instance_id=workflow_instance_id, limit=limit)
    return {"reports": [_report_to_dict(r) for r in reports], "total": len(reports)}


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str, db: Session = Depends(get_db)):
    """Delete a verification report."""
    svc = get_verification_service()
    deleted = await svc.delete_report(db, report_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}


def _report_to_dict(report: Any) -> dict:
    """Convert a VerificationReport to a JSON-serializable dict."""
    return {
        "id": report.id,
        "task_id": report.task_id,
        "step_id": report.step_id,
        "workflow_instance_id": report.workflow_instance_id,
        "overall_status": report.overall_status.value if hasattr(report.overall_status, 'value') else report.overall_status,
        "overall_score": report.overall_score,
        "summary": report.summary,
        "created_at": report.created_at,
        "completed_at": report.completed_at,
        "results": [
            {
                "criterion_id": r.criterion_id,
                "criterion_name": r.criterion_name,
                "status": r.status.value if hasattr(r.status, 'value') else r.status,
                "score": r.score,
                "message": r.message,
                "evidence": r.evidence,
                "duration_ms": r.duration_ms,
            }
            for r in report.results
        ],
    }
