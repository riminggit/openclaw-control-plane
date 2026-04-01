"""Phase 4: Cost Analytics API."""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import httpx

from app.db import get_db, AgentTokenSnapshot, DailyCostSummary, BudgetAlert

router = APIRouter(prefix="/api/analytics/cost")

MODEL_PRICING = {
    "zhipu/GLM-5-Turbo": {"input": 0.5, "output": 0.5},
    "gpt-4o": {"input": 2.5, "output": 10.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.6},
    "claude-3.5-sonnet": {"input": 3.0, "output": 15.0},
    "claude-3-haiku": {"input": 0.25, "output": 1.25},
    "default": {"input": 1.0, "output": 3.0},
}


def _estimate_cost(tokens: int, model: str | None = None) -> float:
    pricing = MODEL_PRICING.get(model or "", MODEL_PRICING["default"])
    # Assume 50/50 input/output split if not specified
    return (tokens / 2 / 1_000_000) * pricing["input"] + (tokens / 2 / 1_000_000) * pricing["output"]


# ── Schemas ──

class BudgetCreate(BaseModel):
    name: str = Field(..., min_length=1)
    budget_type: str = Field("daily")
    budget_limit_usd: float = Field(..., gt=0)
    alert_threshold_pct: float = Field(80.0, ge=0, le=100)

class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    budget_type: Optional[str] = None
    budget_limit_usd: Optional[float] = None
    alert_threshold_pct: Optional[float] = None
    is_active: Optional[bool] = None


# ── Summary ──

@router.get("")
def cost_root(db: Session = Depends(get_db)):
    """Return cost analytics overview (same as /summary)."""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    rows = db.query(func.sum(DailyCostSummary.total_tokens), func.sum(DailyCostSummary.estimated_cost_usd))\
        .filter(DailyCostSummary.date >= today).first()
    return {"period": "daily", "tokens": rows[0] or 0, "cost_usd": round(rows[1] or 0, 4)}


@router.get("/summary")
def cost_summary(period: str = Query("daily"), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    month_start = now.replace(day=1).strftime("%Y-%m-%d")

    def _sum_since(date_str: str):
        rows = db.query(func.sum(DailyCostSummary.total_tokens), func.sum(DailyCostSummary.estimated_cost_usd))\
            .filter(DailyCostSummary.date >= date_str).first()
        return {"tokens": rows[0] or 0, "cost_usd": round(rows[1] or 0, 4)}

    today_sum = db.query(func.sum(AgentTokenSnapshot.total_tokens), func.sum(AgentTokenSnapshot.estimated_cost_usd))\
        .filter(AgentTokenSnapshot.sampled_at >= today).first()
    week_sum = _sum_since(week_start)
    month_sum = _sum_since(month_start)

    return {
        "today": {"tokens": today_sum[0] or 0, "cost_usd": round(today_sum[1] or 0, 4)},
        "week": week_sum,
        "month": month_sum,
        "period": period,
    }


# ── By Agent ──

@router.get("/by-agent")
def cost_by_agent(period_days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=period_days)).strftime("%Y-%m-%d")
    rows = db.query(
        DailyCostSummary.agent_id,
        func.sum(DailyCostSummary.total_tokens),
        func.sum(DailyCostSummary.estimated_cost_usd),
    ).filter(DailyCostSummary.date >= cutoff, DailyCostSummary.agent_id.isnot(None))\
     .group_by(DailyCostSummary.agent_id)\
     .order_by(func.sum(DailyCostSummary.estimated_cost_usd).desc()).all()
    return [{"agent_id": r[0], "total_tokens": r[1] or 0, "estimated_cost_usd": round(r[2] or 0, 4)} for r in rows]


# ── By Project ──

@router.get("/by-project")
def cost_by_project(period_days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=period_days)).strftime("%Y-%m-%d")
    rows = db.query(
        DailyCostSummary.agent_id,
        func.sum(DailyCostSummary.total_tokens),
        func.sum(DailyCostSummary.estimated_cost_usd),
    ).filter(DailyCostSummary.date >= cutoff)\
     .group_by(DailyCostSummary.agent_id)\
     .order_by(func.sum(DailyCostSummary.estimated_cost_usd).desc()).all()
    # Group agents by project prefix or "ungrouped"
    projects: dict[str, dict] = {}
    for r in rows:
        pid = "ungrouped"
        for prefix in ["rd-", "doc-", "test-", "ui-"]:
            if r[0] and prefix in r[0]:
                pid = prefix.rstrip("-") + "-team"
                break
        if pid not in projects:
            projects[pid] = {"project_id": pid, "total_tokens": 0, "estimated_cost_usd": 0.0}
        projects[pid]["total_tokens"] += r[1] or 0
        projects[pid]["estimated_cost_usd"] += r[2] or 0
    return [{"project_id": k, "total_tokens": v["total_tokens"], "estimated_cost_usd": round(v["estimated_cost_usd"], 4)} for k, v in projects.items()]


# ── Trend ──

