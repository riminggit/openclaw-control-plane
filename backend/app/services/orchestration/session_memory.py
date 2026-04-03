"""
SessionMemoryService — Automatic session memory extraction for OpenClaw v3.

Automatically maintains a markdown file with notes about the current conversation.
Runs periodically in the background to extract key information without
interrupting the main workflow execution.

Reference: Claude Code src/services/SessionMemory/sessionMemory.ts
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.orchestration import SessionMemory as SessionMemoryModel

logger = logging.getLogger(__name__)


# ============================================================
# Constants
# ============================================================

# Thresholds for triggering memory extraction
DEFAULT_TOOL_CALL_THRESHOLD = 10  # Extract after N tool calls
DEFAULT_MESSAGE_THRESHOLD = 20    # Extract after N messages
DEFAULT_TOKEN_THRESHOLD = 50000   # Extract after N tokens

# Memory scope levels
MEMORY_SCOPE_SESSION = "session"
MEMORY_SCOPE_PROJECT = "project"
MEMORY_SCOPE_USER = "user"


# ============================================================
# Data Types
# ============================================================

@dataclass
class MemoryEntry:
    """A single memory entry."""
    key: str
    value: str
    source: str = "auto"  # auto, manual, agent
    importance: float = 0.5  # 0.0 to 1.0
    tags: list[str] = field(default_factory=list)
    timestamp: str = ""


@dataclass
class MemoryExtractionResult:
    """Result of a memory extraction operation."""
    session_id: str
    entries_extracted: int
    entries_updated: int
    total_entries: int
    memory_text: str
    tokens_used: int = 0


@dataclass
class SessionMemoryConfig:
    """Configuration for session memory extraction."""
    enabled: bool = True
    tool_call_threshold: int = DEFAULT_TOOL_CALL_THRESHOLD
    message_threshold: int = DEFAULT_MESSAGE_THRESHOLD
    token_threshold: int = DEFAULT_TOKEN_THRESHOLD
    max_memory_size: int = 10000  # Max chars for memory text
    extraction_model: str = "default"  # Model to use for extraction
    scope: str = MEMORY_SCOPE_SESSION


@dataclass
class ConversationTurn:
    """Represents a single conversation turn for memory extraction."""
    role: str  # user, assistant, system, tool
    content: str
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    tokens: int = 0
    timestamp: str = ""


# ============================================================
# SessionMemoryService
# ============================================================

class SessionMemoryService:
    """
    Automatic session memory extraction service.

    Inspired by Claude Code's SessionMemory system:
    - Periodically extracts key information from conversations
    - Stores as structured markdown for easy retrieval
    - Supports session, project, and user-level scopes
    - Threshold-based triggering (tool calls, messages, tokens)
    - Background extraction without blocking main workflow

    Key differences from Claude Code:
    - Uses database storage instead of filesystem
    - Extraction is done via pattern matching + templates (not LLM subagent)
    - Supports multi-tenant isolation
    """

    def __init__(
        self,
        db: Optional[Session] = None,
        config: Optional[SessionMemoryConfig] = None,
    ):
        self._db = db
        self._config = config or SessionMemoryConfig()
        self._last_extraction: dict[str, int] = {}  # session_id -> turn_count

    # ── Memory Extraction ──────────────────────────────────

    def should_extract(
        self,
        session_id: str,
        turns: list[ConversationTurn],
        tool_call_count: int = 0,
        total_tokens: int = 0,
    ) -> bool:
        """
        Check if memory extraction should be triggered.

        Based on thresholds:
        - Number of tool calls since last extraction
        - Number of messages since last extraction
        - Total tokens used
        """
        if not self._config.enabled:
            return False

        last_count = self._last_extraction.get(session_id, 0)
        new_turns = len(turns) - last_count

        # Count tool calls in new turns
        new_tool_calls = sum(
            len(t.tool_calls) for t in turns[last_count:]
        )
        new_tool_calls += tool_call_count

        if new_tool_calls >= self._config.tool_call_threshold:
            return True
        if new_turns >= self._config.message_threshold:
            return True
        if total_tokens >= self._config.token_threshold:
            return True

        return False

    def extract_memory(
        self,
        session_id: str,
        turns: list[ConversationTurn],
        scope: str = MEMORY_SCOPE_SESSION,
        project_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> MemoryExtractionResult:
        """
        Extract key information from conversation turns.

        Uses pattern matching and templates to extract:
        - Decisions made
        - Files modified
        - Errors encountered
        - Key findings
        - Task status updates

        Args:
            session_id: Session ID
            turns: Conversation turns to extract from
            scope: Memory scope (session/project/user)
            project_id: Optional project ID for project-scoped memory
            user_id: Optional user ID for user-scoped memory

        Returns:
            MemoryExtractionResult
        """
        existing_entries = self._get_existing_entries(session_id, scope)
        existing_keys = {e.key for e in existing_entries}

        new_entries: list[MemoryEntry] = []
        updated_entries: list[MemoryEntry] = []

        for turn in turns:
            extracted = self._extract_from_turn(turn)
            for entry in extracted:
                if entry.key in existing_keys:
                    # Update existing entry
                    updated_entries.append(entry)
                else:
                    new_entries.append(entry)
                    existing_keys.add(entry.key)

        # Build memory text
        all_entries = existing_entries + new_entries
        memory_text = self._build_memory_text(all_entries)

        # Truncate if too long
        if len(memory_text) > self._config.max_memory_size:
            memory_text = memory_text[:self._config.max_memory_size] + "\n... (truncated)"

        # Persist to database
        if self._db:
            self._persist_memory(session_id, scope, memory_text, project_id, user_id)

        # Update extraction counter
        self._last_extraction[session_id] = len(turns)

        # Estimate tokens used for extraction
        total_text = " ".join(t.content for t in turns)
        tokens_used = max(1, len(total_text) // 4)

        return MemoryExtractionResult(
            session_id=session_id,
            entries_extracted=len(new_entries),
            entries_updated=len(updated_entries),
            total_entries=len(all_entries),
            memory_text=memory_text,
            tokens_used=tokens_used,
        )

    # ── Memory Retrieval ───────────────────────────────────

    def get_memory(
        self,
        session_id: str,
        scope: str = MEMORY_SCOPE_SESSION,
    ) -> Optional[str]:
        """
        Get memory text for a session.

        Args:
            session_id: Session ID
            scope: Memory scope

        Returns:
            Memory text or None
        """
        if not self._db:
            return None

        record = self._db.query(SessionMemoryModel).filter_by(
            scope_id=session_id,
            scope=scope,
        ).first()

        return record.content if record else None

    def get_project_memory(self, project_id: str) -> Optional[str]:
        """Get project-scoped memory."""
        if not self._db:
            return None

        record = self._db.query(SessionMemoryModel).filter_by(
            scope=MEMORY_SCOPE_PROJECT,
            scope_id=project_id,
        ).first()

        return record.content if record else None

    def get_user_memory(self, user_id: str) -> Optional[str]:
        """Get user-scoped memory."""
        if not self._db:
            return None

        record = self._db.query(SessionMemoryModel).filter_by(
            scope=MEMORY_SCOPE_USER,
            scope_id=user_id,
        ).first()

        return record.content if record else None

    def get_memory_for_context(
        self,
        session_id: str,
        project_id: Optional[str] = None,
        user_id: Optional[str] = None,
        max_chars: int = 5000,
    ) -> str:
        """
        Get combined memory for injection into agent context.

        Combines session, project, and user-level memories,
        prioritized by relevance.

        Args:
            session_id: Session ID
            project_id: Optional project ID
            user_id: Optional user ID
            max_chars: Maximum characters to return

        Returns:
            Combined memory text for context injection
        """
        parts = []

        # User-level memory (highest priority - user preferences)
        if user_id:
            user_mem = self.get_user_memory(user_id)
            if user_mem:
                parts.append(f"## User Preferences\n{user_mem}")

        # Project-level memory (project conventions, architecture)
        if project_id:
            proj_mem = self.get_project_memory(project_id)
            if proj_mem:
                parts.append(f"## Project Context\n{proj_mem}")

        # Session-level memory (current session context)
        session_mem = self.get_memory(session_id)
        if session_mem:
            parts.append(f"## Session Memory\n{session_mem}")

        combined = "\n\n".join(parts)

        if len(combined) > max_chars:
            combined = combined[:max_chars] + "\n... (truncated)"

        return combined

    # ── Manual Memory Operations ───────────────────────────

    def add_manual_entry(
        self,
        session_id: str,
        key: str,
        value: str,
        scope: str = MEMORY_SCOPE_SESSION,
        project_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> None:
        """Manually add a memory entry."""
        entry = MemoryEntry(
            key=key,
            value=value,
            source="manual",
            importance=0.8,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        # Get existing and append
        existing = self._get_existing_entries(session_id, scope)
        existing.append(entry)

        memory_text = self._build_memory_text(existing)

        if self._db:
            self._persist_memory(session_id, scope, memory_text, project_id, user_id)

    def clear_memory(
        self,
        session_id: str,
        scope: str = MEMORY_SCOPE_SESSION,
    ) -> None:
        """Clear memory for a session."""
        if not self._db:
            return

        self._db.query(SessionMemoryModel).filter_by(
            scope_id=session_id,
            scope=scope,
        ).delete()
        self._db.commit()

    # ── Private Helpers ────────────────────────────────────

    def _extract_from_turn(self, turn: ConversationTurn) -> list[MemoryEntry]:
        """
        Extract memory entries from a single conversation turn.

        Uses pattern matching to identify:
        - Decisions: "let's use X", "we decided to Y"
        - File changes: tool calls that modify files
        - Errors: error messages and stack traces
        - Findings: "I found that X", "the issue is Y"
        """
        entries = []
        content = turn.content
        now = datetime.now(timezone.utc).isoformat()

        # Extract decisions
        decisions = self._extract_decisions(content)
        for i, decision in enumerate(decisions):
            entries.append(MemoryEntry(
                key=f"decision_{i}",
                value=decision,
                source="auto",
                importance=0.7,
                tags=["decision"],
                timestamp=now,
            ))

        # Extract file modifications from tool calls
        for tool_call in turn.tool_calls:
            file_entries = self._extract_from_tool_call(tool_call)
            entries.extend(file_entries)

        # Extract errors
        errors = self._extract_errors(content)
        for i, error in enumerate(errors):
            entries.append(MemoryEntry(
                key=f"error_{i}",
                value=error,
                source="auto",
                importance=0.8,
                tags=["error"],
                timestamp=now,
            ))

        # Extract findings
        findings = self._extract_findings(content)
        for i, finding in enumerate(findings):
            entries.append(MemoryEntry(
                key=f"finding_{i}",
                value=finding,
                source="auto",
                importance=0.6,
                tags=["finding"],
                timestamp=now,
            ))

        return entries

    def _extract_decisions(self, content: str) -> list[str]:
        """Extract decisions from text."""
        decisions = []
        patterns = [
            r"(?:let's|lets)\s+(use|go with|choose|implement|adopt)\s+(.+?)(?:\.|$)",
            r"(?:we\s+)?(?:decided|agreed)\s+(?:to\s+)?(.+?)(?:\.|$)",
            r"(?:I'll|I will)\s+(.+?)(?:\.|$)",
        ]
        for pattern in patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                if isinstance(match, tuple):
                    match = " ".join(match)
                if len(match) > 10:
                    decisions.append(match.strip())
        return decisions[:5]  # Limit to 5 decisions per turn

    def _extract_errors(self, content: str) -> list[str]:
        """Extract error information from text."""
        errors = []
        patterns = [
            r"(?:error|Error|ERROR)[:\s]+(.+?)(?:\n|$)",
            r"(?:failed|Failed|FAILED)[:\s]+(.+?)(?:\n|$)",
            r"(?:exception|Exception)[:\s]+(.+?)(?:\n|$)",
        ]
        for pattern in patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                if len(match) > 5:
                    errors.append(match.strip()[:200])  # Truncate long errors
        return errors[:3]

    def _extract_findings(self, content: str) -> list[str]:
        """Extract findings and discoveries from text."""
        findings = []
        patterns = [
            r"(?:I\s+)?(?:found|discovered|noticed|observed)\s+(?:that\s+)?(.+?)(?:\.|$)",
            r"(?:the\s+)?(?:issue|problem|root cause)\s+(?:is|was)\s+(.+?)(?:\.|$)",
        ]
        for pattern in patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                if len(match) > 10:
                    findings.append(match.strip()[:200])
        return findings[:3]

    def _extract_from_tool_call(self, tool_call: dict[str, Any]) -> list[MemoryEntry]:
        """Extract memory entries from a tool call."""
        entries = []
        tool_name = tool_call.get("name", "")
        tool_input = tool_call.get("input", {})
        now = datetime.now(timezone.utc).isoformat()

        # File modification tools
        file_tools = {"FileEdit", "FileWrite", "write", "edit", "create"}
        if tool_name in file_tools:
            file_path = tool_input.get("file_path", tool_input.get("path", ""))
            if file_path:
                entries.append(MemoryEntry(
                    key=f"file_modified_{file_path}",
                    value=f"Modified file: {file_path}",
                    source="auto",
                    importance=0.6,
                    tags=["file_change", tool_name],
                    timestamp=now,
                ))

        # Bash/shell commands
        if tool_name in {"Bash", "bash", "shell"}:
            command = tool_input.get("command", "")
            if command and len(command) > 5:
                entries.append(MemoryEntry(
                    key=f"command_{hash(command) % 10000}",
                    value=f"Ran command: {command[:200]}",
                    source="auto",
                    importance=0.4,
                    tags=["command"],
                    timestamp=now,
                ))

        return entries

    def _build_memory_text(self, entries: list[MemoryEntry]) -> str:
        """Build markdown memory text from entries."""
        if not entries:
            return ""

        # Sort by importance (descending)
        sorted_entries = sorted(entries, key=lambda e: e.importance, reverse=True)

        lines = ["# Session Memory", ""]

        # Group by tags
        by_tag: dict[str, list[MemoryEntry]] = {}
        for entry in sorted_entries:
            for tag in entry.tags:
                if tag not in by_tag:
                    by_tag[tag] = []
                by_tag[tag].append(entry)

        # Untagged entries
        untagged = [e for e in sorted_entries if not e.tags]

        # Write tagged sections
        tag_labels = {
            "decision": "## Decisions",
            "file_change": "## File Changes",
            "error": "## Errors Encountered",
            "finding": "## Key Findings",
            "command": "## Commands Run",
        }

        for tag, label in tag_labels.items():
            if tag in by_tag:
                lines.append(label)
                for entry in by_tag[tag]:
                    lines.append(f"- {entry.value}")
                lines.append("")

        # Write untagged entries
        if untagged:
            lines.append("## Other Notes")
            for entry in untagged:
                lines.append(f"- [{entry.key}] {entry.value}")
            lines.append("")

        return "\n".join(lines)

    def _get_existing_entries(
        self,
        session_id: str,
        scope: str,
    ) -> list[MemoryEntry]:
        """Get existing memory entries for a session."""
        if not self._db:
            return []

        record = self._db.query(SessionMemoryModel).filter_by(
            scope_id=session_id,
            scope=scope,
        ).first()

        if not record or not record.content:
            return []

        # Parse markdown back into entries (simplified)
        entries = []
        lines = record.content.split("\n")
        for line in lines:
            if line.startswith("- "):
                value = line[2:].strip()
                if value:
                    entries.append(MemoryEntry(
                        key=f"existing_{len(entries)}",
                        value=value,
                        source="auto",
                        importance=0.5,
                    ))

        return entries

    def _persist_memory(
        self,
        session_id: str,
        scope: str,
        memory_text: str,
        project_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> None:
        """Persist memory to database."""
        if not self._db:
            return

        try:
            # Determine scope_id based on scope
            if scope == MEMORY_SCOPE_PROJECT and project_id:
                scope_id = project_id
            elif scope == MEMORY_SCOPE_USER and user_id:
                scope_id = user_id
            else:
                scope_id = session_id

            record = self._db.query(SessionMemoryModel).filter_by(
                scope_id=scope_id,
                scope=scope,
            ).first()

            now = datetime.now(timezone.utc).isoformat()
            import hashlib
            content_hash = hashlib.sha256(memory_text.encode()).hexdigest()[:32]
            token_count = max(1, len(memory_text) // 4)

            if record:
                record.content = memory_text
                record.content_hash = content_hash
                record.token_count = token_count
                record.version = (record.version or 0) + 1
                record.updated_at = now
            else:
                record = SessionMemoryModel(
                    id=f"mem-{uuid4().hex[:12]}",
                    scope=scope,
                    scope_id=scope_id,
                    content=memory_text,
                    content_hash=content_hash,
                    token_count=token_count,
                    source="auto_extract",
                    version=1,
                    created_at=now,
                    updated_at=now,
                )
                self._db.add(record)

            self._db.commit()
        except Exception as e:
            logger.error(f"Failed to persist session memory: {e}")
            self._db.rollback()
