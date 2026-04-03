"""
Contract Tests for OpenClaw v3 — Protocol Definitions.

Validates that all protocol definitions (StepKind, OrchestrationProfile,
RuntimeContractVersion, ToolContext) conform to expected constraints.

Reference: docs/requirements/openclaw-v3/08-migration-strategy.md §8.6
"""

import pytest

from app.services.orchestration.protocols import (
    StepKind,
    OrchestrationProfile,
    RuntimeContractVersion,
    ToolContext,
    IdempotencyKey,
    OrchestrationEventType,
    OrchestrationEvent,
)


# ============================================================
# StepKind Contract Tests
# ============================================================

class TestStepKindContract:
    """Ensure StepKind enumeration is stable and backward compatible."""

    def test_stepkind_has_all_required_values(self):
        """All documented StepKind values must exist."""
        expected = {
            "agent_session", "human_gate", "tool_only", "command",
            "planner", "subworkflow", "wait_event", "coordinator",
            "verification",
        }
        actual = {sk.value for sk in StepKind}
        assert expected == actual, f"Missing StepKind values: {expected - actual}"

    def test_stepkind_is_string_enum(self):
        """StepKind values must be strings for JSON serialization."""
        for sk in StepKind:
            assert isinstance(sk.value, str)

    def test_stepkind_legacy_values_unchanged(self):
        """Legacy StepKind values must never change."""
        assert StepKind.AGENT_SESSION.value == "agent_session"
        assert StepKind.HUMAN_GATE.value == "human_gate"


# ============================================================
# OrchestrationProfile Contract Tests
# ============================================================

class TestOrchestrationProfileContract:
    """Ensure OrchestrationProfile enumeration is stable."""

    def test_profile_has_all_required_values(self):
        expected = {"static-dag-v1", "static-dag-v2", "plan-subtask-v2", "coordinator-v2"}
        actual = {p.value for p in OrchestrationProfile}
        assert expected == actual

    def test_legacy_profile_unchanged(self):
        """Legacy profile must never change."""
        assert OrchestrationProfile.STATIC_DAG_V1.value == "static-dag-v1"


# ============================================================
# RuntimeContractVersion Contract Tests
# ============================================================

class TestRuntimeContractVersionContract:
    """Ensure RuntimeContractVersion enumeration is stable."""

    def test_contract_versions_exist(self):
        expected = {"v1", "v2"}
        actual = {v.value for v in RuntimeContractVersion}
        assert expected == actual

    def test_legacy_contract_unchanged(self):
        assert RuntimeContractVersion.V1.value == "v1"


# ============================================================
# ToolContext Contract Tests
# ============================================================

class TestToolContextContract:
    """Ensure ToolContext behavior matches security requirements."""

    def test_default_deny(self):
        """Empty allowlist must deny all tools (default-deny)."""
        ctx = ToolContext(
            tenant_id="t1",
            workflow_id="w1",
            step_id="s1",
            actor="agent-1",
        )
        assert not ctx.is_tool_allowed("any_tool")

    def test_allowlist_allows(self):
        ctx = ToolContext(
            tenant_id="t1",
            workflow_id="w1",
            step_id="s1",
            actor="agent-1",
            allowlist=["tool_a", "tool_b"],
        )
        assert ctx.is_tool_allowed("tool_a")
        assert ctx.is_tool_allowed("tool_b")

    def test_denylist_overrides_allowlist(self):
        ctx = ToolContext(
            tenant_id="t1",
            workflow_id="w1",
            step_id="s1",
            actor="agent-1",
            allowlist=["tool_a", "tool_b"],
            denylist=["tool_a"],
        )
        assert not ctx.is_tool_allowed("tool_a")
        assert ctx.is_tool_allowed("tool_b")

    def test_denylist_denies_even_without_allowlist(self):
        ctx = ToolContext(
            tenant_id="t1",
            workflow_id="w1",
            step_id="s1",
            actor="agent-1",
            denylist=["tool_a"],
        )
        assert not ctx.is_tool_allowed("tool_a")

    def test_serialization_roundtrip(self):
        ctx = ToolContext(
            tenant_id="t1",
            workflow_id="w1",
            step_id="s1",
            actor="agent-1",
            allowlist=["tool_a"],
            denylist=["tool_b"],
            mcp_servers=["mcp-1"],
            max_cost_usd=10.0,
            max_tokens=5000,
        )
        serialized = ctx.to_dict()
        restored = ToolContext.from_dict(serialized)
        assert restored.tenant_id == ctx.tenant_id
        assert restored.allowlist == ctx.allowlist
        assert restored.denylist == ctx.denylist
        assert restored.max_cost_usd == ctx.max_cost_usd


# ============================================================
# IdempotencyKey Contract Tests
# ============================================================

class TestIdempotencyKeyContract:
    def test_key_format(self):
        key = IdempotencyKey(
            workflow_instance_id="wi-1",
            step_id="step-1",
            attempt=0,
        )
        assert str(key) == "wi-1:step-1:0"


# ============================================================
# OrchestrationEvent Contract Tests
# ============================================================

class TestOrchestrationEventContract:
    def test_event_type_values_are_dotted_strings(self):
        """All event type values must follow 'category.action' format."""
        for et in OrchestrationEventType:
            assert "." in et.value

    def test_legacy_event_types_unchanged(self):
        """Core event types must never change."""
        assert OrchestrationEventType.INSTANCE_STARTED.value == "instance.started"
        assert OrchestrationEventType.STEP_COMPLETED.value == "step.completed"

    def test_event_has_schema_version(self):
        event = OrchestrationEvent(
            event_type=OrchestrationEventType.INSTANCE_STARTED,
            payload={},
        )
        assert event.schema_version == "1"
