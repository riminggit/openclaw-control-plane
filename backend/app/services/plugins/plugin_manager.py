"""
PluginManager — Plugin lifecycle management for OpenClaw v3.

Supports plugin discovery, loading, unloading, and sandboxed execution.
Plugins can provide skills, tools, and event hooks to extend the platform.

All data is persisted to SQLite via PluginRecord DB model.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5 P3-4
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.phase3 import PluginRecord


logger = logging.getLogger(__name__)


class PluginState(str, Enum):
    """Plugin lifecycle state."""
    DISCOVERED = "discovered"
    LOADING = "loading"
    LOADED = "loaded"
    ACTIVE = "active"
    ERROR = "error"
    UNLOADED = "unloaded"


@dataclass
class PluginInfo:
    """Metadata and state for a registered plugin."""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    version: str = "0.1.0"
    description: str = ""
    author: str = ""
    homepage: str = ""
    entry_point: str = ""  # Python module path or file path
    state: PluginState = PluginState.DISCOVERED
    skills: list[str] = field(default_factory=list)  # Skill IDs provided
    tools: list[str] = field(default_factory=list)  # Tool IDs provided
    hooks: list[str] = field(default_factory=list)  # Event hooks subscribed
    config: dict[str, Any] = field(default_factory=dict)
    error_message: str = ""
    loaded_at: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


# ── DB Record → Dataclass DTO helper ──────────────────────────

def _record_to_plugin(rec: PluginRecord) -> PluginInfo:
    """Convert a PluginRecord to a PluginInfo DTO."""
    return PluginInfo(
        id=rec.id,
        name=rec.name,
        version=rec.version,
        description=rec.description or "",
        author=rec.author or "",
        homepage=rec.homepage or "",
        entry_point=rec.entry_point or "",
        state=PluginState(rec.state),
        skills=rec.skills or [],
        tools=rec.tools or [],
        hooks=rec.hooks or [],
        config=rec.config or {},
        error_message=rec.error_message or "",
        loaded_at=rec.loaded_at,
        metadata={},
    )


class PluginManager:
    """
    Manages plugin lifecycle: discovery, loading, unloading, and execution.

    All data is persisted to the database via SQLAlchemy Session.
    The service is stateless and safe to use as a singleton.
    """

    async def discover_plugins(self, db: Session, plugin_dir: str = "") -> list[PluginInfo]:
        """
        Scan for available plugins.

        Phase 3 skeleton — returns empty list.
        Full implementation will scan directories for plugin manifests.
        """
        logger.info("Discovering plugins in %s", plugin_dir or "default paths")
        # TODO: Phase 3 — scan plugin directories for manifest files
        return []

    async def load_plugin(self, db: Session, plugin_id: str) -> PluginInfo:
        """
        Load a plugin and register its capabilities.

        Updates the DB record state to LOADED.
        """
        rec = db.query(PluginRecord).filter(PluginRecord.id == plugin_id).first()
        if not rec:
            raise ValueError(f"Plugin {plugin_id} not found")

        rec.state = PluginState.LOADING.value
        db.commit()

        try:
            # TODO: Phase 3 — real plugin loading with sandbox
            rec.state = PluginState.LOADED.value
            rec.loaded_at = datetime.now(timezone.utc).isoformat()
            logger.info("Plugin %s loaded successfully", rec.name)
        except Exception as e:
            rec.state = PluginState.ERROR.value
            rec.error_message = str(e)
            logger.error("Failed to load plugin %s: %s", rec.name, e)

        db.commit()
        db.refresh(rec)
        return _record_to_plugin(rec)

    async def activate_plugin(self, db: Session, plugin_id: str) -> PluginInfo:
        """Activate a loaded plugin."""
        rec = db.query(PluginRecord).filter(PluginRecord.id == plugin_id).first()
        if not rec:
            raise ValueError(f"Plugin {plugin_id} not found")
        current_state = PluginState(rec.state)
        if current_state not in (PluginState.LOADED, PluginState.ACTIVE):
            raise RuntimeError(f"Plugin {plugin_id} must be loaded first (current: {current_state})")

        # TODO: Phase 3 — register skills with SkillRegistry
        rec.state = PluginState.ACTIVE.value
        db.commit()
        db.refresh(rec)
        logger.info("Plugin %s activated", rec.name)
        return _record_to_plugin(rec)

    async def deactivate_plugin(self, db: Session, plugin_id: str) -> PluginInfo:
        """Deactivate an active plugin."""
        rec = db.query(PluginRecord).filter(PluginRecord.id == plugin_id).first()
        if not rec:
            raise ValueError(f"Plugin {plugin_id} not found")

        # TODO: Phase 3 — unregister skills from SkillRegistry
        rec.state = PluginState.LOADED.value
        db.commit()
        db.refresh(rec)
        logger.info("Plugin %s deactivated", rec.name)
        return _record_to_plugin(rec)

    async def unload_plugin(self, db: Session, plugin_id: str) -> PluginInfo:
        """Unload a plugin and clean up resources."""
        rec = db.query(PluginRecord).filter(PluginRecord.id == plugin_id).first()
        if not rec:
            raise ValueError(f"Plugin {plugin_id} not found")

        rec.state = PluginState.UNLOADED.value
        rec.loaded_at = None
        db.commit()
        db.refresh(rec)
        logger.info("Plugin %s unloaded", rec.name)
        return _record_to_plugin(rec)

    async def register_plugin(self, db: Session, info: dict[str, Any]) -> PluginInfo:
        """Register a new plugin from metadata."""
        rec = PluginRecord(
            name=info.get("name", "Unnamed Plugin"),
            version=info.get("version", "0.1.0"),
            description=info.get("description", ""),
            author=info.get("author", ""),
            homepage=info.get("homepage", ""),
            entry_point=info.get("entry_point", ""),
            state=PluginState.DISCOVERED.value,
            skills=info.get("skills", []),
            tools=info.get("tools", []),
            hooks=info.get("hooks", []),
            config=info.get("config", {}),
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        logger.info("Registered plugin %s (id=%s)", rec.name, rec.id)
        return _record_to_plugin(rec)

    async def remove_plugin(self, db: Session, plugin_id: str) -> bool:
        """Remove a plugin entirely."""
        rec = db.query(PluginRecord).filter(PluginRecord.id == plugin_id).first()
        if not rec:
            return False
        db.delete(rec)
        db.commit()
        logger.info("Removed plugin %s", plugin_id)
        return True

    async def get_plugin(self, db: Session, plugin_id: str) -> PluginInfo | None:
        """Get plugin info by ID."""
        rec = db.query(PluginRecord).filter(PluginRecord.id == plugin_id).first()
        if not rec:
            return None
        return _record_to_plugin(rec)

    async def list_plugins(self, db: Session, state: PluginState | None = None) -> list[PluginInfo]:
        """List all plugins, optionally filtered by state."""
        q = db.query(PluginRecord)
        if state:
            q = q.filter(PluginRecord.state == state.value)
        return [_record_to_plugin(r) for r in q.all()]

    async def execute_hook(self, db: Session, hook_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Execute a hook across all active plugins.

        Phase 3 skeleton — returns empty results since there are no real sandboxes.
        """
        active_plugins = db.query(PluginRecord).filter(
            PluginRecord.state == PluginState.ACTIVE.value
        ).all()
        results: dict[str, Any] = {}
        for rec in active_plugins:
            # TODO: Phase 3 — real hook execution via sandbox
            results[rec.id] = {"status": "skipped", "message": "No sandbox available"}
        return results
