"""
Remote Trigger Service — Phase 3 P3-10/P3-11

Provides webhook and remote trigger capabilities for workflow automation.
Supports incoming webhooks, API callbacks, and event-driven triggers.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5
"""

from app.services.triggers.remote_trigger_service import (
    RemoteTriggerService,
    TriggerConfigDTO,
    TriggerEventDTO,
    TriggerState,
    TriggerType,
)

# Backward-compatible aliases (original class names)
TriggerConfig = TriggerConfigDTO
TriggerEvent = TriggerEventDTO

__all__ = [
    "RemoteTriggerService",
    "TriggerConfig",
    "TriggerConfigDTO",
    "TriggerEvent",
    "TriggerEventDTO",
    "TriggerState",
    "TriggerType",
    "get_trigger_service",
]

# Singleton instance (stateless — all methods accept db: Session)
_trigger_service: RemoteTriggerService | None = None


def get_trigger_service() -> RemoteTriggerService:
    """Get or create the singleton RemoteTriggerService (stateless)."""
    global _trigger_service
    if _trigger_service is None:
        _trigger_service = RemoteTriggerService()
    return _trigger_service
