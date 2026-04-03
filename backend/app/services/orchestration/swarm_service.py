"""
SwarmService — Agent Swarm/Team management for OpenClaw v3.

Manages dynamic agent teams:
- Create/dissolve teams with a leader agent
- Add/remove team members
- Inter-agent messaging (notify, broadcast, structured)
- Team state persistence and recovery

Reference: Claude Code src/tools/TeamCreateTool/, src/tools/SendMessageTool/,
           src/utils/swarm/, src/hooks/useSwarmInitialization.ts
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.orchestration import AgentTeam, AgentTeamMember, AgentMessage

logger = logging.getLogger(__name__)


# ============================================================
# Enums
# ============================================================

class TeamStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    DISSOLVED = "dissolved"


class MemberRole(str, Enum):
    LEADER = "leader"
    WORKER = "worker"
    VERIFIER = "verifier"
    OBSERVER = "observer"


class MemberStatus(str, Enum):
    ACTIVE = "active"
    IDLE = "idle"
    BUSY = "busy"
    LEFT = "left"


class MessageType(str, Enum):
    NOTIFY = "notify"           # One-way notification
    REQUEST = "request"         # Request expecting response
    RESPONSE = "response"       # Response to a request
    BROADCAST = "broadcast"     # To all team members
    SHUTDOWN_REQUEST = "shutdown_request"
    SHUTDOWN_APPROVE = "shutdown_approve"
    SHUTDOWN_REJECT = "shutdown_reject"
    PLAN_APPROVAL = "plan_approval"


# ============================================================
# Data Types
# ============================================================

@dataclass
class TeamInfo:
    """Summary info for a team."""
    team_id: str
    team_name: str
    leader_agent_id: str
    status: str
    member_count: int
    workflow_instance_id: Optional[str] = None
    created_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "team_id": self.team_id,
            "team_name": self.team_name,
            "leader_agent_id": self.leader_agent_id,
            "status": self.status,
            "member_count": self.member_count,
            "workflow_instance_id": self.workflow_instance_id,
            "created_at": self.created_at,
        }


@dataclass
class MessagePayload:
    """Structured message payload."""
    message_type: MessageType
    from_agent_id: str
    to_agent_id: str  # or "*" for broadcast
    content: str
    summary: Optional[str] = None  # 5-10 word preview
    team_id: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class TeamOperationResult:
    """Result of a team operation."""
    success: bool
    message: str
    data: Optional[dict[str, Any]] = None


# ============================================================
# SwarmService
# ============================================================

class SwarmService:
    """
    Agent Swarm/Team management service.

    Inspired by Claude Code's Swarm system:
    - Dynamic team creation with leader assignment
    - Member management (add/remove/role change)
    - Inter-agent messaging with multiple patterns
    - Team state persistence via database
    - Broadcast and targeted messaging
    - Shutdown coordination protocol

    Key differences from Claude Code:
    - Uses database storage instead of filesystem (team files)
    - Web-based (not terminal panes)
    - Multi-tenant isolation
    """

    def __init__(self, db: Optional[Session] = None):
        self._db = db
        # In-memory state for operations without DB
        self._teams: dict[str, dict[str, Any]] = {}
        self._members: dict[str, list[dict[str, Any]]] = {}
        self._messages: list[dict[str, Any]] = []

    def _require_db(self) -> None:
        """Raise if database session is not available."""
        if not self._db:
            raise RuntimeError("SwarmService requires a database session for this operation")

    # ── Team Lifecycle ─────────────────────────────────────

    def create_team(
        self,
        team_name: str,
        leader_agent_id: str,
        workflow_instance_id: Optional[str] = None,
        description: str = "",
    ) -> TeamOperationResult:
        """
        Create a new agent team.

        Reference: Claude Code TeamCreateTool

        Args:
            team_name: Unique team name
            leader_agent_id: Agent ID of the team leader
            workflow_instance_id: Optional associated workflow instance
            description: Team purpose description

        Returns:
            TeamOperationResult with team info
        """
        # Check if team name already exists
        existing = self._db.query(AgentTeam).filter_by(name=team_name).first()
        if existing:
            return TeamOperationResult(
                success=False,
                message=f"Team '{team_name}' already exists",
            )

        team_id = f"team-{uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        team = AgentTeam(
            id=team_id,
            name=team_name,
            leader_agent_id=leader_agent_id,
            workflow_instance_id=workflow_instance_id,
            status=TeamStatus.ACTIVE.value,
            config_json=json.dumps({"description": description}),
            created_at=now,
        )
        self._db.add(team)

        # Add leader as first member
        member_id = f"tm-{uuid4().hex[:12]}"
        leader_member = AgentTeamMember(
            id=member_id,
            team_id=team_id,
            agent_id=leader_agent_id,
            role=MemberRole.LEADER.value,
            status=MemberStatus.ACTIVE.value,
            joined_at=now,
        )
        self._db.add(leader_member)
        self._db.commit()

        return TeamOperationResult(
            success=True,
            message=f"Team '{team_name}' created with leader {leader_agent_id}",
            data={"team_id": team_id, "team_name": team_name, "leader_member_id": member_id},
        )

    def dissolve_team(self, team_name: str, reason: str = "") -> TeamOperationResult:
        """
        Dissolve a team. All members are removed.

        Reference: Claude Code TeamDeleteTool
        """
        team = self._db.query(AgentTeam).filter_by(name=team_name).first()
        if not team:
            return TeamOperationResult(success=False, message=f"Team '{team_name}' not found")

        now = datetime.now(timezone.utc).isoformat()
        team.status = TeamStatus.DISSOLVED.value
        team.dissolved_at = now

        # Mark all members as left
        members = self._db.query(AgentTeamMember).filter_by(team_id=team.id).all()
        for member in members:
            member.status = MemberStatus.LEFT.value
            member.left_at = now

        self._db.commit()

        return TeamOperationResult(
            success=True,
            message=f"Team '{team_name}' dissolved ({len(members)} members removed)",
        )

    def get_team(self, team_name: str) -> Optional[TeamInfo]:
        """Get team info by name."""
        team = self._db.query(AgentTeam).filter_by(name=team_name).first()
        if not team:
            return None

        member_count = self._db.query(AgentTeamMember).filter_by(
            team_id=team.id, status=MemberStatus.ACTIVE.value
        ).count()

        return TeamInfo(
            team_id=team.id,
            team_name=team.name,
            leader_agent_id=team.leader_agent_id,
            status=team.status,
            member_count=member_count,
            workflow_instance_id=team.workflow_instance_id,
            created_at=team.created_at,
        )

    def list_teams(self, status: Optional[str] = None) -> list[TeamInfo]:
        """List all teams, optionally filtered by status."""
        query = self._db.query(AgentTeam)
        if status:
            query = query.filter_by(status=status)

        teams = query.all()
        result = []
        for team in teams:
            member_count = self._db.query(AgentTeamMember).filter_by(
                team_id=team.id, status=MemberStatus.ACTIVE.value
            ).count()
            result.append(TeamInfo(
                team_id=team.id,
                team_name=team.name,
                leader_agent_id=team.leader_agent_id,
                status=team.status,
                member_count=member_count,
                workflow_instance_id=team.workflow_instance_id,
                created_at=team.created_at,
            ))
        return result

    # ── Member Management ──────────────────────────────────

    def add_member(
        self,
        team_name: str,
        agent_id: str,
        role: str = MemberRole.WORKER.value,
    ) -> TeamOperationResult:
        """
        Add a member to a team.

        Args:
            team_name: Team name
            agent_id: Agent ID to add
            role: Member role (leader/worker/verifier/observer)
        """
        team = self._db.query(AgentTeam).filter_by(name=team_name).first()
        if not team:
            return TeamOperationResult(success=False, message=f"Team '{team_name}' not found")

        if team.status != TeamStatus.ACTIVE.value:
            return TeamOperationResult(success=False, message=f"Team '{team_name}' is not active")

        # Check if already a member
        existing = self._db.query(AgentTeamMember).filter_by(
            team_id=team.id, agent_id=agent_id
        ).first()
        if existing and existing.status == MemberStatus.ACTIVE.value:
            return TeamOperationResult(
                success=False,
                message=f"Agent {agent_id} is already a member of '{team_name}'",
            )

        # Reactivate if previously left
        if existing:
            existing.status = MemberStatus.ACTIVE.value
            existing.role = role
            existing.left_at = None
            existing.joined_at = datetime.now(timezone.utc).isoformat()
        else:
            member_id = f"tm-{uuid4().hex[:12]}"
            existing = AgentTeamMember(
                id=member_id,
                team_id=team.id,
                agent_id=agent_id,
                role=role,
                status=MemberStatus.ACTIVE.value,
                joined_at=datetime.now(timezone.utc).isoformat(),
            )
            self._db.add(existing)

        self._db.commit()

        return TeamOperationResult(
            success=True,
            message=f"Agent {agent_id} added to '{team_name}' as {role}",
            data={"member_id": existing.id},
        )

    def remove_member(self, team_name: str, agent_id: str) -> TeamOperationResult:
        """Remove a member from a team."""
        team = self._db.query(AgentTeam).filter_by(name=team_name).first()
        if not team:
            return TeamOperationResult(success=False, message=f"Team '{team_name}' not found")

        # Cannot remove leader
        if team.leader_agent_id == agent_id:
            return TeamOperationResult(
                success=False,
                message="Cannot remove team leader. Dissolve the team instead.",
            )

        member = self._db.query(AgentTeamMember).filter_by(
            team_id=team.id, agent_id=agent_id, status=MemberStatus.ACTIVE.value
        ).first()
        if not member:
            return TeamOperationResult(
                success=False,
                message=f"Agent {agent_id} is not an active member of '{team_name}'",
            )

        member.status = MemberStatus.LEFT.value
        member.left_at = datetime.now(timezone.utc).isoformat()
        self._db.commit()

        return TeamOperationResult(
            success=True,
            message=f"Agent {agent_id} removed from '{team_name}'",
        )

    def get_members(self, team_name: str) -> list[dict[str, Any]]:
        """Get all active members of a team."""
        team = self._db.query(AgentTeam).filter_by(name=team_name).first()
        if not team:
            return []

        members = self._db.query(AgentTeamMember).filter_by(
            team_id=team.id, status=MemberStatus.ACTIVE.value
        ).all()

        return [
            {
                "member_id": m.id,
                "agent_id": m.agent_id,
                "role": m.role,
                "status": m.status,
                "joined_at": m.joined_at,
            }
            for m in members
        ]

    # ── Messaging ──────────────────────────────────────────

    def send_message(self, payload: MessagePayload) -> TeamOperationResult:
        """
        Send a message between agents.

        Reference: Claude Code SendMessageTool

        Supports:
        - Direct message (to specific agent)
        - Broadcast (to = "*")
        - Structured messages (shutdown, plan approval)
        """
        if payload.to_agent_id == "*":
            return self._broadcast_message(payload)
        return self._direct_message(payload)

    def _direct_message(self, payload: MessagePayload) -> TeamOperationResult:
        """Send a direct message to a specific agent."""
        msg_id = f"msg-{uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        msg = AgentMessage(
            id=msg_id,
            from_agent_id=payload.from_agent_id,
            to_agent_id=payload.to_agent_id,
            team_id=payload.team_id,
            message_type=payload.message_type.value if hasattr(payload.message_type, 'value') else payload.message_type,
            content=payload.content,
            metadata_json=json.dumps(payload.metadata) if payload.metadata else None,
            status="pending",
            created_at=now,
        )
        self._db.add(msg)
        self._db.commit()

        return TeamOperationResult(
            success=True,
            message=f"Message sent to {payload.to_agent_id}",
            data={"message_id": msg_id},
        )

    def _broadcast_message(self, payload: MessagePayload) -> TeamOperationResult:
        """Broadcast a message to all team members."""
        if not payload.team_id:
            return TeamOperationResult(
                success=False,
                message="Team ID required for broadcast",
            )

        members = self._db.query(AgentTeamMember).filter_by(
            team_id=payload.team_id, status=MemberStatus.ACTIVE.value
        ).all()

        sent_count = 0
        for member in members:
            if member.agent_id == payload.from_agent_id:
                continue  # Don't send to self

            msg_id = f"msg-{uuid4().hex[:12]}"
            now = datetime.now(timezone.utc).isoformat()

            msg = AgentMessage(
                id=msg_id,
                from_agent_id=payload.from_agent_id,
                to_agent_id=member.agent_id,
                team_id=payload.team_id,
                message_type=MessageType.BROADCAST.value,
                content=payload.content,
                metadata_json=json.dumps(payload.metadata) if payload.metadata else None,
                status="pending",
                created_at=now,
            )
            self._db.add(msg)
            sent_count += 1

        self._db.commit()

        return TeamOperationResult(
            success=True,
            message=f"Broadcast sent to {sent_count} members",
            data={"sent_count": sent_count},
        )

    def get_pending_messages(self, agent_id: str) -> list[dict[str, Any]]:
        """Get all pending messages for an agent."""
        messages = self._db.query(AgentMessage).filter_by(
            to_agent_id=agent_id, status="pending"
        ).order_by(AgentMessage.created_at).all()

        result = []
        for msg in messages:
            result.append({
                "id": msg.id,
                "from": msg.from_agent_id,
                "to": msg.to_agent_id,
                "type": msg.message_type,
                "content": msg.content,
                "metadata": json.loads(msg.metadata_json) if msg.metadata_json else {},
                "created_at": msg.created_at,
            })

        return result

    def mark_message_delivered(self, message_id: str) -> None:
        """Mark a message as delivered."""
        msg = self._db.query(AgentMessage).filter_by(id=message_id).first()
        if msg:
            msg.status = "delivered"
            msg.delivered_at = datetime.now(timezone.utc).isoformat()
            self._db.commit()

    def get_message_history(
        self,
        team_name: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Get message history for a team."""
        team = self._db.query(AgentTeam).filter_by(name=team_name).first()
        if not team:
            return []

        messages = self._db.query(AgentMessage).filter_by(
            team_id=team.id
        ).order_by(AgentMessage.created_at.desc()).limit(limit).all()

        return [
            {
                "id": msg.id,
                "from": msg.from_agent_id,
                "to": msg.to_agent_id,
                "type": msg.message_type,
                "content": msg.content[:200],
                "status": msg.status,
                "created_at": msg.created_at,
            }
            for msg in reversed(messages)
        ]
