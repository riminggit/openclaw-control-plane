"""
Feature Flags for OpenClaw v3.

Controls the gradual rollout of v3 orchestration capabilities.
All flags default to False (off) — new features must be explicitly enabled.

Reference: docs/requirements/openclaw-v3/08-migration-strategy.md
"""

from __future__ import annotations

import os
from functools import lru_cache

from app.core.config import Settings


class FeatureFlags:
    """
    Feature flag manager for OpenClaw v3.

    Reads flag values from application settings (environment variables).
    Provides property-based access for each feature flag.

    Usage::

        flags = FeatureFlags(settings)
        if flags.orchestration_v3:
            # use new orchestration path
        else:
            # use legacy path
    """

    def __init__(self, settings: Settings):
        self._settings = settings

    # ----------------------------------------------------------
    # Core orchestration
    # ----------------------------------------------------------

    @property
    def orchestration_v3(self) -> bool:
        """Master switch for v3 orchestration engine."""
        return getattr(self._settings, "orchestration_v3_enabled", False)

    @property
    def orchestration_profile_v2(self) -> bool:
        """Enable static-dag-v2 profile (checkpoints, conditions)."""
        return getattr(self._settings, "orchestration_profile_v2_enabled", False)

    @property
    def plan_subtask_v2(self) -> bool:
        """Enable plan-subtask-v2 profile (dynamic ExecutionPlan)."""
        return getattr(self._settings, "plan_subtask_v2_enabled", False)

    # ----------------------------------------------------------
    # Agent capabilities
    # ----------------------------------------------------------

    @property
    def coordinator_mode(self) -> bool:
        """Enable Coordinator Mode (multi-Worker orchestration)."""
        return getattr(self._settings, "coordinator_mode_enabled", False)

    @property
    def swarm_mode(self) -> bool:
        """Enable Agent Swarm / Team system."""
        return getattr(self._settings, "swarm_mode_enabled", False)

    @property
    def verification_agent(self) -> bool:
        """Enable independent Verification Agent."""
        return getattr(self._settings, "verification_agent_enabled", False)

    @property
    def fork_subagent(self) -> bool:
        """Enable Fork Subagent (shared prompt cache parallel execution)."""
        return getattr(self._settings, "fork_subagent_enabled", False)

    @property
    def worktree_isolation(self) -> bool:
        """Enable Git Worktree isolation for Agent execution."""
        return getattr(self._settings, "worktree_isolation_enabled", False)

    # ----------------------------------------------------------
    # Intelligence features
    # ----------------------------------------------------------

    @property
    def plan_mode(self) -> bool:
        """Enable Plan Mode (structured planning before execution)."""
        return getattr(self._settings, "plan_mode_enabled", False)

    @property
    def context_management(self) -> bool:
        """Enable Context Window Management (auto-compact, token budget)."""
        return getattr(self._settings, "context_management_enabled", False)

    @property
    def session_memory(self) -> bool:
        """Enable Session Memory (automatic memory extraction)."""
        return getattr(self._settings, "session_memory_enabled", False)

    @property
    def cost_tracking(self) -> bool:
        """Enable fine-grained Cost Tracking."""
        return getattr(self._settings, "cost_tracking_enabled", False)

    # ----------------------------------------------------------
    # Tool & extension features
    # ----------------------------------------------------------

    @property
    def skills_system(self) -> bool:
        """Enable Skills System (bundled + custom + MCP skills)."""
        return getattr(self._settings, "skills_system_enabled", False)

    @property
    def mcp_dynamic_discovery(self) -> bool:
        """Enable MCP Dynamic Tool Discovery."""
        return getattr(self._settings, "mcp_dynamic_discovery_enabled", False)

    @property
    def plugin_system(self) -> bool:
        """Enable Plugin System."""
        return getattr(self._settings, "plugin_system_enabled", False)

    @property
    def lsp_integration(self) -> bool:
        """Enable LSP Integration."""
        return getattr(self._settings, "lsp_integration_enabled", False)

    @property
    def cron_triggers(self) -> bool:
        """Enable Cron & Remote Triggers."""
        return getattr(self._settings, "cron_triggers_enabled", False)

    # ----------------------------------------------------------
    # Utility
    # ----------------------------------------------------------

    def get_all_flags(self) -> dict[str, bool]:
        """Return a dictionary of all feature flags and their states."""
        return {
            "orchestration_v3": self.orchestration_v3,
            "orchestration_profile_v2": self.orchestration_profile_v2,
            "plan_subtask_v2": self.plan_subtask_v2,
            "coordinator_mode": self.coordinator_mode,
            "swarm_mode": self.swarm_mode,
            "verification_agent": self.verification_agent,
            "fork_subagent": self.fork_subagent,
            "worktree_isolation": self.worktree_isolation,
            "plan_mode": self.plan_mode,
            "context_management": self.context_management,
            "session_memory": self.session_memory,
            "cost_tracking": self.cost_tracking,
            "skills_system": self.skills_system,
            "mcp_dynamic_discovery": self.mcp_dynamic_discovery,
            "plugin_system": self.plugin_system,
            "lsp_integration": self.lsp_integration,
            "cron_triggers": self.cron_triggers,
        }


@lru_cache(maxsize=1)
def get_feature_flags() -> FeatureFlags:
    """Get cached FeatureFlags singleton."""
    from app.core.config import settings
    return FeatureFlags(settings)


def is_coordinator_mode_enabled() -> bool:
    """
    Coordinator mode: on when `coordinator_mode_enabled` (env) is true,
    or legacy `OPENCLAW_FEATURE_COORDINATOR_MODE` is set to true/1/yes.
    """
    if get_feature_flags().coordinator_mode:
        return True
    return os.environ.get("OPENCLAW_FEATURE_COORDINATOR_MODE", "").lower() in (
        "true",
        "1",
        "yes",
    )
