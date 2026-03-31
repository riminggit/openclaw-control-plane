"""Channel management API."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/channels", tags=["channels"])

CONFIG_PATH = Path.home() / ".openclaw" / "openclaw.json"


def _load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise HTTPException(status_code=503, detail="openclaw.json not found")
    return json.loads(CONFIG_PATH.read_text())


@router.get("/list")
def list_channels():
    """List all channel configurations."""
    cfg = _load_config()
    channels = cfg.get("channels", {})
    plugins = cfg.get("plugins", {}).get("entries", {})
    result = []
    for ch_type, ch_conf in channels.items():
        entry = plugins.get(ch_type, {})
        result.append({
            "type": ch_type,
            "enabled": ch_conf.get("enabled", False),
            "config": {k: v for k, v in ch_conf.items() if k not in ("appSecret", "apiKeys")},
            "plugin_loaded": bool(entry),
        })
    return {"channels": result, "total": len(result)}


@router.get("/status")
def channels_status():
    """Get connection status for all channels."""
    cfg = _load_config()
    channels = cfg.get("channels", {})
    result = []
    for ch_type, ch_conf in channels.items():
        enabled = ch_conf.get("enabled", False)
        # Basic heuristic: enabled=True → "connected", else "disconnected"
        # A real implementation would ping the channel
        result.append({
            "type": ch_type,
            "enabled": enabled,
            "status": "connected" if enabled else "disconnected",
        })
    return {"channels": result}


@router.get("/{channel_type}")
def get_channel(channel_type: str):
    """Get a specific channel's configuration."""
    cfg = _load_config()
    channels = cfg.get("channels", {})
    if channel_type not in channels:
        raise HTTPException(status_code=404, detail=f"Channel '{channel_type}' not found")
    ch = channels[channel_type]
    return {
        "type": channel_type,
        "enabled": ch.get("enabled", False),
        "config": {k: v for k, v in ch.items() if k not in ("appSecret", "apiKeys")},
    }


@router.patch("/{channel_type}")
def update_channel(channel_type: str, payload: dict[str, Any]):
    """Update a channel's configuration."""
    cfg = _load_config()
    channels = cfg.get("channels", {})
    if channel_type not in channels:
        raise HTTPException(status_code=404, detail=f"Channel '{channel_type}' not found")
    channels[channel_type].update(payload)
    cfg["channels"] = channels
    # Backup and save
    import shutil
    shutil.copy2(CONFIG_PATH, CONFIG_PATH.with_suffix(".json.bak"))
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2, ensure_ascii=False))
    return {"ok": True, "channel": channel_type}


@router.post("/{channel_type}/test")
def test_channel(channel_type: str):
    """Test a channel connection (placeholder — returns config check)."""
    cfg = _load_config()
    channels = cfg.get("channels", {})
    if channel_type not in channels:
        raise HTTPException(status_code=404, detail=f"Channel '{channel_type}' not found")
    ch = channels[channel_type]
    enabled = ch.get("enabled", False)
    has_required = bool(ch.get("appId") or ch.get("apiKeys") or ch.get("token"))
    return {
        "ok": enabled and has_required,
        "channel": channel_type,
        "enabled": enabled,
        "has_credentials": has_required,
        "message": "Config check passed" if (enabled and has_required) else "Channel disabled or missing credentials",
    }
