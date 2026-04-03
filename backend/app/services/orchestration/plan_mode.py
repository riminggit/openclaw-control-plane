"""
PlanMode — Dynamic plan creation and subtask decomposition for OpenClaw v3.

Implements a planning system where an LLM agent first creates an execution plan,
which is then decomposed into subtasks that can be executed by worker agents.

Reference: Claude Code src/services/planMode.ts, src/services/planner.ts
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

from app.models.orchestration import ExecutionPlan, Subtask

logger = logging.getLogger(__name__)


# ============================================================
# Constants
# ============================================================

PLAN_STATUS_DRAFT = "draft"
PLAN_STATUS_APPROVED = "approved"
PLAN_STATUS_EXECUTING = "executing"
PLAN_STATUS_COMPLETED = "completed"
PLAN_STATUS_FAILED = "failed"
PLAN_STATUS_CANCELLED = "cancelled"

SUBTASK_STATUS_PENDING = "pending"
SUBTASK_STATUS_READY = "ready"
SUBTASK_STATUS_IN_PROGRESS = "in_progress"
SUBTASK_STATUS_COMPLETED = "completed"
SUBTASK_STATUS_FAILED = "failed"
SUBTASK_STATUS_SKIPPED = "skipped"
SUBTASK_STATUS_BLOCKED = "blocked"

PLAN_SOURCE_PLANNER_AGENT = "planner_agent"
PLAN_SOURCE_HUMAN = "human"
PLAN_SOURCE_TEMPLATE = "template"
PLAN_SOURCE_AUTO = "auto"


# ============================================================
# Enums
# ============================================================

class PlanStatus(str, Enum):
    DRAFT = PLAN_STATUS_DRAFT
    APPROVED = PLAN_STATUS_APPROVED
    EXECUTING = PLAN_STATUS_EXECUTING
    COMPLETED = PLAN_STATUS_COMPLETED
    FAILED = PLAN_STATUS_FAILED
    CANCELLED = PLAN_STATUS_CANCELLED


class SubtaskStatus(str, Enum):
    PENDING = SUBTASK_STATUS_PENDING
    READY = SUBTASK_STATUS_READY
    IN_PROGRESS = SUBTASK_STATUS_IN_PROGRESS
    COMPLETED = SUBTASK_STATUS_COMPLETED
    FAILED = SUBTASK_STATUS_FAILED
    SKIPPED = SUBTASK_STATUS_SKIPPED
    BLOCKED = SUBTASK_STATUS_BLOCKED


class PlanSource(str, Enum):
    PLANNER_AGENT = PLAN_SOURCE_PLANNER_AGENT
    HUMAN = PLAN_SOURCE_HUMAN
    TEMPLATE = PLAN_SOURCE_TEMPLATE
    AUTO = PLAN_SOURCE_AUTO


# ============================================================
# Data Types
# ============================================================

@dataclass
class SubtaskDefinition:
    """Definition of a subtask within a plan."""
    id: str
    name: str
    description: str = ""
    depends_on: list[str] = field(default_factory=list)
    assigned_agent_id: Optional[str] = None
    input_data: dict[str, Any] = field(default_factory=dict)
    estimated_steps: int = 1
    priority: int = 0  # 0=normal, higher=more important
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "depends_on": self.depends_on,
            "assigned_agent_id": self.assigned_agent_id,
            "input_data": self.input_data,
            "estimated_steps": self.estimated_steps,
            "priority": self.priority,
            "tags": self.tags,
        }


@dataclass
class PlanDefinition:
    """Definition of an execution plan."""
    id: str
    workflow_instance_id: str
    title: str = ""
    description: str = ""
    source: str = PLAN_SOURCE_PLANNER_AGENT
    subtasks: list[SubtaskDefinition] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "workflow_instance_id": self.workflow_instance_id,
            "title": self.title,
            "description": self.description,
            "source": self.source,
            "subtasks": [st.to_dict() for st in self.subtasks],
            "metadata": self.metadata,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PlanDefinition:
        """Create from a dictionary."""
        subtasks = []
        for st_data in data.get("subtasks", []):
            subtasks.append(SubtaskDefinition(
                id=st_data.get("id", f"st-{uuid4().hex[:8]}"),
                name=st_data.get("name", ""),
                description=st_data.get("description", ""),
                depends_on=st_data.get("depends_on", []),
                assigned_agent_id=st_data.get("assigned_agent_id"),
                input_data=st_data.get("input_data", {}),
                estimated_steps=st_data.get("estimated_steps", 1),
                priority=st_data.get("priority", 0),
                tags=st_data.get("tags", []),
            ))
        return cls(
            id=data.get("id", f"plan-{uuid4().hex[:12]}"),
            workflow_instance_id=data.get("workflow_instance_id", ""),
            title=data.get("title", ""),
            description=data.get("description", ""),
            source=data.get("source", PLAN_SOURCE_PLANNER_AGENT),
            subtasks=subtasks,
            metadata=data.get("metadata", {}),
        )


@dataclass
class PlanExecutionState:
    """Runtime state of a plan execution."""
    plan_id: str
    status: str = PLAN_STATUS_DRAFT
    completed_subtasks: int = 0
    failed_subtasks: int = 0
    total_subtasks: int = 0
    progress_percent: float = 0.0
    current_subtask_id: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "plan_id": self.plan_id,
            "status": self.status,
            "completed_subtasks": self.completed_subtasks,
            "failed_subtasks": self.failed_subtasks,
            "total_subtasks": self.total_subtasks,
            "progress_percent": round(self.progress_percent, 1),
            "current_subtask_id": self.current_subtask_id,
        }


@dataclass
class PlanValidationResult:
    """Result of validating a plan."""
    valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    subtask_count: int = 0
    max_depth: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "subtask_count": self.subtask_count,
            "max_depth": self.max_depth,
        }


# ============================================================
# Plan Prompt Templates
# ============================================================

PLAN_GENERATION_PROMPT = """You are a task planning agent. Given a high-level task, break it down into a structured execution plan.

