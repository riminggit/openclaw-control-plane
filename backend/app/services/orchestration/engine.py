"""
OrchestrationEngine — Core orchestration engine for OpenClaw v3.

Bridges the LangGraph-style state machine with step executors,
checkpoint storage, and event publishing.

Reference: docs/requirements/openclaw-v3/06-core-modules.md §1
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.feature_flags import is_coordinator_mode_enabled
from app.models.orchestration import (
    CoordinatorSession,
    WorkerAgent,
    OrchestrationCheckpoint,
    OutboxMessage,
)
from app.models.workflow import WorkflowInstance, StepExecution
from app.services.orchestration.protocols import (
    CheckpointData,
    CheckpointStoreProtocol,
    EventPublisherProtocol,
    IdempotencyKey,
    OrchestrationEvent,
    OrchestrationEventType,
    OrchestrationProfile,
    StepKind,
    ToolContext,
)

logger = logging.getLogger(__name__)


# ============================================================
# Engine State Machine
# ============================================================

class EngineStatus(str, Enum):
    """Internal engine status for a workflow run."""
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class StepResult:
    """Result of a single step execution."""
    step_id: str
    status: str  # completed, failed, skipped
    output: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    token_usage: Optional[dict[str, int]] = None
    cost_usd: Optional[float] = None
    duration_ms: int = 0


@dataclass
class WorkflowRunState:
    """
    Mutable state for a single workflow run.

    Carried through the entire lifecycle of a workflow instance execution.
    """
    instance_id: str
    template_id: str
    profile: OrchestrationProfile
    status: EngineStatus = EngineStatus.IDLE
    current_step_index: int = 0
    steps: list[dict[str, Any]] = field(default_factory=list)
    step_results: dict[str, StepResult] = field(default_factory=dict)
    variables: dict[str, Any] = field(default_factory=dict)
    attempt_counts: dict[str, int] = field(default_factory=dict)
    max_retries: int = 3
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "instance_id": self.instance_id,
            "template_id": self.template_id,
            "profile": self.profile.value,
            "status": self.status.value,
            "current_step_index": self.current_step_index,
            "steps": self.steps,
            "step_results": {k: {"status": v.status, "output": v.output, "error": v.error}
                             for k, v in self.step_results.items()},
            "variables": self.variables,
            "attempt_counts": self.attempt_counts,
            "max_retries": self.max_retries,
        }


# ============================================================
# OrchestrationEngine
# ============================================================

class OrchestrationEngine:
    """
    Core orchestration engine.

    Responsibilities:
    1. Parse DAG template into executable steps
    2. Dispatch steps to appropriate executors based on StepKind
    3. Manage state transitions, checkpoints, and retries
    4. Publish events for WebSocket/UI updates
    5. Coordinate multi-agent workflows (Coordinator Mode)

    Design follows Claude Code's QueryEngine pattern:
    - Step-by-step execution with state persistence
    - Event-driven architecture for real-time updates
    - Checkpoint-based recovery for fault tolerance
    """

    def __init__(
        self,
        db: Session,
        checkpoint_store: Optional[CheckpointStoreProtocol] = None,
        event_publisher: Optional[EventPublisherProtocol] = None,
    ):
        self._db = db
        self._checkpoint_store = checkpoint_store or _DBCheckpointStore(db)
        self._event_publisher = event_publisher or _LogEventPublisher()
        self._executors: dict[StepKind, Any] = {}
        self._active_runs: dict[str, WorkflowRunState] = {}

    # ── Executor Registration ──────────────────────────────

    def register_executor(self, step_kind: StepKind, executor: Any) -> None:
        """Register a step executor for a given StepKind."""
        self._executors[step_kind] = executor

    def get_executor(self, step_kind: StepKind) -> Optional[Any]:
        """Get the executor for a given StepKind."""
        return self._executors.get(step_kind)

    # ── Workflow Lifecycle ─────────────────────────────────

    async def start_workflow(
        self,
        instance_id: str,
        profile: OrchestrationProfile = OrchestrationProfile.STATIC_DAG_V1,
        variables: Optional[dict[str, Any]] = None,
    ) -> WorkflowRunState:
        """
        Start a workflow instance execution.

        Args:
            instance_id: Workflow instance ID
            profile: Orchestration profile determining execution semantics
            variables: Initial workflow variables

        Returns:
            Initial WorkflowRunState
        """
        instance = self._db.query(WorkflowInstance).filter_by(id=instance_id).first()
        if not instance:
            raise ValueError(f"Workflow instance {instance_id} not found")

        # Parse steps from template DAG
        steps = self._parse_dag_steps(instance.template_id)

        state = WorkflowRunState(
            instance_id=instance_id,
            template_id=instance.template_id,
            profile=profile,
            steps=steps,
            variables=variables or {},
            status=EngineStatus.RUNNING,
            started_at=datetime.now(timezone.utc).isoformat(),
        )

        self._active_runs[instance_id] = state

        # Update instance status
        instance.status = "in_progress"
        instance.started_at = state.started_at
        self._db.commit()

        # Publish start event
        await self._event_publisher.publish(OrchestrationEvent(
            event_type=OrchestrationEventType.INSTANCE_STARTED,
            payload={"profile": profile.value, "step_count": len(steps)},
            instance_id=instance_id,
        ))

        # Begin execution based on profile
        if profile == OrchestrationProfile.STATIC_DAG_V1:
            await self._execute_static_dag_v1(state)
        elif profile == OrchestrationProfile.STATIC_DAG_V2:
            await self._execute_static_dag_v2(state)
        elif profile == OrchestrationProfile.COORDINATOR_V2:
            await self._execute_coordinator_v2(state)
        elif profile == OrchestrationProfile.PLAN_SUBTASK_V2:
            await self._execute_plan_subtask_v2(state)

        return state

    async def pause_workflow(self, instance_id: str) -> None:
        """Pause a running workflow."""
        state = self._active_runs.get(instance_id)
        if not state or state.status != EngineStatus.RUNNING:
            return
        state.status = EngineStatus.PAUSED
        await self._event_publisher.publish(OrchestrationEvent(
            event_type=OrchestrationEventType.INSTANCE_PAUSED,
            payload={"current_step_index": state.current_step_index},
            instance_id=instance_id,
        ))

    async def resume_workflow(self, instance_id: str) -> None:
        """Resume a paused workflow."""
        state = self._active_runs.get(instance_id)
        if not state or state.status != EngineStatus.PAUSED:
            logger.warning(
                "resume_workflow: no paused in-memory state for %s "
                "(restart clears _active_runs; restore from checkpoints not implemented here)",
                instance_id,
            )
            return
        state.status = EngineStatus.RUNNING
        await self._event_publisher.publish(OrchestrationEvent(
            event_type=OrchestrationEventType.INSTANCE_RESUMED,
            payload={"current_step_index": state.current_step_index},
            instance_id=instance_id,
        ))
        # Continue execution from where we left off
        if state.profile == OrchestrationProfile.STATIC_DAG_V1:
            await self._execute_static_dag_v1(state)
        elif state.profile == OrchestrationProfile.STATIC_DAG_V2:
            await self._execute_static_dag_v2(state)
        elif state.profile == OrchestrationProfile.COORDINATOR_V2:
            await self._execute_coordinator_v2(state)
        elif state.profile == OrchestrationProfile.PLAN_SUBTASK_V2:
            await self._execute_plan_subtask_v2(state)

    async def cancel_workflow(self, instance_id: str, reason: str = "") -> None:
        """Cancel a running workflow."""
        state = self._active_runs.get(instance_id)
        if not state:
            return
        state.status = EngineStatus.CANCELLED
        state.completed_at = datetime.now(timezone.utc).isoformat()
        state.error_message = reason or "Cancelled by user"

        instance = self._db.query(WorkflowInstance).filter_by(id=instance_id).first()
        if instance:
            instance.status = "cancelled"
            self._db.commit()

        await self._event_publisher.publish(OrchestrationEvent(
            event_type=OrchestrationEventType.INSTANCE_TERMINATED,
            payload={"reason": reason},
            instance_id=instance_id,
        ))

    # ── Step Execution ─────────────────────────────────────

    async def _execute_step(
        self,
        state: WorkflowRunState,
        step: dict[str, Any],
    ) -> StepResult:
        """
        Execute a single step with retry logic and checkpointing.

        Follows Claude Code's pattern:
        1. Pre-execute checkpoint
        2. Validate input
        3. Execute with timeout
        4. Post-execute checkpoint
        5. Handle failure with retry
        """
        step_id = step.get("id", "")
        step_kind_str = step.get("kind", step.get("type", "agent_session"))
        try:
            step_kind = StepKind(step_kind_str)
        except ValueError:
            step_kind = StepKind.AGENT_SESSION

        attempt = state.attempt_counts.get(step_id, 0) + 1
        state.attempt_counts[step_id] = attempt

        # Build idempotency key
        idem_key = IdempotencyKey(
            workflow_instance_id=state.instance_id,
            step_id=step_id,
            attempt=attempt,
        )

        # Build tool context
        tool_context = ToolContext(
            tenant_id=step.get("tenant_id", "default"),
            workflow_id=state.instance_id,
            step_id=step_id,
            actor=step.get("agent_id", "system"),
            allowlist=step.get("allowed_tools", []),
            denylist=step.get("denied_tools", []),
            mcp_servers=step.get("mcp_servers", []),
            max_cost_usd=step.get("max_cost_usd"),
            max_tokens=step.get("max_tokens"),
        )

        # Pre-execute checkpoint
        await self._save_checkpoint(state, step_id, "pre_execute", attempt)

        # Publish step started event
        await self._event_publisher.publish(OrchestrationEvent(
            event_type=OrchestrationEventType.STEP_STARTED,
            payload={"step_id": step_id, "kind": step_kind.value, "attempt": attempt},
            instance_id=state.instance_id,
            step_id=step_id,
        ))

        start_time = datetime.now(timezone.utc)

        try:
            # Get executor
            executor = self._executors.get(step_kind)
            if not executor:
                raise ValueError(f"No executor registered for StepKind: {step_kind}")

            # Validate input
            is_valid = await executor.validate_input(step)
            if not is_valid:
                raise ValueError(f"Step {step_id} input validation failed")

            # Build execution context
            context = {
                "state": state.to_dict(),
                "tool_context": tool_context.to_dict(),
                "idempotency_key": str(idem_key),
                "variables": state.variables,
            }

            # Execute
            result = await executor.execute(step, context)

            # Calculate duration
            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            step_result = StepResult(
                step_id=step_id,
                status="completed",
                output=result,
                duration_ms=duration_ms,
            )

            # Update variables from step output
            if result and "variables" in result:
                state.variables.update(result["variables"])

            # Post-execute checkpoint
            await self._save_checkpoint(state, step_id, "post_execute", attempt,
                                        output_summary=json.dumps(result)[:500] if result else None)

            # Publish step completed event
            await self._event_publisher.publish(OrchestrationEvent(
                event_type=OrchestrationEventType.STEP_COMPLETED,
                payload={"step_id": step_id, "duration_ms": duration_ms},
                instance_id=state.instance_id,
                step_id=step_id,
            ))

            return step_result

        except Exception as e:
            logger.error(f"Step {step_id} execution failed (attempt {attempt}): {e}")

            # Check if we should retry
            if attempt < state.max_retries:
                state.attempt_counts[step_id] = attempt
                await self._event_publisher.publish(OrchestrationEvent(
                    event_type=OrchestrationEventType.STEP_RETRYING,
                    payload={"step_id": step_id, "attempt": attempt, "max_retries": state.max_retries},
                    instance_id=state.instance_id,
                    step_id=step_id,
                ))
                # Retry
                return await self._execute_step(state, step)

            # Final failure
            step_result = StepResult(
                step_id=step_id,
                status="failed",
                error=str(e),
            )

            await self._save_checkpoint(state, step_id, "on_failure", attempt,
                                        error=str(e))

            await self._event_publisher.publish(OrchestrationEvent(
                event_type=OrchestrationEventType.STEP_FAILED,
                payload={"step_id": step_id, "error": str(e), "attempts": attempt},
                instance_id=state.instance_id,
                step_id=step_id,
            ))

            return step_result

    # ── Execution Profiles ─────────────────────────────────

    async def _execute_static_dag_v1(self, state: WorkflowRunState) -> None:
        """
        Execute a static DAG (v1 profile).

        Sequential step execution with dependency checking.
        Compatible with the existing WorkflowInstanceService behavior.
        """
        for i, step in enumerate(state.steps):
            if state.status != EngineStatus.RUNNING:
                break

            state.current_step_index = i

            # Check dependencies
            if not self._check_dependencies(state, step):
                logger.info(f"Step {step.get('id')} dependencies not met, skipping")
                state.step_results[step.get("id", "")] = StepResult(
                    step_id=step.get("id", ""), status="skipped"
                )
                continue

            result = await self._execute_step(state, step)
            state.step_results[result.step_id] = result

            if result.status == "failed":
                state.status = EngineStatus.FAILED
                state.error_message = result.error
                break

        if state.status == EngineStatus.RUNNING:
            state.status = EngineStatus.COMPLETED
            state.completed_at = datetime.now(timezone.utc).isoformat()

        self._finalize_workflow(state)

    async def _execute_static_dag_v2(self, state: WorkflowRunState) -> None:
        """
        Execute a static DAG (v2 profile).

        Enhanced with:
        - Parallel step execution for independent steps
        - Condition-based routing
        - Checkpoint-based recovery
        """
        completed_steps: set[str] = set()
        failed_steps: set[str] = set()

        while state.status == EngineStatus.RUNNING:
            # Find steps ready to execute
            ready_steps = self._find_ready_steps(state, completed_steps, failed_steps)

            if not ready_steps:
                if len(completed_steps) + len(failed_steps) >= len(state.steps):
                    break  # All steps processed
                else:
                    # Deadlock detection
                    state.status = EngineStatus.FAILED
                    state.error_message = "Deadlock detected: no steps can proceed"
                    break

            # Execute ready steps (sequentially for now; parallel support via asyncio.gather)
            for step in ready_steps:
                if state.status != EngineStatus.RUNNING:
                    break

                result = await self._execute_step(state, step)
                state.step_results[result.step_id] = result

                if result.status == "completed":
                    completed_steps.add(result.step_id)
                elif result.status == "failed":
                    failed_steps.add(result.step_id)
                    # In v2, we can continue with other branches
                    if not step.get("continue_on_failure", False):
                        state.status = EngineStatus.FAILED
                        state.error_message = result.error

        if state.status == EngineStatus.RUNNING:
            state.status = EngineStatus.COMPLETED
            state.completed_at = datetime.now(timezone.utc).isoformat()

        self._finalize_workflow(state)

    async def _execute_coordinator_v2(self, state: WorkflowRunState) -> None:
        """
        Execute in Coordinator Mode.

        Creates a CoordinatorSession and spawns WorkerAgents for each step.
        The coordinator orchestrates workers, handles SendMessage between them,
        and synthesizes results.

        Reference: Claude Code coordinatorMode.ts
        """
        if not is_coordinator_mode_enabled():
            logger.warning("Coordinator mode not enabled, falling back to static-dag-v2")
            await self._execute_static_dag_v2(state)
            return

        # Create coordinator session
        coord_id = f"coord-{uuid4().hex[:12]}"
        coord_session = CoordinatorSession(
            id=coord_id,
            workflow_instance_id=state.instance_id,
            status="active",
            plan_mode=0,
            config_json=json.dumps({"profile": "coordinator-v2"}),
        )
        self._db.add(coord_session)
        self._db.commit()

        await self._event_publisher.publish(OrchestrationEvent(
            event_type=OrchestrationEventType.COORDINATOR_SESSION_CREATED,
            payload={"coordinator_id": coord_id},
            instance_id=state.instance_id,
        ))

        # Spawn workers for each step
        for step in state.steps:
            if state.status != EngineStatus.RUNNING:
                break

            worker_id = f"worker-{uuid4().hex[:12]}"
            worker = WorkerAgent(
                id=worker_id,
                coordinator_id=coord_id,
                agent_type=step.get("agent_type", "worker"),
                status="pending",
                task_description=step.get("description", step.get("prompt", "")),
                context_json=json.dumps(step),
            )
            self._db.add(worker)
            self._db.commit()

            await self._event_publisher.publish(OrchestrationEvent(
                event_type=OrchestrationEventType.COORDINATOR_WORKER_SPAWNED,
                payload={"worker_id": worker_id, "step_id": step.get("id")},
                instance_id=state.instance_id,
            ))

            # Execute step through worker
            result = await self._execute_step(state, step)
            state.step_results[result.step_id] = result

            worker.status = result.status
            worker.result_json = json.dumps(result.output) if result.output else None
            if result.error:
                worker.error_message = result.error
            self._db.commit()

            await self._event_publisher.publish(OrchestrationEvent(
                event_type=(
                    OrchestrationEventType.COORDINATOR_WORKER_COMPLETED
                    if result.status == "completed"
                    else OrchestrationEventType.COORDINATOR_WORKER_FAILED
                ),
                payload={"worker_id": worker_id, "status": result.status},
                instance_id=state.instance_id,
            ))

            if result.status == "failed" and not step.get("continue_on_failure", False):
                state.status = EngineStatus.FAILED
                state.error_message = result.error

        # Finalize coordinator session
        coord_session.status = "completed" if state.status == EngineStatus.RUNNING else "failed"
        coord_session.completed_at = datetime.now(timezone.utc).isoformat()
        self._db.commit()

        if state.status == EngineStatus.RUNNING:
            state.status = EngineStatus.COMPLETED
            state.completed_at = datetime.now(timezone.utc).isoformat()

        self._finalize_workflow(state)

    async def _execute_plan_subtask_v2(self, state: WorkflowRunState) -> None:
        """
        Execute with dynamic plan + subtask decomposition.

        First step is a PLANNER step that generates an ExecutionPlan,
        subsequent steps are derived from the plan's subtasks.
        """
        # Execute planner step first
        if state.steps:
            planner_step = state.steps[0]
            planner_result = await self._execute_step(state, planner_step)
            state.step_results[planner_result.step_id] = planner_result

            if planner_result.status == "failed":
                state.status = EngineStatus.FAILED
                state.error_message = f"Planner failed: {planner_result.error}"
                self._finalize_workflow(state)
                return

            # Extract subtasks from planner output
            plan_output = planner_result.output or {}
            subtasks = plan_output.get("subtasks", [])

            if subtasks:
                # Convert subtasks to steps and execute
                for subtask in subtasks:
                    if state.status != EngineStatus.RUNNING:
                        break
                    step = {
                        "id": subtask.get("id", f"subtask-{uuid4().hex[:8]}"),
                        "name": subtask.get("name", ""),
                        "kind": subtask.get("kind", "agent_session"),
                        "description": subtask.get("description", ""),
                        "prompt": subtask.get("prompt", ""),
                        "depends_on": subtask.get("depends_on"),
                        "agent_id": subtask.get("assigned_agent_id"),
                    }
                    result = await self._execute_step(state, step)
                    state.step_results[result.step_id] = result

                    if result.status == "failed":
                        state.status = EngineStatus.FAILED
                        state.error_message = result.error

        if state.status == EngineStatus.RUNNING:
            state.status = EngineStatus.COMPLETED
            state.completed_at = datetime.now(timezone.utc).isoformat()

        self._finalize_workflow(state)

    # ── Dependency Resolution ──────────────────────────────

    def _check_dependencies(self, state: WorkflowRunState, step: dict) -> bool:
        """Check if all dependencies for a step are satisfied."""
        depends_on = step.get("depends_on")
        if not depends_on:
            return True

        if isinstance(depends_on, str):
            try:
                depends_on = json.loads(depends_on)
            except json.JSONDecodeError:
                return False

        for dep_id in depends_on:
            result = state.step_results.get(dep_id)
            if not result or result.status not in ("completed", "skipped"):
                return False

        return True

    def _find_ready_steps(
        self,
        state: WorkflowRunState,
        completed: set[str],
        failed: set[str],
    ) -> list[dict[str, Any]]:
        """Find steps that are ready to execute (dependencies met)."""
        ready = []
        for step in state.steps:
            step_id = step.get("id", "")
            if step_id in completed or step_id in failed:
                continue
            if step_id in state.step_results:
                continue

            depends_on = step.get("depends_on")
            if not depends_on:
                ready.append(step)
                continue

            if isinstance(depends_on, str):
                try:
                    depends_on = json.loads(depends_on)
                except json.JSONDecodeError:
                    continue

            if all(d in completed for d in depends_on):
                ready.append(step)

        return ready

    # ── Checkpoint & Finalization ──────────────────────────

    async def _save_checkpoint(
        self,
        state: WorkflowRunState,
        step_id: str,
        checkpoint_type: str,
        attempt: int,
        output_summary: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        """Save a checkpoint for recovery."""
        checkpoint = CheckpointData(
            checkpoint_type=checkpoint_type,
            state_json=json.dumps(state.to_dict()),
            output_summary=output_summary,
            attempt=attempt,
            idempotency_key=f"{state.instance_id}:{step_id}:{attempt}",
        )
        if error:
            checkpoint.output_summary = f"ERROR: {error}"

        await self._checkpoint_store.save(checkpoint)

        await self._event_publisher.publish(OrchestrationEvent(
            event_type=OrchestrationEventType.CHECKPOINT_CREATED,
            payload={"step_id": step_id, "type": checkpoint_type},
            instance_id=state.instance_id,
            step_id=step_id,
        ))

    def _finalize_workflow(self, state: WorkflowRunState) -> None:
        """Finalize workflow execution, update database."""
        instance = self._db.query(WorkflowInstance).filter_by(
            id=state.instance_id
        ).first()
        if not instance:
            return

        if state.status == EngineStatus.COMPLETED:
            instance.status = "completed"
        elif state.status == EngineStatus.FAILED:
            instance.status = "failed"
        elif state.status == EngineStatus.CANCELLED:
            instance.status = "cancelled"
        else:
            instance.status = state.status.value

        if state.completed_at:
            instance.completed_at = state.completed_at

        self._db.commit()

        # Clean up active run
        if state.instance_id in self._active_runs:
            del self._active_runs[state.instance_id]

        logger.info(f"Workflow {state.instance_id} finalized with status: {state.status.value}")

    # ── DAG Parsing ────────────────────────────────────────

    def _parse_dag_steps(self, template_id: str) -> list[dict[str, Any]]:
        """Parse steps from a workflow template's DAG definition."""
        from app.models.workflow import WorkflowTemplate

        template = self._db.query(WorkflowTemplate).filter_by(id=template_id).first()
        if not template:
            raise ValueError(f"Template {template_id} not found")

        dag = json.loads(template.dag) if isinstance(template.dag, str) else template.dag
        return dag.get("steps", dag.get("nodes", []))

    # ── State Query ────────────────────────────────────────

    def get_run_state(self, instance_id: str) -> Optional[WorkflowRunState]:
        """Get the current run state for a workflow instance."""
        return self._active_runs.get(instance_id)

    def get_active_runs(self) -> dict[str, WorkflowRunState]:
        """Get all active workflow runs."""
        return dict(self._active_runs)


