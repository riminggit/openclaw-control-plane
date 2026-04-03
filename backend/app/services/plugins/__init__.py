"""
Plugin System — Phase 3 P3-4/P3-5/P3-6

Provides a plugin management framework for extending agent capabilities.
Plugins can register skills, tools, and hooks into the orchestration system.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5
"""

from app.services.plugins.plugin_manager import (
    PluginManager,
    PluginInfo,
    PluginState,
)

__all__ = [
    "PluginManager",
    "PluginInfo",
    "PluginState",
    "get_plugin_manager",
]

# Singleton instance (stateless — all methods accept db: Session)
_plugin_manager: PluginManager | None = None


def get_plugin_manager() -> PluginManager:
    """Get or create the singleton PluginManager (stateless)."""
    global _plugin_manager
    if _plugin_manager is None:
        _plugin_manager = PluginManager()
    return _plugin_manager
