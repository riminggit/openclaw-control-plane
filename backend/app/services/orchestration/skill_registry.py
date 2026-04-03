"""
SkillRegistry — Skill registration, discovery, and execution for OpenClaw v3.

Manages bundled and custom skills:
- Register/unregister skills
- Skill discovery by name, category, or capability
- Skill execution with context injection
- Skill file extraction for bundled skills

Reference: Claude Code src/skills/bundledSkills.ts, src/tools/SkillTool/
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


# ============================================================
# Data Types
# ============================================================

class SkillContext(str, Enum):
    """Execution context for a skill."""
    INLINE = "inline"       # Execute in current agent context
    FORK = "fork"           # Fork a subagent for execution


@dataclass
class SkillDefinition:
    """
    Definition of a skill that can be registered and invoked.

    Reference: Claude Code BundledSkillDefinition
    """
    name: str
    description: str
    aliases: list[str] = field(default_factory=list)
    when_to_use: str = ""
    allowed_tools: list[str] = field(default_factory=list)
    disallowed_tools: list[str] = field(default_factory=list)
    argument_hint: Optional[str] = None
    model: Optional[str] = None
    disable_model_invocation: bool = False
    user_invocable: bool = True
    context: SkillContext = SkillContext.INLINE
    agent: Optional[str] = None  # Associated agent type
    category: str = "custom"
    source: str = "custom"  # bundled, custom, mcp, plugin
    hooks: dict[str, Any] = field(default_factory=dict)
    files: dict[str, str] = field(default_factory=dict)  # Reference files
    is_enabled: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "aliases": self.aliases,
            "when_to_use": self.when_to_use,
            "allowed_tools": self.allowed_tools,
            "disallowed_tools": self.disallowed_tools,
            "argument_hint": self.argument_hint,
            "model": self.model,
            "context": self.context.value,
            "agent": self.agent,
            "category": self.category,
            "source": self.source,
            "user_invocable": self.user_invocable,
            "is_enabled": self.is_enabled,
        }


@dataclass
class SkillExecutionResult:
    """Result of a skill execution."""
    skill_name: str
    success: bool
    output: str
    prompt_blocks: list[dict[str, Any]] = field(default_factory=list)
    variables: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    duration_ms: int = 0


# ============================================================
# Skill Registry
# ============================================================

class SkillRegistry:
    """
    Central registry for skills.

    Inspired by Claude Code's skill system:
    - Bundled skills (built-in, ship with the platform)
    - Custom skills (user-defined, loaded from directory)
    - MCP skill builders (auto-generated from MCP tools)
    - Plugin skills (contributed by plugins)

    Key features:
    - Name and alias-based lookup
    - Category-based filtering
    - When-to-use hints for automatic skill suggestion
    - Tool allowlist/denylist per skill
    - Execution context (inline vs fork)
    """

    def __init__(self):
        self._skills: dict[str, SkillDefinition] = {}
        self._aliases: dict[str, str] = {}  # alias -> skill name
        self._executors: dict[str, Callable] = {}

    # ── Registration ───────────────────────────────────────

    def register_skill(
        self,
        definition: SkillDefinition,
        executor: Optional[Callable] = None,
    ) -> None:
        """
        Register a skill.

        Args:
            definition: Skill definition
            executor: Optional callable for skill execution
        """
        self._skills[definition.name] = definition

        # Register aliases
        for alias in definition.aliases:
            self._aliases[alias] = definition.name

        # Register executor
        if executor:
            self._executors[definition.name] = executor

        logger.info(f"Registered skill: {definition.name} (source={definition.source})")

    def unregister_skill(self, name: str) -> bool:
        """Unregister a skill by name."""
        skill = self._skills.pop(name, None)
        if not skill:
            return False

        # Remove aliases
        for alias in skill.aliases:
            self._aliases.pop(alias, None)

        # Remove executor
        self._executors.pop(name, None)

        logger.info(f"Unregistered skill: {name}")
        return True

    def register_executor(self, skill_name: str, executor: Callable) -> None:
        """Register an executor for a skill."""
        self._executors[skill_name] = executor

    # ── Lookup ─────────────────────────────────────────────

    def get_skill(self, name: str) -> Optional[SkillDefinition]:
        """Get a skill by name or alias."""
        # Direct lookup
        skill = self._skills.get(name)
        if skill:
            return skill

        # Alias lookup
        canonical_name = self._aliases.get(name)
        if canonical_name:
            return self._skills.get(canonical_name)

        return None

    def list_skills(
        self,
        category: Optional[str] = None,
        source: Optional[str] = None,
        user_invocable_only: bool = False,
    ) -> list[SkillDefinition]:
        """
        List skills with optional filtering.

        Args:
            category: Filter by category
            source: Filter by source (bundled/custom/mcp/plugin)
            user_invocable_only: Only include user-invocable skills
        """
        result = []
        for skill in self._skills.values():
            if not skill.is_enabled:
                continue
            if category and skill.category != category:
                continue
            if source and skill.source != source:
                continue
            if user_invocable_only and not skill.user_invocable:
                continue
            result.append(skill)
        return result

    def find_relevant_skills(self, task_description: str) -> list[SkillDefinition]:
        """
        Find skills relevant to a task description.

        Uses when_to_use hints and description matching.
        """
        task_lower = task_description.lower()
        scored: list[tuple[float, SkillDefinition]] = []

        for skill in self._skills.values():
            if not skill.is_enabled or not skill.user_invocable:
                continue

            score = 0.0

            # Check when_to_use
            if skill.when_to_use and skill.when_to_use.lower() in task_lower:
                score += 2.0

            # Check description keywords
            desc_words = skill.description.lower().split()
            for word in desc_words:
                if word in task_lower:
                    score += 0.5

            # Check name match
            if skill.name.lower() in task_lower:
                score += 1.0

            # Check aliases
            for alias in skill.aliases:
                if alias.lower() in task_lower:
                    score += 1.0

            if score > 0:
                scored.append((score, skill))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [skill for _, skill in scored]

    # ── Execution ──────────────────────────────────────────

    async def execute_skill(
        self,
        name: str,
        args: str = "",
        context: Optional[dict[str, Any]] = None,
    ) -> SkillExecutionResult:
        """
        Execute a skill.

        Args:
            name: Skill name or alias
            args: Arguments string
            context: Execution context

        Returns:
            SkillExecutionResult
        """
        skill = self.get_skill(name)
        if not skill:
            return SkillExecutionResult(
                skill_name=name,
                success=False,
                output="",
                error=f"Skill '{name}' not found",
            )

        if not skill.is_enabled:
            return SkillExecutionResult(
                skill_name=skill.name,
                success=False,
                output="",
                error=f"Skill '{skill.name}' is disabled",
            )

        start_time = datetime.now(timezone.utc)

        try:
            executor = self._executors.get(skill.name)
            if executor:
                result = await executor(args, context or {})
                if isinstance(result, dict):
                    output = result.get("output", "")
                    prompt_blocks = result.get("prompt_blocks", [])
                    variables = result.get("variables", {})
                elif isinstance(result, str):
                    output = result
                    prompt_blocks = [{"type": "text", "text": result}]
                    variables = {}
                else:
                    output = str(result)
                    prompt_blocks = [{"type": "text", "text": output}]
                    variables = {}
            else:
                # Default: generate prompt blocks from skill definition
                output = self._generate_default_output(skill, args)
                prompt_blocks = [{"type": "text", "text": output}]
                variables = {}

            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            return SkillExecutionResult(
                skill_name=skill.name,
                success=True,
                output=output,
                prompt_blocks=prompt_blocks,
                variables=variables,
                duration_ms=duration_ms,
            )

        except Exception as e:
            logger.error(f"Skill execution failed: {skill.name}: {e}")
            return SkillExecutionResult(
                skill_name=skill.name,
                success=False,
                output="",
                error=str(e),
            )

    def _generate_default_output(self, skill: SkillDefinition, args: str) -> str:
        """Generate default output when no executor is registered."""
        parts = [
            f"# Skill: {skill.name}",
            f"\n{skill.description}",
        ]

        if skill.when_to_use:
            parts.append(f"\n## When to use\n{skill.when_to_use}")

        if args:
            parts.append(f"\n## Arguments\n{args}")

        if skill.allowed_tools:
            parts.append(f"\n## Allowed Tools\n{', '.join(skill.allowed_tools)}")

        if skill.files:
            parts.append(f"\n## Reference Files")
            for path, content in skill.files.items():
                preview = content[:200] + "..." if len(content) > 200 else content
                parts.append(f"\n### {path}\n```\n{preview}\n```")

        return "\n".join(parts)

    # ── Bulk Operations ────────────────────────────────────

    def register_bundled_skills(self) -> None:
        """Register built-in bundled skills."""
        bundled = [
            SkillDefinition(
                name="commit",
                description="Generate a git commit with a meaningful message based on current changes",
                aliases=["git-commit"],
                when_to_use="committing code changes",
                allowed_tools=["Bash", "FileRead"],
                category="git",
                source="bundled",
                argument_hint="<optional commit message hint>",
            ),
            SkillDefinition(
                name="review",
                description="Review code changes for quality, security, and best practices",
                aliases=["code-review", "pr-review"],
                when_to_use="reviewing code or pull requests",
                allowed_tools=["FileRead", "Grep", "Glob"],
                category="review",
                source="bundled",
                argument_hint="<file or PR to review>",
            ),
            SkillDefinition(
                name="verify",
                description="Verify that implementation meets requirements and tests pass",
                aliases=["test", "validate"],
                when_to_use="verifying implementation correctness",
                allowed_tools=["Bash", "FileRead", "Grep"],
                category="verification",
                source="bundled",
                argument_hint="<what to verify>",
            ),
            SkillDefinition(
                name="plan",
                description="Create a structured execution plan for a task",
                aliases=["create-plan"],
                when_to_use="planning before implementation",
                allowed_tools=["FileRead", "Glob", "Grep"],
                category="planning",
                source="bundled",
                context=SkillContext.FORK,
                argument_hint="<task to plan>",
            ),
            SkillDefinition(
                name="explore",
                description="Explore codebase to understand architecture and find relevant code",
                aliases=["investigate", "search"],
                when_to_use="exploring or investigating code",
                allowed_tools=["FileRead", "Glob", "Grep", "Bash"],
                category="research",
                source="bundled",
                context=SkillContext.FORK,
                argument_hint="<what to explore>",
            ),
        ]

        for skill_def in bundled:
            self.register_skill(skill_def)

    def get_stats(self) -> dict[str, Any]:
        """Get registry statistics."""
        by_source: dict[str, int] = {}
        by_category: dict[str, int] = {}

        for skill in self._skills.values():
            by_source[skill.source] = by_source.get(skill.source, 0) + 1
            by_category[skill.category] = by_category.get(skill.category, 0) + 1

        return {
            "total_skills": len(self._skills),
            "total_aliases": len(self._aliases),
            "total_executors": len(self._executors),
            "by_source": by_source,
            "by_category": by_category,
        }
