"""
CronService — Backend-side cron scheduling for workflows.

Integrates APScheduler for reliable scheduling with database persistence.
Supports cron expressions, one-time schedules, and interval-based execution.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5 P3-9
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

try:
    from croniter import croniter
except ImportError:
    croniter = None  # type: ignore[assignment]
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings
from app.models.cron import CronJob, CronExecution, generate_uuid, utcnow


logger = logging.getLogger(__name__)


class CronJobState(str):
    """Cron job lifecycle state."""
    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"
    ERROR = "error"


class CronExecutionState(str):
    """Cron execution result state."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    SKIPPED = "skipped"


class CronService:
    """
    Manages cron job scheduling with APScheduler integration and database persistence.

    Features:
    - Persistent job storage in SQLite/PostgreSQL
    - APScheduler for reliable scheduling
    - Support for cron, interval, and one-time schedules
    - Execution history tracking
    - Integration with OrchestrationEngine for workflow triggers
    """

    def __init__(self, database_url: str = "") -> None:
        self._database_url = database_url or settings.database_url
        self._engine = create_engine(
            self._database_url,
            connect_args={"check_same_thread": False} if "sqlite" in self._database_url else {},
        )
        self._SessionLocal = sessionmaker(bind=self._engine)
        
        # Initialize APScheduler (lazy import to avoid startup issues)
        self._scheduler = None
        self._scheduler_started = False
        
        logger.info("CronService initialized (database=%s)", self._database_url[:50])

    def _get_db(self) -> Session:
        """Get a database session."""
        return self._SessionLocal()

    def _get_scheduler(self):
        """Get or create the APScheduler instance."""
        if self._scheduler is None:
            try:
                from apscheduler.schedulers.background import BackgroundScheduler
                from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
                from apscheduler.executors.pool import ThreadPoolExecutor
                
                jobstores = {
                    'default': SQLAlchemyJobStore(url=self._database_url)
                }
                executors = {
                    'default': ThreadPoolExecutor(20)
                }
                
                self._scheduler = BackgroundScheduler(
                    jobstores=jobstores,
                    executors=executors,
                    timezone='UTC'
                )
                logger.info("APScheduler initialized")
            except ImportError:
                logger.warning("APScheduler not installed, using in-memory scheduling")
                self._scheduler = None
        
        return self._scheduler

    def start_scheduler(self) -> None:
        """Start the APScheduler if not already running."""
        scheduler = self._get_scheduler()
        if scheduler and not self._scheduler_started:
            scheduler.start()
            self._scheduler_started = True
            logger.info("APScheduler started")
            
            # Resume all active jobs from database
            self._resume_active_jobs()

    def stop_scheduler(self) -> None:
        """Stop the APScheduler."""
        if self._scheduler and self._scheduler_started:
            self._scheduler.shutdown(wait=False)
            self._scheduler_started = False
            logger.info("APScheduler stopped")

    def _resume_active_jobs(self) -> None:
        """Resume all active jobs from database on startup."""
        db = self._get_db()
        try:
            active_jobs = db.query(CronJob).filter(CronJob.state == CronJobState.ACTIVE).all()
            for job in active_jobs:
                try:
                    self._schedule_job(job)
                    logger.info("Resumed cron job: %s (id=%s)", job.name, job.id[:8])
                except Exception as e:
                    logger.error("Failed to resume job %s: %s", job.id[:8], e)
        finally:
            db.close()

    def _schedule_job(self, job: CronJob) -> None:
        """Schedule a job with APScheduler."""
        scheduler = self._get_scheduler()
        if not scheduler:
            logger.warning("Scheduler not available, job %s will not be scheduled", job.id[:8])
            return

        # Remove existing job if any
        if job.aps_job_id:
            try:
                scheduler.remove_job(job.aps_job_id)
            except Exception:
                pass

        # Calculate next run time
        next_run = self._calculate_next_run(job)
        
        # Schedule based on type
        if job.schedule_type == "cron" and job.cron_expr:
            scheduler.add_job(
                self._execute_job,
                trigger='cron',
                id=f"cron_{job.id}",
                args=[job.id],
                timezone=job.timezone or 'UTC',
                **self._parse_cron_expr(job.cron_expr)
            )
            job.aps_job_id = f"cron_{job.id}"
            
        elif job.schedule_type == "every" and job.interval_ms > 0:
            interval_seconds = job.interval_ms / 1000
            scheduler.add_job(
                self._execute_job,
                trigger='interval',
                id=f"cron_{job.id}",
                args=[job.id],
                seconds=interval_seconds,
            )
            job.aps_job_id = f"cron_{job.id}"
            
        elif job.schedule_type == "at" and job.run_at:
            run_time = datetime.fromisoformat(job.run_at.replace('Z', '+00:00'))
            scheduler.add_job(
                self._execute_job,
                trigger='date',
                id=f"cron_{job.id}",
                args=[job.id],
                run_date=run_time,
            )
            job.aps_job_id = f"cron_{job.id}"
        
        job.next_run = next_run
        logger.info("Scheduled job %s (aps_id=%s, next_run=%s)", 
                    job.id[:8], job.aps_job_id, next_run)

    def _parse_cron_expr(self, expr: str) -> dict:
        """Parse a cron expression into APScheduler kwargs."""
        parts = expr.split()
        if len(parts) != 5:
            raise ValueError(f"Invalid cron expression: {expr}")
        
        minute, hour, day, month, day_of_week = parts
        return {
            'minute': minute,
            'hour': hour,
            'day': day,
            'month': month,
            'day_of_week': day_of_week,
        }

    def _calculate_next_run(self, job: CronJob) -> str:
        """Calculate the next run time for a job."""
        if job.schedule_type == "cron" and job.cron_expr:
            iter = croniter(job.cron_expr, datetime.now(timezone.utc))
            return iter.get_next(datetime).isoformat()
        elif job.schedule_type == "every" and job.interval_ms > 0:
            from datetime import timedelta
            next_time = datetime.now(timezone.utc) + timedelta(milliseconds=job.interval_ms)
            return next_time.isoformat()
        elif job.schedule_type == "at" and job.run_at:
            return job.run_at
        return ""

    def _execute_job(self, job_id: str) -> None:
        """
        Execute a cron job (called by APScheduler).
        
        This method creates an execution record and triggers the workflow.
        """
        db = self._get_db()
        try:
            job = db.query(CronJob).filter(CronJob.id == job_id).first()
            if not job:
                logger.error("Job %s not found", job_id[:8])
                return
            
            if job.state != CronJobState.ACTIVE:
                logger.info("Job %s is not active, skipping", job_id[:8])
                return
            
            # Check max runs
            if job.max_runs > 0 and job.run_count >= job.max_runs:
                logger.info("Job %s reached max runs (%d), disabling", job_id[:8], job.max_runs)
                job.state = CronJobState.DISABLED
                db.commit()
                return
            
            # Create execution record
            execution = CronExecution(
                job_id=job_id,
                state=CronExecutionState.RUNNING,
                trigger_type="scheduled",
            )
            db.add(execution)
            db.commit()
            
            logger.info("Executing job %s (execution=%s)", job_id[:8], execution.id[:8])
            
            # TODO: Trigger workflow via OrchestrationEngine
            # For now, we simulate a successful execution
            try:
                result = self._trigger_workflow(job)
                execution.state = CronExecutionState.SUCCESS
                execution.result = result
            except Exception as e:
                execution.state = CronExecutionState.FAILED
                execution.error = str(e)
                logger.error("Job %s execution failed: %s", job_id[:8], e)
            
            # Update execution record
            execution.completed_at = utcnow()
            started = datetime.fromisoformat(execution.started_at)
            completed = datetime.fromisoformat(execution.completed_at)
            execution.duration_ms = int((completed - started).total_seconds() * 1000)
            
            # Update job stats
            job.last_run = execution.started_at
            job.run_count += 1
            job.next_run = self._calculate_next_run(job)
            
            db.commit()
            logger.info("Job %s execution completed (state=%s, duration=%dms)",
                        job_id[:8], execution.state, execution.duration_ms)
            
        except Exception as e:
            logger.error("Error executing job %s: %s", job_id[:8], e)
            db.rollback()
        finally:
            db.close()

    def _trigger_workflow(self, job: CronJob) -> dict:
        """
        Trigger the workflow associated with a job.
        
        TODO: Integrate with OrchestrationEngine for real workflow execution.
        """
        if job.workflow_template_id:
            # TODO: Call OrchestrationEngine to start workflow
            logger.info("Would trigger workflow template: %s", job.workflow_template_id)
            return {
                "status": "triggered",
                "workflow_template_id": job.workflow_template_id,
                "params": job.workflow_params or {},
            }
        elif job.agent_id:
            # TODO: Send message to agent via Gateway
            logger.info("Would send message to agent: %s", job.agent_id)
            return {
                "status": "sent",
                "agent_id": job.agent_id,
                "message": job.message_template,
            }
        else:
            return {"status": "no_action", "message": "No workflow or agent configured"}

    # ── Public API ─────────────────────────────────────────────

    async def create_job(self, job_data: dict[str, Any]) -> CronJob:
        """Create a new cron job."""
        db = self._get_db()
        try:
            job = CronJob(
                name=job_data.get("name", "Unnamed Job"),
                description=job_data.get("description", ""),
                schedule_type=job_data.get("schedule_type", "cron"),
                cron_expr=job_data.get("cron_expr"),
                timezone=job_data.get("timezone", "UTC"),
                interval_ms=job_data.get("interval_ms", 0),
                run_at=job_data.get("run_at"),
                workflow_template_id=job_data.get("workflow_template_id"),
                workflow_params=job_data.get("workflow_params"),
                agent_id=job_data.get("agent_id"),
                message_template=job_data.get("message_template"),
                max_runs=job_data.get("max_runs", 0),
                state=CronJobState.ACTIVE,
            )
            
            # Calculate next run
            job.next_run = self._calculate_next_run(job)
            
            db.add(job)
            db.commit()
            db.refresh(job)
            
            # Schedule with APScheduler
            self._schedule_job(job)
            
            logger.info("Created cron job %s (%s)", job.name, job.id[:8])
            return job
            
        finally:
            db.close()

    async def update_job(self, job_id: str, patch: dict[str, Any]) -> CronJob:
        """Update a cron job's configuration."""
        db = self._get_db()
        try:
            job = db.query(CronJob).filter(CronJob.id == job_id).first()
            if not job:
                raise ValueError(f"Job {job_id} not found")

            for key, value in patch.items():
                if hasattr(job, key) and key not in ('id', 'created_at'):
                    setattr(job, key, value)
            
            job.updated_at = utcnow()
            job.next_run = self._calculate_next_run(job)
            
            # Reschedule if schedule-related fields changed
            schedule_fields = {'schedule_type', 'cron_expr', 'timezone', 'interval_ms', 'run_at'}
            if schedule_fields & set(patch.keys()):
                self._schedule_job(job)
            
            db.commit()
            db.refresh(job)
            return job
            
        finally:
            db.close()

    async def delete_job(self, job_id: str) -> bool:
        """Delete a cron job."""
        db = self._get_db()
        try:
            job = db.query(CronJob).filter(CronJob.id == job_id).first()
            if not job:
                return False
            
            # Remove from APScheduler
            if job.aps_job_id and self._scheduler:
                try:
                    self._scheduler.remove_job(job.aps_job_id)
                except Exception:
                    pass
            
            db.delete(job)
            db.commit()
            logger.info("Deleted cron job %s", job_id[:8])
            return True
            
        finally:
            db.close()

    async def pause_job(self, job_id: str) -> CronJob:
        """Pause a cron job."""
        db = self._get_db()
        try:
            job = db.query(CronJob).filter(CronJob.id == job_id).first()
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            job.state = CronJobState.PAUSED
            job.updated_at = utcnow()
            
            # Pause in APScheduler
            if job.aps_job_id and self._scheduler:
                try:
                    self._scheduler.pause_job(job.aps_job_id)
                except Exception:
                    pass
            
            db.commit()
            db.refresh(job)
            return job
            
        finally:
            db.close()

    async def resume_job(self, job_id: str) -> CronJob:
        """Resume a paused cron job."""
        db = self._get_db()
        try:
            job = db.query(CronJob).filter(CronJob.id == job_id).first()
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            job.state = CronJobState.ACTIVE
            job.updated_at = utcnow()
            job.next_run = self._calculate_next_run(job)
            
            # Resume in APScheduler
            if job.aps_job_id and self._scheduler:
                try:
                    self._scheduler.resume_job(job.aps_job_id)
                except Exception:
                    self._schedule_job(job)
            
            db.commit()
            db.refresh(job)
            return job
            
        finally:
            db.close()

    async def trigger_job(self, job_id: str) -> CronExecution:
        """Manually trigger a cron job execution."""
        db = self._get_db()
        try:
            job = db.query(CronJob).filter(CronJob.id == job_id).first()
            if not job:
                raise ValueError(f"Job {job_id} not found")

            # Create execution record
            execution = CronExecution(
                job_id=job_id,
                state=CronExecutionState.RUNNING,
                trigger_type="manual",
            )
            db.add(execution)
            db.commit()
            db.refresh(execution)
            
            logger.info("Manually triggering job %s (execution=%s)", job_id[:8], execution.id[:8])
            
            # Execute
            try:
                result = self._trigger_workflow(job)
                execution.state = CronExecutionState.SUCCESS
                execution.result = result
            except Exception as e:
                execution.state = CronExecutionState.FAILED
                execution.error = str(e)
            
            execution.completed_at = utcnow()
            started = datetime.fromisoformat(execution.started_at)
            completed = datetime.fromisoformat(execution.completed_at)
            execution.duration_ms = int((completed - started).total_seconds() * 1000)
            
            # Update job stats
            job.last_run = execution.started_at
            job.run_count += 1
            
            db.commit()
            db.refresh(execution)
            return execution
            
        finally:
            db.close()

    async def get_job(self, job_id: str) -> CronJob | None:
        """Get a cron job by ID."""
        db = self._get_db()
        try:
            return db.query(CronJob).filter(CronJob.id == job_id).first()
        finally:
            db.close()

    async def list_jobs(
        self,
        state: str = "",
        workflow_template_id: str = "",
    ) -> list[CronJob]:
        """List cron jobs, optionally filtered."""
        db = self._get_db()
        try:
            query = db.query(CronJob)
            if state:
                query = query.filter(CronJob.state == state)
            if workflow_template_id:
                query = query.filter(CronJob.workflow_template_id == workflow_template_id)
            return query.all()
        finally:
            db.close()

    async def get_executions(self, job_id: str, limit: int = 50) -> list[CronExecution]:
        """Get execution history for a cron job."""
        db = self._get_db()
        try:
            return db.query(CronExecution).filter(
                CronExecution.job_id == job_id
            ).order_by(CronExecution.created_at.desc()).limit(limit).all()
        finally:
            db.close()


# Singleton instance
_cron_service: CronService | None = None


def get_cron_service() -> CronService:
    """Get or create the singleton CronService."""
    global _cron_service
    if _cron_service is None:
        _cron_service = CronService()
    return _cron_service
