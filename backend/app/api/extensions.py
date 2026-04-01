"""Extensions management API — plugins list, status, toggle, tunnel status."""

import json, subprocess
from pathlib import Path
from pydantic import BaseModel
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
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n")


class ToggleBody(BaseModel):
    enabled: bool


@router.get("")
def list_extensions():
    """GET /api/extensions — return list of installed extensions."""
    cfg = _read_config()
    entries = cfg.get("plugins", {}).get("entries", {})
    result = []
    for name, config in entries.items():
        is_enabled = not config.get("disabled", False)
        result.append({
            "id": name,
            "name": name,
            "description": config.get("description", ""),
            "version": config.get("version", "0.0.0"),
            "enabled": is_enabled,
            "type": config.get("type", "plugin"),
        })
    return result


@router.get("/tunnel")
def get_tunnel():
    """GET /api/extensions/tunnel — check CFTunnel status."""
    result = {
        "status": "disconnected",
        "url": "",
        "bytesIn": 0,
        "bytesOut": 0,
        "available": False,
        "running": False,
    }
    try:
        r = subprocess.run(["which", "cftunnel"], capture_output=True, text=True, timeout=5)
        if r.returncode != 0:
            return result
        result["available"] = True
        r2 = subprocess.run(["pgrep", "-f", "cftunnel"], capture_output=True, text=True, timeout=5)
        result["running"] = bool(r2.stdout.strip())
        if result["running"]:
            result["status"] = "connected"
    except Exception:
        pass
    return result


@router.patch("/{ext_id}")
def toggle_extension(ext_id: str, body: ToggleBody):
    """PATCH /api/extensions/:id — enable/disable an extension."""
    cfg = _read_config()
    entries = cfg.get("plugins", {}).get("entries", {})
    if ext_id not in entries:
        raise HTTPException(404, f"Extension '{ext_id}' not found")
    entries[ext_id]["disabled"] = not body.enabled
    cfg.setdefault("plugins", {})["entries"] = entries
    _write_config(cfg)
    return {"ok": True, "id": ext_id, "enabled": body.enabled}
