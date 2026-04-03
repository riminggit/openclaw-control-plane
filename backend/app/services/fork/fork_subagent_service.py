"""
ForkSubagentService — Fork-based sub-agent spawning.

Creates lightweight sub-agents that share the parent's prompt cache,
enabling efficient parallel execution of related tasks.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5 P3-8
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


logger = logging.getLogger(__name__)


class ForkState(str, Enum):
    """Fork lifecycle state."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ForkInfo:
    """Information about a forked sub-agent."""
    id: str = field(default_factory=lambda: str(uuid4()))
    parent_agent_id: str = ""
    parent_session_key: str = ""
    task_id: str = ""
    workflow_instance_id: str = ""
    instruction: str = ""
    state: ForkState = ForkState.PENDING
    result: Any = None
    error: str = ""
    cache_shared: bool = True
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


class ForkSubagentService:
    """
    Manages fork-based sub-agent spawning for parallel execution.

    Phase 3 skeleton — implements the interface and in-memory storage.
    Full implementation will:
    1. Fork from parent agent's session with shared prompt cache
    2. Execute sub-task in parallel
    3. Collect results and merge back
    4. Optimize token usage through cache sharing
    """

    def __init__(self) -> None:
        self._forks: dict[str, ForkInfo] = {}
        logger.info("ForkSubagentService initialized (Phase 3 skeleton)")

    async def fork(
        self,
        parent_agent_id: str,
        parent_session_key: str,
        instruction: str,
        task_id: str = "",
        workflow_instance_id: str = "",
        share_cache: bool = True,
    ) -> ForkInfo:
        """
        Fork a sub-agent from a parent agent.

        Phase 3 skeleton — creates the fork record.
        Full implementation will:
        1. Clone the parent's session context
        2. Share prompt cache where possible
        3. Start parallel execution
        """
        info = ForkInfo(
            parent_agent_id=parent_agent_id,
            parent_session_key=parent_session_key,
            task_id=task_id,
            workflow_instance_id=workflow_instance_id,
            instruction=instruction,
            cache_shared=share_cache,
        )

        self._forks[info.id] = info
        logger.info("Forked sub-agent %s from parent %s", info.id, parent_agent_id)

        # TODO: Phase 3 — real fork execution via orchestration engine
        return info

    async def execute_fork(self, fork_id: str) -> ForkInfo:
        """
        Execute a pending fork.

        Phase 3 skeleton — marks as completed with mock result.
        """
        info = self._forks.get(fork_id)
        if not info:
            raise ValueError(f"Fork {fork_id} not found")

        info.state = ForkState.RUNNING
        try:
            # TODO: Phase 3 — real execution
            info.state = ForkState.COMPLETED
            info.result = {"status": "skeleton", "message": "Fork executed (mock)"}
            info.completed_at = datetime.now(timezone.utc).isoformat()
            logger.info("Fork %s completed", fork_id)
        except Exception as e:
            info.state = ForkState.FAILED
            info.error = str(e)
            logger.error("Fork %s failed: %s", fork_id, e)

        return info

    async def cancel_fork(self, fork_id: str) -> ForkInfo:
        """Cancel a running fork."""
        info = self._forks.get(fork_id)
        if not info:
            raise ValueError(f"Fork {fork_id} not found")

        info.state = ForkState.CANCELLED
        info.completed_at = datetime.now(timezone.utc).isoformat()
        logger.info("Fork %s cancelled", fork_id)
        return info

    async def get_fork(self, fork_id: str) -> ForkInfo | None:
        """Get fork info by ID."""
        return self._forks.get(fork_id)

    async def list_forks(
        self,
        parent_agent_id: str = "",
        task_id: str = "",
        state: ForkState | None = None,
    ) -> list[ForkInfo]:
        """List forks, optionally filtered."""
        forks = list(self._forks.values())
        if parent_agent_id:
            forks = [f for f in forks if f.parent_agent_id == parent_agent_id]
        if task_id:
            forks = [f for f in forks if f.task_id == task_id]
        if state:
            forks = [f for f in forks if f.state == state]
        return forks

    async def cleanup_forks(self, max_age_hours: int = 24) -> int:
        """Clean up completed/failed/cancelled forks."""
        to_remove = [
            fid for fid, f in self._forks.items()
            if f.state in (ForkState.COMPLETED, ForkState.FAILED, ForkState.CANCELLED)
        ]
        for fid in to_remove:
            del self._forks[fid]
        logger.info("Cleaned up %d old forks", len(to_remove))
        return len(to_remove)


# Singleton instance
_fork_service: ForkSubagentService | None = None


def get_fork_service() -> ForkSubagentService:
    """Get or create the singleton ForkSubagentService."""
    global _fork_service
    if _fork_service is None:
        _fork_service = ForkSubagentService()
    return _fork_service
