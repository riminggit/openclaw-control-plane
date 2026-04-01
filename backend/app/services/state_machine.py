"""Task state machine with enforced transitions and audit log."""

from datetime import datetime, timezone

# Valid statuses for the workflow engine
STATUSES = {
    "planned", "approved", "dispatched", "in_progress",
    "review_pending", "completed", "failed", "stopped", "cancelled",
}

# Transition matrix: current_status -> set of allowed next statuses
TRANSITIONS: dict[str, set[str]] = {
    "planned": {"approved", "cancelled"},
    "approved": {"dispatched", "rejected", "cancelled"},
    "rejected": {"planned", "cancelled"},  # rejected -> back to planned for rework
    "dispatched": {"in_progress", "failed", "cancelled"},
    "in_progress": {"review_pending", "completed", "failed", "stopped", "cancelled"},
    "review_pending": {"approved", "rejected", "cancelled"},  # re-review cycle
    "completed": set(),
    "failed": {"planned", "cancelled"},  # failed -> re-plan or cancel
    "stopped": {"dispatched", "cancelled"},  # stopped -> re-dispatch or cancel
    "cancelled": set(),
}

# Status groups
TERMINAL_STATUSES = {"completed", "cancelled"}
ACTIVE_STATUSES = {"approved", "dispatched", "in_progress", "review_pending"}


class StateTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    def __init__(self, current: str, target: str):
        allowed = TRANSITIONS.get(current, set())
        super().__init__(
            f"Invalid transition: '{current}' → '{target}'. "
            f"Allowed from '{current}': {sorted(allowed) if allowed else 'none (terminal state)'}"
        )


def validate_transition(current: str, target: str) -> bool:
    """Check if a state transition is valid. Raises StateTransitionError if not."""
    if current == target:
        return True  # no-op is fine
    allowed = TRANSITIONS.get(current)
    if allowed is None:
        raise StateTransitionError(current, target)
    if target not in allowed:
        raise StateTransitionError(current, target)
    return True


def log_transition(db_session, task_id: str, from_status: str, to_status: str,
                   actor: str = "system", reason: str = ""):
    """Record a state transition in the audit log."""
    from app.db import StateTransitionLog
    now = datetime.now(timezone.utc).isoformat()
    entry = StateTransitionLog(
        id=f"stl-{__import__('uuid').uuid4().hex[:12]}",
        task_id=task_id,
        from_status=from_status,
        to_status=to_status,
        actor=actor,
        reason=reason,
        created_at=now,
    )
    db_session.add(entry)
    return entry
