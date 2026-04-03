"""
VerificationService — Automated verification of agent outputs.

Validates implementation quality against acceptance criteria using
a dedicated verification agent. Produces structured reports with
pass/fail/skip status per criterion.

All data is persisted to SQLite via VerificationReportRecord and
VerificationResultRecord DB models.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5 P3-1
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.phase3 import VerificationReportRecord, VerificationResultRecord


logger = logging.getLogger(__name__)


class VerificationStatus(str, Enum):
    """Status of a single verification criterion."""
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"


@dataclass
class VerificationResult:
    """Result for a single verification criterion."""
    criterion_id: str
    criterion_name: str
    status: VerificationStatus = VerificationStatus.PENDING
    score: float = 0.0  # 0.0 ~ 1.0
    message: str = ""
    evidence: str = ""
    duration_ms: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class VerificationReport:
    """Aggregated verification report for a task/step."""
    id: str = field(default_factory=lambda: str(uuid4()))
    task_id: str = ""
    step_id: str = ""
    workflow_instance_id: str = ""
    results: list[VerificationResult] = field(default_factory=list)
    overall_status: VerificationStatus = VerificationStatus.PENDING
    overall_score: float = 0.0
    summary: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def compute_overall(self) -> None:
        """Compute overall status and score from individual results."""
        if not self.results:
            self.overall_status = VerificationStatus.PENDING
            self.overall_score = 0.0
            return

        statuses = [r.status for r in self.results]
        scores = [r.score for r in self.results]

        if any(s == VerificationStatus.ERROR for s in statuses):
            self.overall_status = VerificationStatus.ERROR
        elif any(s == VerificationStatus.FAILED for s in statuses):
            self.overall_status = VerificationStatus.FAILED
        elif all(s == VerificationStatus.PASSED for s in statuses):
            self.overall_status = VerificationStatus.PASSED
        elif all(s in (VerificationStatus.PASSED, VerificationStatus.SKIPPED) for s in statuses):
            self.overall_status = VerificationStatus.PASSED
        else:
            self.overall_status = VerificationStatus.RUNNING

        self.overall_score = sum(scores) / len(scores) if scores else 0.0
        self.completed_at = datetime.now(timezone.utc).isoformat()


# ── DB Record → Dataclass DTO helpers ──────────────────────────

def _record_to_result(rec: VerificationResultRecord) -> VerificationResult:
    """Convert a VerificationResultRecord to a VerificationResult DTO."""
    return VerificationResult(
        criterion_id=rec.criterion_id,
        criterion_name=rec.criterion_name,
        status=VerificationStatus(rec.status),
        score=rec.score,
        message=rec.message or "",
        evidence=rec.evidence or "",
        duration_ms=rec.duration_ms,
        metadata=rec.metadata_json or {},
    )


def _record_to_report(rec: VerificationReportRecord) -> VerificationReport:
    """Convert a VerificationReportRecord (with eagerly loaded results) to a VerificationReport DTO."""
    results = [_record_to_result(r) for r in rec.results]
    return VerificationReport(
        id=rec.id,
        task_id=rec.task_id,
        step_id=rec.step_id or "",
        workflow_instance_id=rec.workflow_instance_id or "",
        results=results,
        overall_status=VerificationStatus(rec.overall_status),
        overall_score=rec.overall_score,
        summary=rec.summary or "",
        created_at=rec.created_at,
        completed_at=rec.completed_at,
        metadata=rec.metadata_json or {},
    )


class VerificationService:
    """
    Service for running verification checks on agent outputs.

    All data is persisted to the database via SQLAlchemy Session.
    Methods accept a ``db: Session`` parameter; the service itself
    is stateless and safe to use as a singleton.
    """

    async def create_report(
        self,
        db: Session,
        task_id: str,
        step_id: str = "",
        workflow_instance_id: str = "",
        criteria: list[dict[str, Any]] | None = None,
    ) -> VerificationReport:
        """
        Create a new verification report for a task/step.

        Args:
            db: SQLAlchemy session.
            task_id: The task to verify.
            step_id: Optional specific step to verify.
            workflow_instance_id: Optional workflow instance context.
            criteria: List of verification criteria dicts with
                      {id, name, description, type}.

        Returns:
            A VerificationReport DTO with PENDING results for each criterion.
        """
        report_rec = VerificationReportRecord(
            task_id=task_id,
            step_id=step_id or None,
            workflow_instance_id=workflow_instance_id or None,
            overall_status="pending",
            overall_score=0.0,
        )
        db.add(report_rec)

        if criteria:
            for c in criteria:
                result_rec = VerificationResultRecord(
                    report=report_rec,
                    criterion_id=c.get("id", str(uuid4())),
                    criterion_name=c.get("name", "Unnamed criterion"),
                    status="pending",
                    score=0.0,
                    metadata_json={"description": c.get("description", ""), "type": c.get("type", "auto")},
                )
                db.add(result_rec)

        db.commit()
        db.refresh(report_rec)

        logger.info("Created verification report %s for task %s with %d criteria",
                     report_rec.id, task_id, len(report_rec.results))
        return _record_to_report(report_rec)

    async def run_verification(self, db: Session, report_id: str) -> VerificationReport:
        """
        Run verification for all criteria in a report.

        Phase 3 skeleton — returns a mock report with all PASSED.
        Data is persisted to DB.
        """
        report_rec = db.query(VerificationReportRecord).filter(
            VerificationReportRecord.id == report_id
        ).first()
        if not report_rec:
            raise ValueError(f"Report {report_id} not found")

        logger.info("Running verification for report %s", report_id)

        # TODO: Phase 3 — integrate with orchestration engine for real verification
        for result_rec in report_rec.results:
            result_rec.status = VerificationStatus.PASSED.value
            result_rec.score = 1.0
            result_rec.message = "Skeleton verification — auto-passed"
            result_rec.duration_ms = 0

        # Compute overall
        statuses = [r.status for r in report_rec.results]
        scores = [r.score for r in report_rec.results]
        if any(s == "error" for s in statuses):
            report_rec.overall_status = "error"
        elif any(s == "failed" for s in statuses):
            report_rec.overall_status = "failed"
        elif all(s == "passed" for s in statuses):
            report_rec.overall_status = "passed"
        elif all(s in ("passed", "skipped") for s in statuses):
            report_rec.overall_status = "passed"
        else:
            report_rec.overall_status = "running"
        report_rec.overall_score = sum(scores) / len(scores) if scores else 0.0
        report_rec.completed_at = datetime.now(timezone.utc).isoformat()

        db.commit()
        db.refresh(report_rec)

        return _record_to_report(report_rec)

    async def get_report(self, db: Session, report_id: str) -> VerificationReport | None:
        """Retrieve a verification report by ID."""
        rec = db.query(VerificationReportRecord).filter(
            VerificationReportRecord.id == report_id
        ).first()
        if not rec:
            return None
        return _record_to_report(rec)

    async def list_reports(
        self,
        db: Session,
        task_id: str = "",
        workflow_instance_id: str = "",
        limit: int = 50,
    ) -> list[VerificationReport]:
        """List verification reports, optionally filtered."""
        q = db.query(VerificationReportRecord)
        if task_id:
            q = q.filter(VerificationReportRecord.task_id == task_id)
        if workflow_instance_id:
            q = q.filter(VerificationReportRecord.workflow_instance_id == workflow_instance_id)
        q = q.order_by(VerificationReportRecord.created_at.desc()).limit(limit)
        return [_record_to_report(r) for r in q.all()]

    async def delete_report(self, db: Session, report_id: str) -> bool:
        """Delete a verification report."""
        rec = db.query(VerificationReportRecord).filter(
            VerificationReportRecord.id == report_id
        ).first()
        if not rec:
            return False
        db.delete(rec)
        db.commit()
        return True
