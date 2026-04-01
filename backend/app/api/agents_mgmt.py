"""Agent configuration management API."""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/agents-mgmt", tags=["agents-mgmt"])

CONFIG_PATH = Path.home() / ".openclaw" / "openclaw.json"


def _load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise HTTPException(status_code=503, detail="openclaw.json not found")
    return json.loads(CONFIG_PATH.read_text())


def _save_config(data: dict[str, Any]) -> None:
    shutil.copy2(CONFIG_PATH, CONFIG_PATH.with_suffix(".json.bak"))
    CONFIG_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def _get_agents(cfg: dict) -> dict[str, Any]:
    return cfg.get("agents", {})


def _get_agent_defaults(cfg: dict) -> dict[str, Any]:
    return _get_agents(cfg).get("defaults", {})


def _get_agent_list(cfg: dict) -> list[dict[str, Any]]:
    return _get_agents(cfg).get("list", [])


def _find_agent_index(agent_list: list, agent_id: str) -> int:
    for i, a in enumerate(agent_list):
        if a.get("id") == agent_id:
            return i
    return -1


# ── templates ──────────────────────────────────────────────
AGENT_TEMPLATES = [
    {
        "id": "blank",
        "name": "空白 Agent",
        "description": "从零开始创建自定义 Agent",
        "config": {"model": {"primary": "zhipu/GLM-5-Turbo"}},
    },
    {
        "id": "general-assistant",
        "name": "通用助手",
        "description": "适合日常问答、信息检索、简单任务处理",
        "config": {"model": {"primary": "zhipu/GLM-5-Turbo"}},
    },
    {
        "id": "coder",
        "name": "编程助手",
        "description": "专注代码开发、调试、代码审查",
        "config": {"model": {"primary": "Anthropic/claude-sonnet-4-6"}},
    },
    {
        "id": "researcher",
        "name": "研究分析",
        "description": "深度调研、资料整理、报告撰写",
        "config": {"model": {"primary": "zhipu/GLM-5-Turbo"}},
    },
    {
        "id": "translator",
        "name": "翻译专家",
        "description": "多语言翻译、本地化、文案润色",
        "config": {"model": {"primary": "zhipu/GLM-5-Turbo"}},
    },
]


# ── endpoints ──────────────────────────────────────────────

@router.get("/list")
def list_agents():
    """List all agents with their configurations."""
    cfg = _load_config()
    defaults = _get_agent_defaults(cfg)
    agent_list = _get_agent_list(cfg)
    result = []
    for a in agent_list:
        agent = {"id": a.get("id", ""), "name": a.get("name", a.get("id", ""))}
        # Merge defaults, then agent-level overrides
        merged = {**defaults}
        merged.update(a)
        agent["config"] = merged
        result.append(agent)
    return {"agents": result, "total": len(result)}


@router.get("/templates")
def list_templates():
    """List available agent templates."""
    return {"templates": AGENT_TEMPLATES}


@router.get("/{agent_id}")
def get_agent(agent_id: str):
    """Get single agent detail."""
    cfg = _load_config()
    defaults = _get_agent_defaults(cfg)
    idx = _find_agent_index(_get_agent_list(cfg), agent_id)
    if idx < 0:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    agent = _get_agent_list(cfg)[idx]
    merged = {**defaults}
    merged.update(agent)
    return {"agent": merged}


@router.post("")
def create_agent(payload: dict[str, Any]):
    """Create a new agent."""
    cfg = _load_config()
    agent_id = payload.get("id", "").strip()
    if not agent_id:
        raise HTTPException(status_code=400, detail="Agent ID is required")
    agent_list = _get_agent_list(cfg)
    if _find_agent_index(agent_list, agent_id) >= 0:
        raise HTTPException(status_code=409, detail=f"Agent '{agent_id}' already exists")
    agent_list.append({"id": agent_id, **{k: v for k, v in payload.items() if k != "id"}})
    cfg.setdefault("agents", {})["list"] = agent_list
    _save_config(cfg)
    return {"ok": True, "agent_id": agent_id}


@router.patch("/{agent_id}")
def update_agent(agent_id: str, payload: dict[str, Any]):
    """Update an existing agent."""
    cfg = _load_config()
    agent_list = _get_agent_list(cfg)
    idx = _find_agent_index(agent_list, agent_id)
    if idx < 0:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    for k, v in payload.items():
        if k == "id":
            continue
        if k == "description":
            agent_list[idx]["name"] = v  # OpenClaw uses name as display
        else:
            agent_list[idx][k] = v
    cfg["agents"]["list"] = agent_list
    _save_config(cfg)
    return {"ok": True, "agent_id": agent_id}


@router.delete("/{agent_id}")
def delete_agent(agent_id: str):
    """Delete an agent."""
    cfg = _load_config()
    agent_list = _get_agent_list(cfg)
    idx = _find_agent_index(agent_list, agent_id)
    if idx < 0:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    if agent_id == "main":
        raise HTTPException(status_code=403, detail="Cannot delete the main agent")
    agent_list.pop(idx)
    cfg["agents"]["list"] = agent_list
    _save_config(cfg)
    return {"ok": True, "deleted": agent_id}


@router.post("/{agent_id}/test")
def test_agent(agent_id: str):
    """Send a test message to the agent via Gateway."""
    import subprocess
    result = subprocess.run(
        ["openclaw", "agent", "--agent", agent_id, "-m", "ping", "--json"],
        capture_output=True, text=True, timeout=30,
    )
    success = result.returncode == 0
    return {
        "ok": success,
        "agent_id": agent_id,
        "stdout": (result.stdout or "")[:2000],
        "stderr": (result.stderr or "")[:2000],
    }
