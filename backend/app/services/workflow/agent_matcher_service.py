"""
Agent 匹配服务层
负责 Agent 列表获取和匹配
"""
from __future__ import annotations

import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class AgentMatcherService:
    """Agent 匹配服务"""
    
    @staticmethod
    def get_openclaw_agents() -> List[Dict[str, Any]]:
        """
        读取 /root/.openclaw/openclaw.json 获取 agent 列表
        
        Returns:
            Agent 列表: [{"id": "...", "name": "...", "status": "..."}, ...]
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
    
    @staticmethod
    def get_agent_by_id(agent_id: str) -> Optional[Dict[str, Any]]:
        """
        根据 ID 获取 Agent 信息
        
        Args:
            agent_id: Agent ID
            
        Returns:
            Agent 信息，如果不存在则返回 None
        """
        agents = AgentMatcherService.get_openclaw_agents()
        for agent in agents:
            if agent["id"] == agent_id:
                return agent
        return None
    
    @staticmethod
    def match_agent_for_step(
        step_name: str,
        step_capabilities: List[str],
        available_agents: List[Dict[str, Any]]
    ) -> Optional[str]:
        """
        根据步骤需求匹配最合适的 Agent
        
        Args:
            step_name: 步骤名称
            step_capabilities: 步骤所需能力列表
            available_agents: 可用 Agent 列表
            
        Returns:
            匹配的 Agent ID，如果没有匹配则返回 None
        """
        # TODO: 实现智能匹配逻辑
        # 1. 检查能力匹配
        # 2. 检查负载情况
        # 3. 检查在线状态
        # 4. 返回最佳匹配
        
        # 简单实现：返回第一个在线且有匹配能力的 Agent
        for agent in available_agents:
            if agent["status"] == "online":
                agent_caps = set(agent.get("capabilities", []))
                required_caps = set(step_capabilities)
                
                # 如果 Agent 包含所有必需能力
                if required_caps.issubset(agent_caps):
                    return agent["id"]
        
        # 如果没有精确匹配，返回第一个在线的 Agent
        for agent in available_agents:
            if agent["status"] == "online":
                return agent["id"]
        
        return None
