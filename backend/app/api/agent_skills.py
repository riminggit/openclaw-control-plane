"""Agent-Skill matrix management API."""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/agent-skills", tags=["agent-skills"])

CONFIG_PATH = Path.home() / ".openclaw" / "openclaw.json"


def _load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise HTTPException(status_code=503, detail="openclaw.json not found")
    return json.loads(CONFIG_PATH.read_text())


def _save_config(data: dict[str, Any]) -> None:
    shutil.copy2(CONFIG_PATH, CONFIG_PATH.with_suffix(".json.bak"))
    CONFIG_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def _get_agent_list(cfg: dict) -> list[dict[str, Any]]:
    return cfg.get("agents", {}).get("list", [])


def _get_agent_workspace(agent_id: str) -> Path:
    """Get workspace path for an agent."""
    if agent_id == "main":
        return Path.home() / ".openclaw" / "workspace"
    return Path.home() / ".openclaw" / f"workspace-{agent_id}"


def _scan_skills_in_workspace(workspace_path: Path) -> list[str]:
    """Scan skills directory in a workspace."""
    skills_dir = workspace_path / "skills"
    if not skills_dir.exists():
        return []
    
    skills = []
    for item in skills_dir.iterdir():
        if item.is_dir() and (item / "SKILL.md").exists():
            skills.append(item.name)
    return sorted(skills)


def _get_skill_description(skill_name: str, workspace_path: Path) -> str:
    """Extract description from SKILL.md."""
    skill_path = workspace_path / "skills" / skill_name / "SKILL.md"
    if not skill_path.exists():
        return ""
    
    try:
        content = skill_path.read_text(errors="ignore")
        # Extract description from first non-empty, non-title line
        lines = content.split("\n")
        for line in lines:
            line = line.strip()
            if line and not line.startswith("#"):
                return line[:120]
        # Fallback to title
        for line in lines:
            if line.startswith("#"):
                return line.lstrip("# ").strip()[:120]
    except Exception:
        pass
    return ""


def _determine_skill_source(skill_name: str) -> str:
    """Determine where a skill comes from."""
    # Check if it's in bundled skills
    bundled_path = Path.home() / ".openclaw" / "skills" / skill_name
    if bundled_path.exists():
        return "openclaw-bundled"
    return "workspace"


# ── Schemas ──

class UpdateAgentSkills(BaseModel):
    skills: list[str] | str  # ["skill1", "skill2"] or "*"


# ── Endpoints ──

@router.get("/matrix")
def get_skill_matrix():
    """
    Get the complete agent × skill matrix.
    
    Returns:
    - agents: list of agent configs with their configured skills
    - skills: list of all available skills with descriptions
    - matrix: {agent_id: {skill_name: bool}} indicating availability
    """
    cfg = _load_config()
    agent_list = _get_agent_list(cfg)
    
    # Collect all unique skills across all agents
    all_skills = {}  # name -> {description, source}
    agent_skills = {}  # agent_id -> set(skill_names)
    
    # First pass: scan all agent workspaces to collect available skills
    for agent in agent_list:
        agent_id = agent.get("id", "")
        workspace_path = _get_agent_workspace(agent_id)
        available = _scan_skills_in_workspace(workspace_path)
        agent_skills[agent_id] = set(available)
        
        for skill_name in available:
            if skill_name not in all_skills:
                all_skills[skill_name] = {
                    "name": skill_name,
                    "description": _get_skill_description(skill_name, workspace_path),
                    "source": _determine_skill_source(skill_name)
                }
    
    # Build agents list with configured skills
    agents = []
    for agent in agent_list:
        agent_id = agent.get("id", "")
        configured = agent.get("skills", None)  # None means all available
        
        agents.append({
            "id": agent_id,
            "name": agent.get("name", agent_id),
            "model": agent.get("model", {}).get("primary", "unknown") if isinstance(agent.get("model"), dict) else agent.get("model", "unknown"),
            "configured_skills": configured if configured and configured != "*" else None
        })
    
    # Build matrix
    matrix = {}
    for agent in agents:
        agent_id = agent["id"]
        configured = agent["configured_skills"]
        available = agent_skills.get(agent_id, set())
        
        matrix[agent_id] = {}
        for skill_name in all_skills.keys():
            if skill_name in available:
                # Skill is available in workspace
                if configured is None:
                    # No restriction, all available skills are enabled
                    matrix[agent_id][skill_name] = True
                else:
                    # Only configured skills are enabled
                    matrix[agent_id][skill_name] = skill_name in configured
            else:
                # Skill not available in this agent's workspace
                matrix[agent_id][skill_name] = None  # Use None to indicate unavailable
    
    # Sort skills by name
    sorted_skills = sorted(all_skills.values(), key=lambda s: s["name"])
    
    return {
        "agents": agents,
        "skills": sorted_skills,
        "matrix": matrix
    }


