"""
工作流 Gateway 集成 API
提供 agent 列表、调度等功能
"""
from __future__ import annotations

import json
import logging
from typing import List

from fastapi import APIRouter

# 路由器定义
router = APIRouter(prefix="/api/v1/workflow", tags=["workflow-gateway"])

# 日志记录器
logger = logging.getLogger(__name__)


def _get_openclaw_agents() -> List[dict]:
    """
    读取 /root/.openclaw/openclaw.json 获取 agent 列表
    
    返回格式: [{"id": "...", "name": "...", "status": "..."}, ...]
    """
    try:
        with open("/root/.openclaw/openclaw.json", "r", encoding="utf-8") as f:
            config = json.load(f)
        
        agents = []
        # 从 agents 配置中获取
        if "agents" in config:
            for agent_id, agent_config in config["agents"].items():
                agents.append({
                    "id": agent_id,
                    "name": agent_config.get("name", agent_id),
                    "display_name": agent_config.get("displayName", agent_config.get("name", agent_id)),
                    "status": "online",  # 假设都在线，后续可以实时检查
                    "capabilities": agent_config.get("capabilities", []),
                    "model": agent_config.get("model", "unknown"),
                })
        
        return agents
    except Exception as e:
        logger.error(f"读取 openclaw.json 失败: {e}")
        return []


@router.get("/agents")
async def list_available_agents():
    """
    获取可用 agent 列表
    
    权限: viewer
    """
    logger.info("获取可用 agent 列表")
    
    # 从 openclaw.json 读取 agent 列表
    agents = _get_openclaw_agents()
    
    return {
        "data": agents,
        "total": len(agents),
    }


# ── 导出路由器 ──────────────────────────────────────────────────────────

__all__ = ["router"]