@router.get("/trend")
def cost_trend(period_days: int = Query(30, ge=1, le=90), granularity: str = Query("daily"), db: Session = Depends(get_db)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=period_days)).strftime("%Y-%m-%d")
    rows = db.query(
        DailyCostSummary.date,
        func.sum(DailyCostSummary.total_tokens),
        func.sum(DailyCostSummary.estimated_cost_usd),
    ).filter(DailyCostSummary.date >= cutoff)\
     .group_by(DailyCostSummary.date)\
     .order_by(DailyCostSummary.date).all()
    return [{"date": r[0], "total_tokens": r[1] or 0, "estimated_cost_usd": round(r[2] or 0, 4)} for r in rows]


# ── Top Sessions ──

@router.get("/top-sessions")
def top_sessions(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    rows = db.query(
        AgentTokenSnapshot.agent_id,
        AgentTokenSnapshot.session_key,
        AgentTokenSnapshot.total_tokens,
        AgentTokenSnapshot.estimated_cost_usd,
        AgentTokenSnapshot.model,
        AgentTokenSnapshot.sampled_at,
    ).order_by(AgentTokenSnapshot.estimated_cost_usd.desc()).limit(limit).all()
    return [{"agent_id": r[0], "session_key": r[1], "total_tokens": r[2], "estimated_cost_usd": round(r[3], 4), "model": r[4], "sampled_at": r[5]} for r in rows]


# ── Budget CRUD ──

@router.post("/budget", status_code=201)
def create_budget(body: BudgetCreate, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    b = BudgetAlert(id=str(uuid.uuid4()), name=body.name, budget_type=body.budget_type,
                    budget_limit_usd=body.budget_limit_usd, alert_threshold_pct=body.alert_threshold_pct,
                    created_at=now, updated_at=now)
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": b.id, "name": b.name, "budget_type": b.budget_type, "budget_limit_usd": b.budget_limit_usd,
            "current_usage_usd": b.current_usage_usd, "alert_threshold_pct": b.alert_threshold_pct, "is_active": b.is_active}


@router.get("/budget")
def list_budgets(db: Session = Depends(get_db)):
    rows = db.query(BudgetAlert).order_by(BudgetAlert.created_at.desc()).all()
    return [{"id": b.id, "name": b.name, "budget_type": b.budget_type, "budget_limit_usd": b.budget_limit_usd,
             "current_usage_usd": b.current_usage_usd, "alert_threshold_pct": b.alert_threshold_pct,
             "is_active": b.is_active, "usage_pct": round(b.current_usage_usd / b.budget_limit_usd * 100, 1) if b.budget_limit_usd > 0 else 0}
            for b in rows]


@router.patch("/budget/{budget_id}")
def update_budget(budget_id: str, body: BudgetUpdate, db: Session = Depends(get_db)):
    b = db.query(BudgetAlert).filter(BudgetAlert.id == budget_id).first()
    if not b:
        raise HTTPException(404, "Budget not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        if hasattr(b, field):
            setattr(b, field, value)
    b.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(b)
    return {"id": b.id, "name": b.name, "budget_type": b.budget_type, "budget_limit_usd": b.budget_limit_usd,
            "current_usage_usd": b.current_usage_usd, "alert_threshold_pct": b.alert_threshold_pct, "is_active": b.is_active}


# ── Token snapshot ingestion (called by scheduler) ──

@router.post("/snapshot")
def ingest_snapshot(body: dict, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    agent_id = body.get("agent_id", "unknown")
    session_key = body.get("session_key")
    total_tokens = body.get("total_tokens", 0)
    total_input_tokens = body.get("total_input_tokens", 0)
    total_output_tokens = body.get("total_output_tokens", 0)
    model = body.get("model")
    cost = _estimate_cost(total_tokens, model)
    snap = AgentTokenSnapshot(
        id=str(uuid.uuid4()), agent_id=agent_id, session_key=session_key,
        total_tokens=total_tokens, total_input_tokens=total_input_tokens,
        total_output_tokens=total_output_tokens, estimated_cost_usd=cost,
        model=model, sampled_at=now.isoformat(),
    )
    db.add(snap)
    # Upsert daily summary
    today = now.strftime("%Y-%m-%d")
    existing = db.query(DailyCostSummary).filter(DailyCostSummary.date == today, DailyCostSummary.agent_id == agent_id).first()
    if existing:
        existing.total_tokens += total_tokens
        existing.total_sessions += 1
        existing.estimated_cost_usd += cost
    else:
        summary = DailyCostSummary(
            id=str(uuid.uuid4()), date=today, agent_id=agent_id,
            total_tokens=total_tokens, total_sessions=1, estimated_cost_usd=cost,
        )
        db.add(summary)
    db.commit()
    return {"status": "ok", "cost_usd": round(cost, 6)}


# ── Gateway sync endpoints ──

GATEWAY_URL = "http://localhost:8000/api/gateway/sessions"


@router.post("/sync")
def sync_from_gateway(db: Session = Depends(get_db)):
    """从 Gateway 采集 token 数据并写入数据库"""
    try:
        with httpx.Client() as client:
            resp = client.get(GATEWAY_URL, timeout=10)
            data = resp.json()
    except Exception as e:
        return {"ok": False, "error": f"Gateway unreachable: {str(e)}"}

    sessions = data.get("sessions", [])
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")

    count = 0

    for s in sessions:
        agent_id = s.get("key", "").split(":")[1] if ":" in s.get("key", "") else s.get("key", "unknown")
        total_tokens = s.get("totalTokens", 0) or 0
        input_tokens = s.get("inputTokens", 0) or 0
        output_tokens = s.get("outputTokens", 0) or 0
        cost_usd = s.get("estimatedCostUsd", 0) or 0
        model = s.get("model", "unknown")
        session_key = s.get("key", "")

        if total_tokens <= 0:
            continue

        # 写入 AgentTokenSnapshot（保留每个 session 的快照）
        snapshot = AgentTokenSnapshot(
            id=str(uuid.uuid4()),
            agent_id=agent_id,
            session_key=session_key,
            model=model,
            total_tokens=total_tokens,
            total_input_tokens=input_tokens,
            total_output_tokens=output_tokens,
            estimated_cost_usd=cost_usd,
            sampled_at=now.isoformat(),
        )
        db.add(snapshot)

        # 写入/更新 DailyCostSummary
        existing = db.query(DailyCostSummary).filter(
            DailyCostSummary.agent_id == agent_id,
            DailyCostSummary.date == today,
        ).first()

        if existing:
            existing.total_tokens += total_tokens
            existing.estimated_cost_usd += cost_usd
        else:
            summary = DailyCostSummary(
                id=str(uuid.uuid4()),
                agent_id=agent_id,
                date=today,
                total_tokens=total_tokens,
                estimated_cost_usd=cost_usd,
            )
            db.add(summary)

        count += 1

    db.commit()

    # 同时把历史数据也补全（用 sessions 的 startedAt 来回填）
    historical_count = 0
    for s in sessions:
        agent_id = s.get("key", "").split(":")[1] if ":" in s.get("key", "") else s.get("key", "unknown")
        total_tokens = s.get("totalTokens", 0) or 0
        cost_usd = s.get("estimatedCostUsd", 0) or 0

        started_at_str = s.get("startedAt")
        if not started_at_str:
            continue

        try:
            started_at = datetime.fromtimestamp(started_at_str / 1000, tz=timezone.utc) if isinstance(started_at_str, (int, float)) else None
            if not started_at:
                continue

            session_date = started_at.strftime("%Y-%m-%d")
            if session_date == today:
                continue  # 今天的已经处理了

            existing = db.query(DailyCostSummary).filter(
                DailyCostSummary.agent_id == agent_id,
                DailyCostSummary.date == session_date,
            ).first()

            if existing:
                existing.total_tokens += total_tokens
                existing.estimated_cost_usd += cost_usd
            else:
                summary = DailyCostSummary(
                    id=str(uuid.uuid4()),
                    agent_id=agent_id,
                    date=session_date,
                    total_tokens=total_tokens,
                    estimated_cost_usd=cost_usd,
                )
                db.add(summary)
            historical_count += 1
        except Exception:
            continue

    db.commit()

    return {"ok": True, "synced_sessions": count, "historical_records": historical_count}


@router.get("/realtime")
def realtime_cost():
    """从 Gateway 实时获取 token 消耗（不写数据库）"""
    try:
        with httpx.Client() as client:
            resp = client.get(GATEWAY_URL, timeout=10)
            data = resp.json()
    except Exception as e:
        return {"error": f"Gateway unreachable: {str(e)}"}

    sessions = data.get("sessions", [])

    total_tokens = sum(s.get("totalTokens", 0) or 0 for s in sessions)
    total_cost = sum(s.get("estimatedCostUsd", 0) or 0 for s in sessions)

    active = [s for s in sessions if s.get("status") == "running"]
    active_tokens = sum(s.get("totalTokens", 0) or 0 for s in active)
    active_cost = sum(s.get("estimatedCostUsd", 0) or 0 for s in active)

    by_agent = {}
    for s in sessions:
        if s.get("totalTokens", 0) or 0 <= 0:
            continue
        agent_id = s.get("key", "").split(":")[1] if ":" in s.get("key", "") else s.get("key", "unknown")
        if agent_id not in by_agent:
            by_agent[agent_id] = {"total_tokens": 0, "estimated_cost_usd": 0, "sessions": 0}
        by_agent[agent_id]["total_tokens"] += s.get("totalTokens", 0) or 0
        by_agent[agent_id]["estimated_cost_usd"] += s.get("estimatedCostUsd", 0) or 0
        by_agent[agent_id]["sessions"] += 1

    return {
        "total_tokens": total_tokens,
        "total_cost_usd": total_cost,
        "active_sessions": len(active),
        "active_tokens": active_tokens,
        "active_cost_usd": active_cost,
        "by_agent": by_agent,
    }
