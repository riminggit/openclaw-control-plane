"""Phase 5: Usage statistics API — summary, top sessions, by-model."""

import time
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/usage")


def _get_sessions(days: int = 7) -> list[dict]:
    """Fetch sessions from Gateway REST API."""
    try:
        import urllib.request
        req = urllib.request.Request("http://localhost:8000/api/gateway/sessions")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        return data.get("sessions", [])
    except Exception:
        return []

import json


# ── Endpoints ──

@router.get("/summary")
def usage_summary(days: int = Query(7, ge=1, le=90)):
    cutoff_ms = (time.time() - days * 86400) * 1000
    sessions = _get_sessions(days)
    total_tokens = 0
    total_sessions = 0
    peak_tokens = 0
    peak_session = None

    for s in sessions:
        ts = s.get("updatedAt") or s.get("startedAt") or 0
        if ts < cutoff_ms:
            continue
        tokens = s.get("totalTokens", 0) or 0
        total_tokens += tokens
        total_sessions += 1
        if tokens > peak_tokens:
            peak_tokens = tokens
            peak_session = s.get("sessionId", s.get("key", "unknown"))

    return {
        "period_days": days,
        "total_tokens": total_tokens,
        "total_sessions": total_sessions,
        "avg_tokens_per_session": round(total_tokens / max(total_sessions, 1)),
        "peak_session_tokens": peak_tokens,
        "peak_session_id": peak_session,
    }


@router.get("/sessions")
def top_sessions(days: int = Query(7, ge=1, le=90), limit: int = Query(20, ge=1, le=100)):
    cutoff_ms = (time.time() - days * 86400) * 1000
    sessions = _get_sessions(days)

    ranked = []
    for s in sessions:
        ts = s.get("updatedAt") or s.get("startedAt") or 0
        if ts < cutoff_ms:
            continue
        tokens = s.get("totalTokens", 0) or 0
        # Parse agent name from key: "agent:main:主会话" → "main"
        key = s.get("key", "")
        agent = key.split(":")[1] if ":" in key else key
        ranked.append({
            "session_id": s.get("sessionId", ""),
            "agent": agent,
            "model": s.get("model", ""),
            "tokens": tokens,
            "created_at": datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat() if ts else "",
            "status": s.get("status", "unknown"),
        })

    ranked.sort(key=lambda x: x["tokens"], reverse=True)
    return {"sessions": ranked[:limit], "total": len(ranked)}


@router.get("/by-model")
def usage_by_model(days: int = Query(7, ge=1, le=90)):
    cutoff_ms = (time.time() - days * 86400) * 1000
    sessions = _get_sessions(days)

    by_model = defaultdict(lambda: {"tokens": 0, "sessions": 0})
    for s in sessions:
        ts = s.get("updatedAt") or s.get("startedAt") or 0
        if ts < cutoff_ms:
            continue
        model = s.get("model", "unknown")
        tokens = s.get("totalTokens", 0) or 0
        by_model[model]["tokens"] += tokens
        by_model[model]["sessions"] += 1

    result = [{"model": k, **v} for k, v in by_model.items()]
    result.sort(key=lambda x: x["tokens"], reverse=True)
    return {"models": result, "period_days": days}


@router.get("")
def usage_root(days: int = Query(7, ge=1, le=90)):
    """Root endpoint - returns usage summary."""
    return usage_summary(days)