@router.get("/{agent_id}")
def get_agent_skills(agent_id: str):
    """
    Get detailed skill information for a specific agent.
    
    Returns:
    - agent_id: the agent ID
    - configured_skills: list of explicitly configured skills (None if all)
    - available_skills: list of all skills available in workspace
    - workspace_path: path to agent's workspace
    """
    cfg = _load_config()
    agent_list = _get_agent_list(cfg)
    
    # Find the agent
    agent = None
    for a in agent_list:
        if a.get("id") == agent_id:
            agent = a
            break
    
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    
    workspace_path = _get_agent_workspace(agent_id)
    available = _scan_skills_in_workspace(workspace_path)
    configured = agent.get("skills", None)
    
    # Build detailed available skills
    available_details = []
    for skill_name in available:
        available_details.append({
            "name": skill_name,
            "description": _get_skill_description(skill_name, workspace_path),
            "source": _determine_skill_source(skill_name),
            "enabled": configured is None or skill_name in configured
        })
    
    return {
        "agent_id": agent_id,
        "agent_name": agent.get("name", agent_id),
        "configured_skills": configured,
        "available_skills": available_details,
        "workspace_path": str(workspace_path)
    }


@router.put("/{agent_id}")
def update_agent_skills(agent_id: str, body: UpdateAgentSkills):
    """
    Update skill configuration for an agent.
    
    Request body:
    - skills: array of skill names, or "*" for all available skills
    
    Empty array [] = disable all skills
    "*" or null = enable all available skills (remove restriction)
    """
    cfg = _load_config()
    agent_list = _get_agent_list(cfg)
    
    # Find and update the agent
    found = False
    for agent in agent_list:
        if agent.get("id") == agent_id:
            found = True
            
            # Handle different input formats
            if body.skills == "*":
                # Remove restriction, enable all
                if "skills" in agent:
                    del agent["skills"]
            elif isinstance(body.skills, list):
                if len(body.skills) == 0:
                    # Disable all skills
                    agent["skills"] = []
                else:
                    # Set specific skills
                    agent["skills"] = body.skills
            else:
                raise HTTPException(status_code=400, detail="skills must be an array or '*'")
            
            break
    
    if not found:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    
    _save_config(cfg)
    
    return {
        "ok": True,
        "agent_id": agent_id,
        "skills": body.skills
    }


@router.get("/skills/detail")
def get_all_skills_detail():
    """
    Get detailed information for all unique skills across all agents.
    
    Returns list of skills with name, description, and source.
    """
    cfg = _load_config()
    agent_list = _get_agent_list(cfg)
    
    # Collect all unique skills
    all_skills = {}
    
    for agent in agent_list:
        agent_id = agent.get("id", "")
        workspace_path = _get_agent_workspace(agent_id)
        available = _scan_skills_in_workspace(workspace_path)
        
        for skill_name in available:
            if skill_name not in all_skills:
                all_skills[skill_name] = {
                    "name": skill_name,
                    "description": _get_skill_description(skill_name, workspace_path),
                    "source": _determine_skill_source(skill_name)
                }
    
    # Sort by name
    sorted_skills = sorted(all_skills.values(), key=lambda s: s["name"])
    
    return sorted_skills
