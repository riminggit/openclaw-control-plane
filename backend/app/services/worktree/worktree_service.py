"""
WorktreeService — Isolated working directories for agents.

Manages git worktrees (or directory copies) to provide each agent
with its own isolated workspace, preventing file conflicts during
parallel execution.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5 P3-7
"""

from __future__ import annotations

import logging
import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


logger = logging.getLogger(__name__)


class WorktreeState(str, Enum):
    """Worktree lifecycle state."""
    CREATING = "creating"
    ACTIVE = "active"
    MERGING = "merging"
    MERGED = "merged"
    DISCARDED = "discarded"
    ERROR = "error"


@dataclass
class WorktreeInfo:
    """Information about an agent's isolated worktree."""
    id: str = field(default_factory=lambda: str(uuid4()))
    agent_id: str = ""
    task_id: str = ""
    workflow_instance_id: str = ""
    base_branch: str = "main"
    branch: str = ""
    path: str = ""
    state: WorktreeState = WorktreeState.CREATING
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    merged_at: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


class WorktreeService:
    """
    Manages isolated working directories for agents.

    Phase 3 skeleton — implements the interface and in-memory storage.
    Full implementation will:
    1. Create git worktrees for each agent
    2. Track branch/file changes
    3. Support merge/rebase back to base branch
    4. Clean up worktrees after completion
    """

    def __init__(self, base_path: str = "") -> None:
        self._base_path = base_path or os.environ.get("WORKTREE_BASE_PATH", "/tmp/openclaw-worktrees")
        self._worktrees: dict[str, WorktreeInfo] = {}
        logger.info("WorktreeService initialized (Phase 3 skeleton, base=%s)", self._base_path)

    async def create_worktree(
        self,
        agent_id: str,
        task_id: str = "",
        workflow_instance_id: str = "",
        base_branch: str = "main",
    ) -> WorktreeInfo:
        """
        Create an isolated worktree for an agent.

        Phase 3 skeleton — creates a directory placeholder.
        Full implementation will use `git worktree add`.
        """
        branch = f"agent/{agent_id}/{uuid4().hex[:8]}"
        worktree_path = os.path.join(self._base_path, branch.replace("/", "-"))

        info = WorktreeInfo(
            agent_id=agent_id,
            task_id=task_id,
            workflow_instance_id=workflow_instance_id,
            base_branch=base_branch,
            branch=branch,
            path=worktree_path,
        )

        try:
            # TODO: Phase 3 — real git worktree creation
            os.makedirs(worktree_path, exist_ok=True)
            info.state = WorktreeState.ACTIVE
            logger.info("Created worktree %s for agent %s at %s", info.id, agent_id, worktree_path)
        except Exception as e:
            info.state = WorktreeState.ERROR
            logger.error("Failed to create worktree for agent %s: %s", agent_id, e)

        self._worktrees[info.id] = info
        return info

    async def merge_worktree(self, worktree_id: str, strategy: str = "merge") -> WorktreeInfo:
        """
        Merge a worktree's changes back to the base branch.

        Phase 3 skeleton — marks as merged.
        Full implementation will use `git merge` or `git rebase`.
        """
        info = self._worktrees.get(worktree_id)
        if not info:
            raise ValueError(f"Worktree {worktree_id} not found")

        info.state = WorktreeState.MERGING
        try:
            # TODO: Phase 3 — real git merge
            info.state = WorktreeState.MERGED
            info.merged_at = datetime.now(timezone.utc).isoformat()
            logger.info("Merged worktree %s (branch %s) into %s",
                        info.id, info.branch, info.base_branch)
        except Exception as e:
            info.state = WorktreeState.ERROR
            logger.error("Failed to merge worktree %s: %s", worktree_id, e)

        return info

    async def discard_worktree(self, worktree_id: str) -> WorktreeInfo:
        """Discard a worktree without merging."""
        info = self._worktrees.get(worktree_id)
        if not info:
            raise ValueError(f"Worktree {worktree_id} not found")

        try:
            if info.path and os.path.exists(info.path):
                shutil.rmtree(info.path, ignore_errors=True)
            info.state = WorktreeState.DISCARDED
            logger.info("Discarded worktree %s", info.id)
        except Exception as e:
            info.state = WorktreeState.ERROR
            logger.error("Failed to discard worktree %s: %s", worktree_id, e)

        return info

    async def get_worktree(self, worktree_id: str) -> WorktreeInfo | None:
        """Get worktree info by ID."""
        return self._worktrees.get(worktree_id)

    async def list_worktrees(
        self,
        agent_id: str = "",
        task_id: str = "",
        state: WorktreeState | None = None,
    ) -> list[WorktreeInfo]:
        """List worktrees, optionally filtered."""
        worktrees = list(self._worktrees.values())
        if agent_id:
            worktrees = [w for w in worktrees if w.agent_id == agent_id]
        if task_id:
            worktrees = [w for w in worktrees if w.task_id == task_id]
        if state:
            worktrees = [w for w in worktrees if w.state == state]
        return worktrees

    async def cleanup_worktrees(self, max_age_hours: int = 24) -> int:
        """Clean up old worktrees that are merged or discarded."""
        cleaned = 0
        for wt_id, info in list(self._worktrees.items()):
            if info.state in (WorktreeState.MERGED, WorktreeState.DISCARDED):
                if info.path and os.path.exists(info.path):
                    shutil.rmtree(info.path, ignore_errors=True)
                del self._worktrees[wt_id]
                cleaned += 1
        logger.info("Cleaned up %d old worktrees", cleaned)
        return cleaned


# Singleton instance
_worktree_service: WorktreeService | None = None


def get_worktree_service() -> WorktreeService:
    """Get or create the singleton WorktreeService."""
    global _worktree_service
    if _worktree_service is None:
        _worktree_service = WorktreeService()
    return _worktree_service
