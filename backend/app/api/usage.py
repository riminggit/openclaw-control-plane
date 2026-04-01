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
            ["openclaw", "sessions", "--json"],
            capture_output=True, text=True, timeout=15
        )
        if r.returncode == 0 and r.stdout.strip():
            # CLI may output plugin logs to stdout after JSON — extract JSON only
            stdout = r.stdout.strip()
            # Find the end of the JSON object (matching braces)
            depth = 0
            end = 0
            for i, ch in enumerate(stdout):
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            if end > 0:
                data = json.loads(stdout[:end])
                if isinstance(data, list):
                    return data
                return data.get("sessions", [])
    except (json.JSONDecodeError, Exception):
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
        # CLI has updatedAt (epoch ms), no createdAt — use updatedAt as proxy
        ts = s.get("updatedAt", 0) or 0
        created_iso = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat() if ts else ""
        if created_iso and created_iso < cutoff:
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
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    sessions = _get_sessions(days)

    ranked = []
    for s in sessions:
        ts = s.get("updatedAt", 0) or 0
        created_iso = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat() if ts else ""
        if created_iso and created_iso < cutoff:
            continue
        tokens = s.get("totalTokens", 0) or 0
        ranked.append({
            "session_id": s.get("sessionId", ""),
            "agent": s.get("agentId", s.get("label", "")),
            "model": s.get("model", ""),
            "tokens": tokens,
            "created_at": created_iso,
            "status": "active" if ts and (time.time() * 1000 - ts) < 3600000 else "idle",
        })

    ranked.sort(key=lambda x: x["tokens"], reverse=True)
    return {"sessions": ranked[:limit], "total": len(ranked)}


@router.get("/by-model")
def usage_by_model(days: int = Query(7, ge=1, le=90)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    sessions = _get_sessions(days)

    by_model = defaultdict(lambda: {"tokens": 0, "sessions": 0})
    for s in sessions:
        ts = s.get("updatedAt", 0) or 0
        created_iso = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat() if ts else ""
        if created_iso and created_iso < cutoff:
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
