"""Phase 5: Extensions management API — plugins list, status, toggle, tunnel status."""

import json, subprocess
from pathlib import Path
from fastapi import APIRouter, HTTPException

from app.api.services import OPENCLAW_HOME

router = APIRouter(prefix="/api/extensions")

CONFIG_PATH = OPENCLAW_HOME / "openclaw.json"


def _read_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text())
        except Exception:
            pass
    return {}


def _write_config(cfg: dict):
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n")


@router.get("/list")
def list_extensions():
    cfg = _read_config()
    plugins = cfg.get("plugins", {})
    entries = cfg.get("plugins", {}).get("entries", {})
    result = []
    for name, config in entries.items():
        is_enabled = not config.get("disabled", False)
        result.append({
            "id": name,
            "name": name,
            "enabled": is_enabled,
            "type": config.get("type", "unknown"),
            "config": {k: v for k, v in config.items() if k not in ("token", "secret", "password")},
        })
    return {"extensions": result, "total": len(result)}


@router.get("/{ext_id}/status")
def get_extension_status(ext_id: str):
    cfg = _read_config()
    entries = cfg.get("plugins", {}).get("entries", {})
    if ext_id not in entries:
        raise HTTPException(404, f"Extension '{ext_id}' not found")
    config = entries[ext_id]
    return {
        "id": ext_id,
        "enabled": not config.get("disabled", False),
        "type": config.get("type", "unknown"),
        "has_config": bool(config.get("config")),
    }


@router.post("/{ext_id}/toggle")
def toggle_extension(ext_id: str):
    cfg = _read_config()
    entries = cfg.get("plugins", {}).get("entries", {})
    if ext_id not in entries:
        raise HTTPException(404, f"Extension '{ext_id}' not found")
    currently_disabled = entries[ext_id].get("disabled", False)
    entries[ext_id]["disabled"] = not currently_disabled
    cfg.setdefault("plugins", {})["entries"] = entries
    _write_config(cfg)
    return {"ok": True, "id": ext_id, "enabled": currently_disabled, "message": f"Extension {'disabled' if currently_disabled else 'enabled'}"}


@router.get("/tunnel/status")
def get_tunnel_status():
    """Check CFTunnel status if available."""
    result = {"available": False, "running": False, "routes": []}
    try:
        r = subprocess.run(["which", "cftunnel"], capture_output=True, text=True, timeout=5)
        if r.returncode != 0:
            return result
        result["available"] = True
        # Check if running
        r2 = subprocess.run(["pgrep", "-f", "cftunnel"], capture_output=True, text=True, timeout=5)
        result["running"] = bool(r2.stdout.strip())
    except Exception:
        pass
    return result