## Task
{task_description}

## Context
{context}

## Available Agents
{agents}

## Instructions
1. Analyze the task and identify all necessary subtasks
2. Order subtasks by dependency (what must happen first)
3. Assign each subtask to the most appropriate agent
4. Define clear inputs and expected outputs for each subtask
5. Estimate complexity (number of steps) for each subtask

## Output Format
Respond with a JSON object:
```json
{{
  "title": "Plan title",
  "description": "Plan description",
  "subtasks": [
    {{
      "id": "st-1",
      "name": "Subtask name",
      "description": "What this subtask does",
      "depends_on": [],
      "assigned_agent_id": "agent-id-or-null",
      "input_data": {{}},
      "estimated_steps": 1,
      "priority": 0,
      "tags": []
    }}
  ]
}}
```
"""

PLAN_REFINEMENT_PROMPT = """You are a plan refinement agent. Review the current plan and suggest improvements.

## Current Plan
{current_plan}

## Execution Results So Far
{execution_results}

## Issues Encountered
{issues}

## Instructions
1. Review completed subtasks and their results
2. Identify any issues or blockers
3. Suggest modifications to remaining subtasks
4. Add new subtasks if needed
5. Re-prioritize if necessary

## Output Format
Respond with the updated plan JSON (same format as plan generation).
"""


# ============================================================
# PlanMode Service
# ============================================================

class PlanMode:
    """
    Dynamic plan creation and subtask decomposition service.

    Responsibilities:
    1. Create execution plans from task descriptions
    2. Decompose plans into ordered subtasks
    3. Validate plan structure (dependency cycles, orphan tasks)
    4. Track plan execution progress
    5. Support plan refinement based on execution feedback
    6. Persist plans and subtasks to database

    Design follows Claude Code's Plan Mode:
    - Planner agent generates structured plans
    - Plans are validated before execution
    - Subtasks have explicit dependencies
    - Plans can be refined mid-execution
    - Support for human approval gate

    Reference: Claude Code src/services/planMode.ts
    """

    def __init__(
        self,
        db: Optional[Session] = None,
        require_approval: bool = True,
        max_subtasks: int = 50,
        max_depth: int = 5,
    ):
        self._db = db
        self._require_approval = require_approval
        self._max_subtasks = max_subtasks
        self._max_depth = max_depth

    # ── Plan Creation ──────────────────────────────────────

    def create_plan(
        self,
        workflow_instance_id: str,
        title: str = "",
        description: str = "",
        source: str = PLAN_SOURCE_PLANNER_AGENT,
        subtask_defs: Optional[list[dict[str, Any]]] = None,
    ) -> PlanDefinition:
        """
        Create a new execution plan.

        Args:
            workflow_instance_id: Associated workflow instance
            title: Plan title
            description: Plan description
            source: Plan source (planner_agent/human/template/auto)
            subtask_defs: Optional list of subtask definitions

        Returns:
            PlanDefinition with assigned IDs
        """
        plan_id = f"plan-{uuid4().hex[:12]}"

        # Parse subtask definitions
        subtasks = []
        if subtask_defs:
            for i, st_def in enumerate(subtask_defs):
                subtask = SubtaskDefinition(
                    id=st_def.get("id", f"st-{uuid4().hex[:8]}"),
                    name=st_def.get("name", f"Subtask {i + 1}"),
                    description=st_def.get("description", ""),
                    depends_on=st_def.get("depends_on", []),
                    assigned_agent_id=st_def.get("assigned_agent_id"),
                    input_data=st_def.get("input_data", {}),
                    estimated_steps=st_def.get("estimated_steps", 1),
                    priority=st_def.get("priority", 0),
                    tags=st_def.get("tags", []),
                )
                subtasks.append(subtask)

        plan = PlanDefinition(
            id=plan_id,
            workflow_instance_id=workflow_instance_id,
            title=title,
            description=description,
            source=source,
            subtasks=subtasks,
        )

        # Validate
        validation = self.validate_plan(plan)
        if not validation.valid:
            logger.warning(f"Plan created with validation issues: {validation.errors}")

        # Persist to database
        if self._db:
            self._persist_plan(plan)

        logger.info(f"Created plan {plan_id} with {len(subtasks)} subtasks")
        return plan

    def create_plan_from_llm_output(
        self,
        workflow_instance_id: str,
        llm_output: str,
        source: str = PLAN_SOURCE_PLANNER_AGENT,
    ) -> PlanDefinition:
        """
        Create a plan from LLM output (JSON string).

        Parses the LLM response and creates a structured plan.

        Args:
            workflow_instance_id: Associated workflow instance
            llm_output: LLM response containing plan JSON
            source: Plan source

        Returns:
            PlanDefinition parsed from LLM output
        """
        # Extract JSON from markdown code blocks if present
        json_str = self._extract_json(llm_output)

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM plan output: {e}")
            # Create a single fallback subtask
            data = {
                "title": "Auto-generated plan",
                "description": llm_output[:500],
                "subtasks": [{
                    "id": f"st-{uuid4().hex[:8]}",
                    "name": "Execute task",
                    "description": llm_output[:500],
                }],
            }

        data["workflow_instance_id"] = workflow_instance_id
        data["source"] = source

        plan = PlanDefinition.from_dict(data)

        # Validate
        validation = self.validate_plan(plan)
        if not validation.valid:
            logger.warning(f"LLM plan has validation issues: {validation.errors}")

        # Persist
        if self._db:
            self._persist_plan(plan)

        logger.info(f"Created plan from LLM output: {plan.id} with {len(plan.subtasks)} subtasks")
        return plan

    # ── Plan Validation ────────────────────────────────────

    def validate_plan(self, plan: PlanDefinition) -> PlanValidationResult:
        """
        Validate a plan's structure and dependencies.

        Checks:
        1. Circular dependencies
        2. Missing dependency references
        3. Orphan subtasks (no path from root)
        4. Maximum subtask count
        5. Maximum dependency depth
        6. Required fields

        Args:
            plan: Plan to validate

        Returns:
            PlanValidationResult with errors and warnings
        """
        errors: list[str] = []
        warnings: list[str] = []

        subtask_ids = {st.id for st in plan.subtasks}
        subtask_count = len(plan.subtasks)

        # Check max subtasks
        if subtask_count > self._max_subtasks:
            errors.append(f"Too many subtasks: {subtask_count} > {self._max_subtasks}")

        # Check for empty plan
        if subtask_count == 0:
            warnings.append("Plan has no subtasks")

        # Check for duplicate IDs
        seen_ids: set[str] = set()
        for st in plan.subtasks:
            if st.id in seen_ids:
                errors.append(f"Duplicate subtask ID: {st.id}")
            seen_ids.add(st.id)

        # Check required fields
        for st in plan.subtasks:
            if not st.name:
                errors.append(f"Subtask {st.id} missing name")
            if not st.id:
                errors.append("Subtask missing ID")

        # Check dependency references
        for st in plan.subtasks:
            for dep_id in st.depends_on:
                if dep_id not in subtask_ids:
                    errors.append(
                        f"Subtask {st.id} depends on non-existent subtask: {dep_id}"
                    )

        # Check for circular dependencies
        cycle = self._detect_cycle(plan.subtasks)
        if cycle:
            errors.append(f"Circular dependency detected: {' -> '.join(cycle)}")

        # Check for orphan subtasks (no dependency path from root)
        roots = self._find_root_subtasks(plan.subtasks)
        if len(roots) == 0 and subtask_count > 0:
            errors.append("No root subtasks found (possible circular dependency)")
        elif subtask_count > 1 and len(roots) == subtask_count:
            warnings.append("All subtasks are independent (no dependencies defined)")

        # Calculate max depth
        max_depth = self._calculate_max_depth(plan.subtasks)
        if max_depth > self._max_depth:
            errors.append(f"Dependency chain too deep: {max_depth} > {self._max_depth}")

        return PlanValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            subtask_count=subtask_count,
            max_depth=max_depth,
        )

    # ── Plan Execution ─────────────────────────────────────

    def get_execution_order(self, plan: PlanDefinition) -> list[list[SubtaskDefinition]]:
        """
        Get subtasks grouped by execution waves (topological sort).

        Returns subtasks in waves where each wave contains subtasks
        that can be executed in parallel.

        Args:
            plan: Plan to analyze

        Returns:
            List of waves, each wave is a list of subtasks
        """
        subtask_map = {st.id: st for st in plan.subtasks}
        completed: set[str] = set()
        waves: list[list[SubtaskDefinition]] = []
        remaining = set(subtask_map.keys())

        while remaining:
            # Find subtasks whose dependencies are all completed
            wave = []
            for st_id in list(remaining):
                st = subtask_map[st_id]
                if all(dep in completed for dep in st.depends_on):
                    wave.append(st)

            if not wave:
                # Deadlock - remaining subtasks have unresolvable dependencies
                logger.warning(f"Deadlock in plan {plan.id}, remaining: {remaining}")
                break

            waves.append(wave)
            for st in wave:
                completed.add(st.id)
                remaining.discard(st.id)

        return waves

    def get_ready_subtasks(
        self,
        plan: PlanDefinition,
        completed_ids: set[str],
        failed_ids: Optional[set[str]] = None,
    ) -> list[SubtaskDefinition]:
        """
        Get subtasks that are ready to execute.

        A subtask is ready if all its dependencies are completed
        (and not failed, unless continue_on_failure).

        Args:
            plan: Plan to query
            completed_ids: Set of completed subtask IDs
            failed_ids: Set of failed subtask IDs

        Returns:
            List of ready subtasks
        """
        failed_ids = failed_ids or set()
        ready = []

        for st in plan.subtasks:
            if st.id in completed_ids or st.id in failed_ids:
                continue

            # Check all dependencies are completed
            all_deps_met = all(
                dep in completed_ids for dep in st.depends_on
            )

            # Check no dependency has failed
            no_dep_failed = not any(
                dep in failed_ids for dep in st.depends_on
            )

            if all_deps_met and no_dep_failed:
                ready.append(st)

        # Sort by priority (descending)
        ready.sort(key=lambda st: st.priority, reverse=True)
        return ready

    def get_execution_state(
        self,
        plan: PlanDefinition,
        subtask_statuses: dict[str, str],
    ) -> PlanExecutionState:
        """
        Calculate current execution state of a plan.

        Args:
            plan: Plan to query
            subtask_statuses: Map of subtask_id -> status

        Returns:
            PlanExecutionState with progress info
        """
        total = len(plan.subtasks)
        completed = sum(1 for s in subtask_statuses.values() if s == SUBTASK_STATUS_COMPLETED)
        failed = sum(1 for s in subtask_statuses.values() if s == SUBTASK_STATUS_FAILED)
        in_progress = sum(1 for s in subtask_statuses.values() if s == SUBTASK_STATUS_IN_PROGRESS)

        progress = (completed / total * 100) if total > 0 else 0.0

        # Determine overall status
        if failed > 0:
            status = PLAN_STATUS_FAILED
        elif completed == total and total > 0:
            status = PLAN_STATUS_COMPLETED
        elif in_progress > 0:
            status = PLAN_STATUS_EXECUTING
        else:
            status = PLAN_STATUS_DRAFT

        # Find current subtask
        current_id = None
        for st_id, st_status in subtask_statuses.items():
            if st_status == SUBTASK_STATUS_IN_PROGRESS:
                current_id = st_id
                break

        return PlanExecutionState(
            plan_id=plan.id,
            status=status,
            completed_subtasks=completed,
            failed_subtasks=failed,
            total_subtasks=total,
            progress_percent=progress,
            current_subtask_id=current_id,
        )

    # ── Plan Approval ──────────────────────────────────────

    def approve_plan(self, plan_id: str, approved_by: str) -> bool:
        """
        Approve a plan for execution.

        Args:
            plan_id: Plan ID to approve
            approved_by: User/approver identifier

        Returns:
            True if plan was approved
        """
        if not self._db:
            return False

        plan = self._db.query(ExecutionPlan).filter_by(id=plan_id).first()
        if not plan:
            return False

        if plan.status != PLAN_STATUS_DRAFT:
            logger.warning(f"Plan {plan_id} is not in draft status: {plan.status}")
            return False

        plan.status = PLAN_STATUS_APPROVED
        plan.approved_by = approved_by
        plan.approved_at = datetime.now(timezone.utc).isoformat()
        self._db.commit()

        logger.info(f"Plan {plan_id} approved by {approved_by}")
        return True

    def reject_plan(self, plan_id: str, reason: str = "") -> bool:
        """Reject a plan (set to cancelled)."""
        if not self._db:
            return False

        plan = self._db.query(ExecutionPlan).filter_by(id=plan_id).first()
        if not plan:
            return False

        plan.status = PLAN_STATUS_CANCELLED
        self._db.commit()

        logger.info(f"Plan {plan_id} rejected: {reason}")
        return True

    # ── Plan Query ─────────────────────────────────────────

    def get_plan(self, plan_id: str) -> Optional[PlanDefinition]:
        """Get a plan by ID from database."""
        if not self._db:
            return None

        plan = self._db.query(ExecutionPlan).filter_by(id=plan_id).first()
        if not plan:
            return None

        return self._db_plan_to_definition(plan)

    def get_plans_for_workflow(self, workflow_instance_id: str) -> list[PlanDefinition]:
        """Get all plans for a workflow instance."""
        if not self._db:
            return []

        plans = self._db.query(ExecutionPlan).filter_by(
            workflow_instance_id=workflow_instance_id
        ).all()

        return [self._db_plan_to_definition(p) for p in plans]

    def get_subtask(self, subtask_id: str) -> Optional[SubtaskDefinition]:
        """Get a subtask by ID."""
        if not self._db:
            return None

        subtask = self._db.query(Subtask).filter_by(id=subtask_id).first()
        if not subtask:
            return None

        return self._db_subtask_to_definition(subtask)

    def get_subtasks_for_plan(self, plan_id: str) -> list[SubtaskDefinition]:
        """Get all subtasks for a plan."""
        if not self._db:
            return []

        subtasks = self._db.query(Subtask).filter_by(plan_id=plan_id).order_by(
            Subtask.order_index
        ).all()

        return [self._db_subtask_to_definition(st) for st in subtasks]

    def update_subtask_status(
        self,
        subtask_id: str,
        status: str,
        output: Optional[dict[str, Any]] = None,
    ) -> bool:
        """Update a subtask's status and output."""
        if not self._db:
            return False

        subtask = self._db.query(Subtask).filter_by(id=subtask_id).first()
        if not subtask:
            return False

        subtask.status = status
        if output:
            subtask.output_json = json.dumps(output)
        if status == SUBTASK_STATUS_IN_PROGRESS:
            subtask.started_at = datetime.now(timezone.utc).isoformat()
        elif status in (SUBTASK_STATUS_COMPLETED, SUBTASK_STATUS_FAILED, SUBTASK_STATUS_SKIPPED):
            subtask.completed_at = datetime.now(timezone.utc).isoformat()

        self._db.commit()
        return True

    # ── Plan Refinement ────────────────────────────────────

    def refine_plan(
        self,
        plan_id: str,
        new_subtasks: Optional[list[dict[str, Any]]] = None,
        remove_subtask_ids: Optional[list[str]] = None,
        update_subtasks: Optional[dict[str, dict[str, Any]]] = None,
    ) -> Optional[PlanDefinition]:
        """
        Refine an existing plan.

        Can add, remove, or update subtasks while maintaining
        dependency integrity.

        Args:
            plan_id: Plan to refine
            new_subtasks: New subtasks to add
            remove_subtask_ids: Subtask IDs to remove
            update_subtasks: Map of subtask_id -> fields to update

        Returns:
            Updated PlanDefinition
        """
        if not self._db:
            return None

        plan_record = self._db.query(ExecutionPlan).filter_by(id=plan_id).first()
        if not plan_record:
            return None

        # Increment version
        plan_record.version = (plan_record.version or 0) + 1

        # Remove subtasks
        if remove_subtask_ids:
            for st_id in remove_subtask_ids:
                subtask = self._db.query(Subtask).filter_by(id=st_id, plan_id=plan_id).first()
                if subtask:
                    self._db.delete(subtask)

        # Add new subtasks
        if new_subtasks:
            existing_count = self._db.query(Subtask).filter_by(plan_id=plan_id).count()
            for i, st_def in enumerate(new_subtasks):
                st = Subtask(
                    id=st_def.get("id", f"st-{uuid4().hex[:8]}"),
                    plan_id=plan_id,
                    name=st_def.get("name", f"Subtask {existing_count + i + 1}"),
                    description=st_def.get("description", ""),
                    status=SUBTASK_STATUS_PENDING,
                    depends_on=json.dumps(st_def.get("depends_on", [])),
                    assigned_agent_id=st_def.get("assigned_agent_id"),
                    input_json=json.dumps(st_def.get("input_data", {})),
                    order_index=existing_count + i,
                )
                self._db.add(st)

        # Update existing subtasks
        if update_subtasks:
            for st_id, updates in update_subtasks.items():
                subtask = self._db.query(Subtask).filter_by(id=st_id, plan_id=plan_id).first()
                if subtask:
                    if "name" in updates:
                        subtask.name = updates["name"]
                    if "description" in updates:
                        subtask.description = updates["description"]
                    if "depends_on" in updates:
                        subtask.depends_on = json.dumps(updates["depends_on"])
                    if "assigned_agent_id" in updates:
                        subtask.assigned_agent_id = updates["assigned_agent_id"]
                    if "status" in updates:
                        subtask.status = updates["status"]

        self._db.commit()

        # Return updated plan
        return self._db_plan_to_definition(plan_record)

    # ── Prompt Generation ──────────────────────────────────

    def generate_plan_prompt(
        self,
        task_description: str,
        context: str = "",
        agents: str = "",
    ) -> str:
        """
        Generate a prompt for the LLM to create a plan.

        Args:
            task_description: High-level task description
            context: Additional context
            agents: Available agents description

        Returns:
            Formatted prompt string
        """
        return PLAN_GENERATION_PROMPT.format(
            task_description=task_description,
            context=context or "No additional context provided.",
            agents=agents or "Default agent pool available.",
        )

    def generate_refinement_prompt(
        self,
        current_plan: PlanDefinition,
        execution_results: str = "",
        issues: str = "",
    ) -> str:
        """
        Generate a prompt for plan refinement.

        Args:
            current_plan: Current plan definition
            execution_results: Results from completed subtasks
            issues: Issues encountered during execution

        Returns:
            Formatted refinement prompt
        """
        return PLAN_REFINEMENT_PROMPT.format(
            current_plan=current_plan.to_json(),
            execution_results=execution_results or "No results yet.",
            issues=issues or "No issues reported.",
        )

    # ── Private Helpers ────────────────────────────────────

    def _detect_cycle(self, subtasks: list[SubtaskDefinition]) -> Optional[list[str]]:
        """Detect circular dependencies using DFS."""
        adjacency = {st.id: st.depends_on for st in subtasks}
        visited: set[str] = set()
        rec_stack: set[str] = set()
        path: list[str] = []

        def dfs(node: str) -> bool:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for neighbor in adjacency.get(node, []):
                if neighbor not in visited:
                    if dfs(neighbor):
                        return True
                elif neighbor in rec_stack:
                    path.append(neighbor)
                    return True

            path.pop()
            rec_stack.discard(node)
            return False

        for st_id in adjacency:
            if st_id not in visited:
                if dfs(st_id):
                    # Extract cycle from path
                    cycle_start = path.index(path[-1])
                    return path[cycle_start:]

        return None

    def _find_root_subtasks(self, subtasks: list[SubtaskDefinition]) -> list[SubtaskDefinition]:
        """Find subtasks with no dependencies (roots)."""
        return [st for st in subtasks if not st.depends_on]

    def _calculate_max_depth(self, subtasks: list[SubtaskDefinition]) -> int:
        """Calculate maximum dependency chain depth."""
        if not subtasks:
            return 0

        depth_cache: dict[str, int] = {}
        subtask_map = {st.id: st for st in subtasks}

        def get_depth(st_id: str) -> int:
            if st_id in depth_cache:
                return depth_cache[st_id]
            if st_id not in subtask_map:
                return 0

            st = subtask_map[st_id]
            if not st.depends_on:
                depth_cache[st_id] = 1
                return 1

            max_dep_depth = max(get_depth(dep) for dep in st.depends_on)
            depth_cache[st_id] = max_dep_depth + 1
            return depth_cache[st_id]

        return max(get_depth(st.id) for st in subtasks)

    def _extract_json(self, text: str) -> str:
        """Extract JSON from text, handling markdown code blocks."""
        # Try to find JSON in code blocks
        import re
        code_block_match = re.search(r'```(?:json)?\s*\n(.*?)\n```', text, re.DOTALL)
        if code_block_match:
            return code_block_match.group(1).strip()

        # Try to find raw JSON object
        brace_match = re.search(r'\{.*\}', text, re.DOTALL)
        if brace_match:
            return brace_match.group(0)

        return text.strip()

    def _persist_plan(self, plan: PlanDefinition) -> None:
        """Persist a plan and its subtasks to the database."""
        if not self._db:
            return

        try:
            now = datetime.now(timezone.utc).isoformat()

            # Create plan record
            plan_record = ExecutionPlan(
                id=plan.id,
                workflow_instance_id=plan.workflow_instance_id,
                source=plan.source,
                status=PLAN_STATUS_DRAFT if self._require_approval else PLAN_STATUS_APPROVED,
                plan_json=plan.to_json(),
                version=1,
                created_at=now,
            )
            self._db.add(plan_record)

            # Create subtask records
            for i, st in enumerate(plan.subtasks):
                subtask_record = Subtask(
                    id=st.id,
                    plan_id=plan.id,
                    name=st.name,
                    description=st.description,
                    status=SUBTASK_STATUS_PENDING,
                    depends_on=json.dumps(st.depends_on),
                    assigned_agent_id=st.assigned_agent_id,
                    input_json=json.dumps(st.input_data) if st.input_data else None,
                    order_index=i,
                    created_at=now,
                )
                self._db.add(subtask_record)

            self._db.commit()
            logger.info(f"Persisted plan {plan.id} with {len(plan.subtasks)} subtasks")

        except Exception as e:
            logger.error(f"Failed to persist plan: {e}")
            self._db.rollback()

    def _db_plan_to_definition(self, plan: ExecutionPlan) -> PlanDefinition:
        """Convert a DB ExecutionPlan to PlanDefinition."""
        plan_json = plan.plan_json
        if isinstance(plan_json, str):
            try:
                data = json.loads(plan_json)
            except json.JSONDecodeError:
                data = {}
        else:
            data = plan_json

        return PlanDefinition(
            id=plan.id,
            workflow_instance_id=plan.workflow_instance_id,
            title=data.get("title", ""),
            description=data.get("description", ""),
            source=plan.source,
            subtasks=[],  # Loaded separately
            metadata={
                "status": plan.status,
                "version": plan.version,
                "approved_by": plan.approved_by,
                "created_at": plan.created_at,
                "approved_at": plan.approved_at,
            },
        )

    def _db_subtask_to_definition(self, st: Subtask) -> SubtaskDefinition:
        """Convert a DB Subtask to SubtaskDefinition."""
        depends_on = st.depends_on
        if isinstance(depends_on, str):
            try:
                depends_on = json.loads(depends_on)
            except json.JSONDecodeError:
                depends_on = []

        input_data = {}
        if st.input_json:
            try:
                input_data = json.loads(st.input_json) if isinstance(st.input_json, str) else st.input_json
            except json.JSONDecodeError:
                input_data = {}

        return SubtaskDefinition(
            id=st.id,
            name=st.name,
            description=st.description or "",
            depends_on=depends_on,
            assigned_agent_id=st.assigned_agent_id,
            input_data=input_data,
        )
