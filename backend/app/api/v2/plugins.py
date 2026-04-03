"""
Plugin Management API — Phase 3 P3-6

REST API endpoints for the PluginManager.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Any, Optional

from app.db import get_db
from app.services.plugins import get_plugin_manager, PluginState


router = APIRouter(prefix="/api/v2/plugins", tags=["v3", "plugins"])


# ── Request Schemas ─────────────────────────────────────────

class RegisterPluginRequest(BaseModel):
    name: str = Field(..., min_length=1)
    version: str = "0.1.0"
    description: str = ""
    author: str = ""
    homepage: str = ""
    entry_point: str = ""
    skills: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    hooks: list[str] = Field(default_factory=list)
    config: dict[str, Any] = Field(default_factory=dict)


# ── Endpoints ───────────────────────────────────────────────

@router.get("")
async def list_plugins(state: str = "", db: Session = Depends(get_db)):
    """List all plugins, optionally filtered by state."""
    svc = get_plugin_manager()
    filter_state = PluginState(state) if state else None
    plugins = await svc.list_plugins(db, state=filter_state)
    return {"plugins": [_plugin_to_dict(p) for p in plugins], "total": len(plugins)}


@router.post("")
async def register_plugin(req: RegisterPluginRequest, db: Session = Depends(get_db)):
    """Register a new plugin."""
    svc = get_plugin_manager()
    plugin = await svc.register_plugin(db, req.model_dump())
    return _plugin_to_dict(plugin)


@router.get("/discover")
async def discover_plugins(db: Session = Depends(get_db)):
    """Scan for available plugins."""
    svc = get_plugin_manager()
    plugins = await svc.discover_plugins(db)
    return {"plugins": [_plugin_to_dict(p) for p in plugins], "total": len(plugins)}


@router.get("/{plugin_id}")
async def get_plugin(plugin_id: str, db: Session = Depends(get_db)):
    """Get plugin info by ID."""
    svc = get_plugin_manager()
    plugin = await svc.get_plugin(db, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    return _plugin_to_dict(plugin)


@router.post("/{plugin_id}/load")
async def load_plugin(plugin_id: str, db: Session = Depends(get_db)):
    """Load a plugin."""
    svc = get_plugin_manager()
    try:
        plugin = await svc.load_plugin(db, plugin_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _plugin_to_dict(plugin)


@router.post("/{plugin_id}/activate")
async def activate_plugin(plugin_id: str, db: Session = Depends(get_db)):
    """Activate a loaded plugin."""
    svc = get_plugin_manager()
    try:
        plugin = await svc.activate_plugin(db, plugin_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return _plugin_to_dict(plugin)


@router.post("/{plugin_id}/deactivate")
async def deactivate_plugin(plugin_id: str, db: Session = Depends(get_db)):
    """Deactivate an active plugin."""
    svc = get_plugin_manager()
    try:
        plugin = await svc.deactivate_plugin(db, plugin_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _plugin_to_dict(plugin)


@router.post("/{plugin_id}/unload")
async def unload_plugin(plugin_id: str, db: Session = Depends(get_db)):
    """Unload a plugin."""
    svc = get_plugin_manager()
    try:
        plugin = await svc.unload_plugin(db, plugin_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _plugin_to_dict(plugin)


@router.delete("/{plugin_id}")
async def remove_plugin(plugin_id: str, db: Session = Depends(get_db)):
    """Remove a plugin entirely."""
    svc = get_plugin_manager()
    removed = await svc.remove_plugin(db, plugin_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Plugin not found")
    return {"ok": True}


def _plugin_to_dict(plugin: Any) -> dict:
    """Convert a PluginInfo to a JSON-serializable dict."""
    return {
        "id": plugin.id,
        "name": plugin.name,
        "version": plugin.version,
        "description": plugin.description,
        "author": plugin.author,
        "homepage": plugin.homepage,
        "entry_point": plugin.entry_point,
        "state": plugin.state.value if hasattr(plugin.state, 'value') else plugin.state,
        "skills": plugin.skills,
        "tools": plugin.tools,
        "hooks": plugin.hooks,
        "error_message": plugin.error_message,
        "loaded_at": plugin.loaded_at,
    }
