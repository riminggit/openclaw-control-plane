"""
CostTracker — Fine-grained model-level cost tracking for OpenClaw v3.

Tracks token usage and USD cost per model, per session, per workflow.
Provides budget enforcement and cost alerts.

Reference: Claude Code src/cost-tracker.ts, src/utils/modelCost.ts
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.orchestration import CostRecord

logger = logging.getLogger(__name__)

# Cap in-memory entry list to avoid unbounded growth. Totals use _grand_total_cost_usd /
# _session_costs / _workflow_costs; entry-level summaries may only cover recent rows after trim.
_MAX_IN_MEMORY_ENTRIES = 5000


# ============================================================
# Model Pricing (USD per 1M tokens)
# ============================================================

MODEL_PRICING: dict[str, dict[str, float]] = {
    # Anthropic models
    "claude-sonnet-4": {"input": 3.0, "output": 15.0, "cache_write": 3.75, "cache_read": 0.30},
    "claude-opus-4": {"input": 15.0, "output": 75.0, "cache_write": 18.75, "cache_read": 1.50},
    "claude-haiku-3.5": {"input": 0.80, "output": 4.0, "cache_write": 1.0, "cache_read": 0.08},
    "claude-sonnet-3.5": {"input": 3.0, "output": 15.0, "cache_write": 3.75, "cache_read": 0.30},
    # OpenAI models
    "gpt-4o": {"input": 2.50, "output": 10.0, "cache_write": 0.0, "cache_read": 1.25},
    "gpt-4-turbo": {"input": 10.0, "output": 30.0, "cache_write": 0.0, "cache_read": 0.0},
    "gpt-4": {"input": 30.0, "output": 60.0, "cache_write": 0.0, "cache_read": 0.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60, "cache_write": 0.0, "cache_read": 0.075},
    # Default
    "default": {"input": 3.0, "output": 15.0, "cache_write": 0.0, "cache_read": 0.0},
}


# ============================================================
# Data Types
# ============================================================

@dataclass
class ModelUsage:
    """Token usage for a single model call."""
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_tokens: int = 0
    cache_read_tokens: int = 0
    duration_ms: int = 0
    web_search_requests: int = 0


@dataclass
class CostEntry:
    """A single cost record."""
    id: str
    session_id: str
    model: str
    usage: ModelUsage
    cost_usd: float
    timestamp: str
    workflow_instance_id: Optional[str] = None
    step_id: Optional[str] = None
    agent_id: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CostSummary:
    """Aggregated cost summary."""
    total_cost_usd: float = 0.0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cache_creation_tokens: int = 0
    total_cache_read_tokens: int = 0
    total_duration_ms: int = 0
    total_api_calls: int = 0
    by_model: dict[str, dict[str, Any]] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_cost_usd": round(self.total_cost_usd, 6),
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_cache_creation_tokens": self.total_cache_creation_tokens,
            "total_cache_read_tokens": self.total_cache_read_tokens,
            "total_duration_ms": self.total_duration_ms,
            "total_api_calls": self.total_api_calls,
            "by_model": self.by_model,
        }


@dataclass
class BudgetAlert:
    """Budget alert when cost exceeds threshold."""
    alert_type: str  # warning, critical, exceeded
    current_cost: float
    budget_limit: float
    ratio: float
    message: str


# ============================================================
# CostTracker
# ============================================================

class CostTracker:
    """
    Fine-grained cost tracking for OpenClaw v3.

    Responsibilities:
    1. Track token usage per model, session, workflow
    2. Calculate USD cost based on model pricing
    3. Enforce budget limits with alerts
    4. Provide cost summaries and analytics
    5. Persist cost records to database

    Design follows Claude Code's cost-tracker.ts:
    - Per-model usage aggregation
    - USD cost calculation with cache pricing
    - Total cost accumulation across sessions
    - Budget enforcement with configurable thresholds
    """

    def __init__(
        self,
        db: Optional[Session] = None,
        budget_limit_usd: Optional[float] = None,
        warning_threshold: float = 0.80,
        critical_threshold: float = 0.95,
    ):
        self._db = db
        self._budget_limit = budget_limit_usd
        self._warning_threshold = warning_threshold
        self._critical_threshold = critical_threshold

        # In-memory accumulation (for sessions without DB)
        self._entries: list[CostEntry] = []
        self._session_costs: dict[str, float] = {}
        self._workflow_costs: dict[str, float] = {}
        self._grand_total_cost_usd: float = 0.0

    # ── Cost Recording ─────────────────────────────────────

    def record_usage(
        self,
        session_id: str,
        usage: ModelUsage,
        workflow_instance_id: Optional[str] = None,
        step_id: Optional[str] = None,
        agent_id: Optional[str] = None,
    ) -> CostEntry:
        """
        Record a model usage and calculate cost.

        Args:
            session_id: Session ID
            usage: Model usage data
            workflow_instance_id: Optional workflow instance ID
            step_id: Optional step ID
            agent_id: Optional agent ID

        Returns:
            CostEntry with calculated cost
        """
        cost_usd = self.calculate_cost(usage)
        now = datetime.now(timezone.utc).isoformat()

        entry = CostEntry(
            id=f"cost-{uuid4().hex[:12]}",
            session_id=session_id,
            model=usage.model,
            usage=usage,
            cost_usd=cost_usd,
            timestamp=now,
            workflow_instance_id=workflow_instance_id,
            step_id=step_id,
            agent_id=agent_id,
        )

        # In-memory tracking
        self._entries.append(entry)
        self._grand_total_cost_usd += cost_usd
        if len(self._entries) > _MAX_IN_MEMORY_ENTRIES:
            overflow = len(self._entries) - _MAX_IN_MEMORY_ENTRIES
            del self._entries[:overflow]

        self._session_costs[session_id] = self._session_costs.get(session_id, 0) + cost_usd
        if workflow_instance_id:
            self._workflow_costs[workflow_instance_id] = (
                self._workflow_costs.get(workflow_instance_id, 0) + cost_usd
            )

        # Persist to database
        if self._db:
            self._persist_entry(entry)

        # Check budget alerts
        alert = self.check_budget(session_id, workflow_instance_id)
        if alert:
            logger.warning(f"Budget alert: {alert.message}")

        return entry

    def calculate_cost(self, usage: ModelUsage) -> float:
        """
        Calculate USD cost for a model usage.

        Includes input, output, cache creation, and cache read costs.

        Reference: Claude Code src/utils/modelCost.ts
        """
        pricing = self._get_pricing(usage.model)

        input_cost = (usage.input_tokens / 1_000_000) * pricing["input"]
        output_cost = (usage.output_tokens / 1_000_000) * pricing["output"]
        cache_write_cost = (usage.cache_creation_tokens / 1_000_000) * pricing.get("cache_write", 0)
        cache_read_cost = (usage.cache_read_tokens / 1_000_000) * pricing.get("cache_read", 0)

        total = input_cost + output_cost + cache_write_cost + cache_read_cost
        return round(total, 8)

    def estimate_cost(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> float:
        """
        Estimate cost for a given token usage (pre-flight).

        Useful for budget checks before making API calls.
        """
        pricing = self._get_pricing(model)
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        return round(input_cost + output_cost, 6)

    # ── Budget Enforcement ─────────────────────────────────

    def check_budget(
        self,
        session_id: Optional[str] = None,
        workflow_instance_id: Optional[str] = None,
    ) -> Optional[BudgetAlert]:
        """
        Check if cost is approaching or exceeding budget.

        Returns None if within budget, or a BudgetAlert if threshold exceeded.
        """
        if not self._budget_limit or self._budget_limit <= 0:
            return None

        current_cost = self.get_total_cost(session_id, workflow_instance_id)
        ratio = current_cost / self._budget_limit

        if ratio >= 1.0:
            return BudgetAlert(
                alert_type="exceeded",
                current_cost=current_cost,
                budget_limit=self._budget_limit,
                ratio=ratio,
                message=f"Budget EXCEEDED: ${current_cost:.4f} / ${self._budget_limit:.2f}",
            )
        elif ratio >= self._critical_threshold:
            return BudgetAlert(
                alert_type="critical",
                current_cost=current_cost,
                budget_limit=self._budget_limit,
                ratio=ratio,
                message=f"Budget CRITICAL: ${current_cost:.4f} / ${self._budget_limit:.2f} ({ratio:.0%})",
            )
        elif ratio >= self._warning_threshold:
            return BudgetAlert(
                alert_type="warning",
                current_cost=current_cost,
                budget_limit=self._budget_limit,
                ratio=ratio,
                message=f"Budget warning: ${current_cost:.4f} / ${self._budget_limit:.2f} ({ratio:.0%})",
            )

        return None

    def is_within_budget(
        self,
        session_id: Optional[str] = None,
        workflow_instance_id: Optional[str] = None,
    ) -> bool:
        """Check if current cost is within budget."""
        if not self._budget_limit or self._budget_limit <= 0:
            return True
        current = self.get_total_cost(session_id, workflow_instance_id)
        return current < self._budget_limit

    # ── Cost Queries ───────────────────────────────────────

    def get_total_cost(
        self,
        session_id: Optional[str] = None,
        workflow_instance_id: Optional[str] = None,
    ) -> float:
        """Get total cost, optionally filtered by session or workflow."""
        if session_id:
            return self._session_costs.get(session_id, 0.0)
        if workflow_instance_id:
            return self._workflow_costs.get(workflow_instance_id, 0.0)
        return self._grand_total_cost_usd

    def get_session_summary(self, session_id: str) -> CostSummary:
        """Get cost summary for a session."""
        entries = [e for e in self._entries if e.session_id == session_id]
        return self._compute_summary(entries)

    def get_workflow_summary(self, workflow_instance_id: str) -> CostSummary:
        """Get cost summary for a workflow instance."""
        entries = [e for e in self._entries if e.workflow_instance_id == workflow_instance_id]
        return self._compute_summary(entries)

    def get_full_summary(self) -> CostSummary:
        """Get full cost summary across all sessions."""
        return self._compute_summary(self._entries)

    def get_model_usage(self, model: str) -> CostSummary:
        """Get cost summary for a specific model."""
        entries = [e for e in self._entries if e.model == model]
        return self._compute_summary(entries)

    # ── Reset & State ──────────────────────────────────────

    def reset(self) -> None:
        """Reset all in-memory cost tracking."""
        self._entries.clear()
        self._session_costs.clear()
        self._workflow_costs.clear()
        self._grand_total_cost_usd = 0.0

    def get_state(self) -> dict[str, Any]:
        """Get serializable state for persistence/restoration."""
        return {
            "entries_count": len(self._entries),
            "total_cost": self.get_total_cost(),
            "session_costs": dict(self._session_costs),
            "workflow_costs": dict(self._workflow_costs),
            "budget_limit": self._budget_limit,
        }

    # ── Private Helpers ────────────────────────────────────

    def _compute_summary(self, entries: list[CostEntry]) -> CostSummary:
        """Compute a CostSummary from a list of entries."""
        summary = CostSummary(total_api_calls=len(entries))
        by_model: dict[str, dict[str, Any]] = {}

        for entry in entries:
            u = entry.usage
            summary.total_cost_usd += entry.cost_usd
            summary.total_input_tokens += u.input_tokens
            summary.total_output_tokens += u.output_tokens
            summary.total_cache_creation_tokens += u.cache_creation_tokens
            summary.total_cache_read_tokens += u.cache_read_tokens
            summary.total_duration_ms += u.duration_ms

            if u.model not in by_model:
                by_model[u.model] = {
                    "cost_usd": 0.0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "api_calls": 0,
                }
            by_model[u.model]["cost_usd"] += entry.cost_usd
            by_model[u.model]["input_tokens"] += u.input_tokens
            by_model[u.model]["output_tokens"] += u.output_tokens
            by_model[u.model]["api_calls"] += 1

        summary.by_model = by_model
        summary.total_cost_usd = round(summary.total_cost_usd, 6)
        return summary

    @staticmethod
    def _get_pricing(model: str) -> dict[str, float]:
        """Get pricing for a model."""
        model_lower = model.lower()
        for key, pricing in MODEL_PRICING.items():
            if key in model_lower:
                return pricing
        return MODEL_PRICING["default"]

    def _persist_entry(self, entry: CostEntry) -> None:
        """Persist a cost entry to the database."""
        if not self._db:
            return
        try:
            import json as _json
            record = CostRecord(
                id=entry.id,
                workflow_instance_id=entry.workflow_instance_id,
                step_execution_id=entry.step_id,
                agent_id=entry.agent_id,
                model=entry.model,
                input_tokens=entry.usage.input_tokens,
                output_tokens=entry.usage.output_tokens,
                cache_creation_tokens=entry.usage.cache_creation_tokens,
                cache_read_tokens=entry.usage.cache_read_tokens,
                total_tokens=entry.usage.input_tokens + entry.usage.output_tokens,
                cost_usd=entry.cost_usd,
                duration_ms=entry.usage.duration_ms,
                api_call_type="message",
                metadata_json=_json.dumps(entry.metadata) if entry.metadata else None,
            )
            self._db.add(record)
            self._db.commit()
        except Exception as e:
            logger.error(f"Failed to persist cost entry: {e}")
            self._db.rollback()