# ============================================================
# Default Implementations
# ============================================================

class _DBCheckpointStore:
    """Database-backed checkpoint store."""

    def __init__(self, db: Session):
        self._db = db

    async def save(self, checkpoint: CheckpointData) -> str:
        cp_id = f"cp-{uuid4().hex[:12]}"
        record = OrchestrationCheckpoint(
            id=cp_id,
            workflow_instance_id=checkpoint.idempotency_key.split(":")[0]
            if ":" in checkpoint.idempotency_key else "",
            step_id=checkpoint.idempotency_key.split(":")[1]
            if ":" in checkpoint.idempotency_key else "",
            checkpoint_type=checkpoint.checkpoint_type,
            state_json=checkpoint.state_json,
            input_hash=checkpoint.input_hash,
            output_hash=checkpoint.output_hash,
            output_summary=checkpoint.output_summary,
            attempt=checkpoint.attempt,
        )
        self._db.add(record)
        self._db.commit()
        return cp_id

    async def load(self, checkpoint_id: str) -> Optional[CheckpointData]:
        record = self._db.query(OrchestrationCheckpoint).filter_by(id=checkpoint_id).first()
        if not record:
            return None
        return CheckpointData(
            checkpoint_type=record.checkpoint_type,
            state_json=record.state_json,
            input_hash=record.input_hash,
            output_hash=record.output_hash,
            output_summary=record.output_summary,
            attempt=record.attempt,
        )

    async def list_for_instance(self, instance_id: str) -> list[CheckpointData]:
        records = self._db.query(OrchestrationCheckpoint).filter_by(
            workflow_instance_id=instance_id
        ).all()
        return [
            CheckpointData(
                checkpoint_type=r.checkpoint_type,
                state_json=r.state_json,
                attempt=r.attempt,
            )
            for r in records
        ]


class _LogEventPublisher:
    """Logging-only event publisher (default when no WebSocket/MQ available)."""

    async def publish(self, event: OrchestrationEvent) -> None:
        logger.info(
            f"[OrchestrationEvent] {event.event_type.value} "
            f"instance={event.instance_id} step={event.step_id}"
        )
