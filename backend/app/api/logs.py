"""Gateway log viewer API."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/logs", tags=["logs"])

LOG_DIR = Path.home() / ".openclaw" / "logs"
FALLBACK_LOG = Path("/tmp/ocp-backend.log")

KNOWN_SOURCES = {
    "gateway": "Gateway stdout log",
    "gateway-err": "Gateway stderr log",
    "backend": "OCP backend log",
}


def _resolve_log_path(source: str) -> Path | None:
    """Resolve a log source name to an actual file path."""
    mapping = {
        "gateway": LOG_DIR / "gateway.log",
        "gateway-err": LOG_DIR / "gateway.err.log",
        "backend": FALLBACK_LOG,
    }
    p = mapping.get(source)
    if p and p.exists():
        return p
    # Try case variants
    if source == "gateway":
        for name in ("gateway.log", "gateway_out.log", "gateway-stdout.log"):
            p = LOG_DIR / name
            if p.exists():
                return p
    elif source == "gateway-err":
        for name in ("gateway.err.log", "gateway_err.log", "gateway-stderr.log"):
            p = LOG_DIR / name
            if p.exists():
                return p
    return None


@router.get("/sources")
def list_sources():
    """List available log sources."""
    available = []
    for src, desc in KNOWN_SOURCES.items():
        p = _resolve_log_path(src)
        available.append({
            "id": src,
            "description": desc,
            "available": p is not None,
            "path": str(p) if p else None,
            "size_kb": round(p.stat().st_size / 1024, 1) if p else 0,
        })
    return {"sources": available}


@router.get("/tail")
def tail_logs(
    source: str = Query("gateway", description="Log source name"),
    lines: int = Query(200, ge=1, le=5000, description="Number of lines"),
):
    """Get the last N lines of a log file."""
    log_path = _resolve_log_path(source)
    if not log_path:
        # Return empty for unavailable sources
        return {"source": source, "lines": [], "total": 0, "message": f"Log source '{source}' not available"}
    try:
        result = subprocess.run(
            ["tail", "-n", str(lines), str(log_path)],
            capture_output=True, text=True, timeout=10,
        )
        output_lines = result.stdout.splitlines()
        return {
            "source": source,
            "path": str(log_path),
            "lines": output_lines,
            "total": len(output_lines),
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Log read timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
def search_logs(
    q: str = Query(..., min_length=1, description="Search keyword"),
    source: str = Query("gateway", description="Log source name"),
    lines: int = Query(200, ge=1, le=5000, description="Max results"),
):
    """Search logs for a keyword using grep."""
    log_path = _resolve_log_path(source)
    if not log_path:
        return {"source": source, "query": q, "matches": [], "total": 0, "message": f"Log source '{source}' not available"}
    try:
        result = subprocess.run(
            ["grep", "-n", "--color=never", "-i", q, str(log_path)],
            capture_output=True, text=True, timeout=15,
        )
        all_matches = result.stdout.splitlines()
        # Return last N matches (most recent)
        matched = all_matches[-lines:]
        return {
            "source": source,
            "query": q,
            "matches": matched,
            "total": len(all_matches),
            "returned": len(matched),
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Log search timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
