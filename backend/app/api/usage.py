"""Phase 5: Usage statistics API — summary, top sessions, by-model."""

import json, subprocess, time
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/usage")


def _get_sessions(days: int = 7) -> list[dict]:
    """Fetch sessions from gateway CLI."""
    try:
        r = subprocess.run(
            ["openclaw", "sessions", "list", "--json"],
            capture_output=True, text=True, timeout=10
        )
        if r.returncode == 0 and r.stdout.strip():
            data = json.loads(r.stdout)
            if isinstance(data, list):
                return data
            return data.get("sessions", [])
    except Exception:
        pass
    return []


# ── Endpoints ──

@router.get("/summary")
def usage_summary(days: int = Query(7, ge=1, le=90)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    sessions = _get_sessions(days)
    total_tokens = 0
    total_sessions = 0
    peak_tokens = 0
    peak_session = None

    for s in sessions:
        created = s.get("createdAt", "") or s.get("created_at", "")
        if created < cutoff:
            continue
        tokens = s.get("totalTokens", 0) or s.get("total_tokens", 0) or 0
        total_tokens += tokens
        total_sessions += 1
        if tokens > peak_tokens:
            peak_tokens = tokens
            peak_session = s.get("id", s.get("session_id", "unknown"))

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
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    sessions = _get_sessions(days)

    ranked = []
    for s in sessions:
        created = s.get("createdAt", "") or s.get("created_at", "")
        if created < cutoff:
            continue
        tokens = s.get("totalTokens", 0) or s.get("total_tokens", 0) or 0
        ranked.append({
            "session_id": s.get("id", s.get("session_id", "")),
            "agent": s.get("agent", s.get("label", "")),
            "model": s.get("model", ""),
            "tokens": tokens,
            "created_at": created,
            "status": s.get("status", ""),
        })

    ranked.sort(key=lambda x: x["tokens"], reverse=True)
    return {"sessions": ranked[:limit], "total": len(ranked)}


@router.get("/by-model")
def usage_by_model(days: int = Query(7, ge=1, le=90)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    sessions = _get_sessions(days)

    by_model = defaultdict(lambda: {"tokens": 0, "sessions": 0})
    for s in sessions:
        created = s.get("createdAt", "") or s.get("created_at", "")
        if created < cutoff:
            continue
        model = s.get("model", "unknown")
        tokens = s.get("totalTokens", 0) or s.get("total_tokens", 0) or 0
        by_model[model]["tokens"] += tokens
        by_model[model]["sessions"] += 1

    result = [{"model": k, **v} for k, v in by_model.items()]
    result.sort(key=lambda x: x["tokens"], reverse=True)
    return {"models": result, "period_days": days}
