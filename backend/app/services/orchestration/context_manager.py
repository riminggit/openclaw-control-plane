"""
ContextManager — Token budget estimation and auto-compact for OpenClaw v3.

Manages the context window for agent sessions:
1. Token estimation before API calls
2. Auto-compact when approaching context limits
3. Micro-compact for low-value message pruning
4. Token budget allocation across tools and messages

Reference: Claude Code src/services/compact/, src/query/tokenBudget.ts
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ============================================================
# Constants
# ============================================================

# Average characters per token (rough estimate for English + code)
CHARS_PER_TOKEN = 4.0

# Default context window sizes by model family
MODEL_CONTEXT_WINDOWS: dict[str, int] = {
    "claude-sonnet": 200000,
    "claude-opus": 200000,
    "claude-haiku": 200000,
    "gpt-4": 128000,
    "gpt-4o": 128000,
    "gpt-4-turbo": 128000,
    "default": 128000,
}

# Default max output tokens by model family
MODEL_MAX_OUTPUT: dict[str, int] = {
    "claude-sonnet": 8192,
    "claude-opus": 8192,
    "claude-haiku": 8192,
    "gpt-4": 4096,
    "gpt-4o": 4096,
    "default": 4096,
}

# Compact thresholds
COMPACT_THRESHOLD_RATIO = 0.80  # Trigger compact at 80% of context window
MICRO_COMPACT_THRESHOLD_RATIO = 0.70  # Trigger micro-compact at 70%
HARD_LIMIT_RATIO = 0.95  # Force compact at 95%


# ============================================================
# Data Types
# ============================================================

class CompactStrategy(str, Enum):
    """Compaction strategies."""
    NONE = "none"
    MICRO = "micro"       # Remove low-value messages only
    AUTO = "auto"         # Summarize older messages
    FULL = "full"         # Full conversation summary


@dataclass
class TokenUsage:
    """Token usage for a single message or turn."""
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_tokens: int = 0
    cache_read_tokens: int = 0


@dataclass
class TokenBudget:
    """
    Token budget allocation for a workflow step.

    Inspired by Claude Code's tokenBudget.ts:
    - System prompt gets a fixed allocation
    - Tools get allocated based on their expected usage
    - History messages fill remaining space
    - Reserve buffer for output
    """
    total_budget: int
    system_prompt_tokens: int = 0
    tool_definitions_tokens: int = 0
    history_tokens: int = 0
    output_reserve_tokens: int = 0
    available_for_input: int = 0

    def to_dict(self) -> dict[str, int]:
        return {
            "total_budget": self.total_budget,
            "system_prompt": self.system_prompt_tokens,
            "tool_definitions": self.tool_definitions_tokens,
            "history": self.history_tokens,
            "output_reserve": self.output_reserve_tokens,
            "available_for_input": self.available_for_input,
        }


@dataclass
class Message:
    """Represents a conversation message."""
    role: str  # system, user, assistant, tool_result
    content: str
    tokens: int = 0
    importance: float = 1.0  # 0.0 (low) to 1.0 (critical)
    message_type: str = "text"  # text, tool_call, tool_result, system
    metadata: dict[str, Any] = field(default_factory=dict)

    def estimate_tokens(self) -> int:
        """Estimate token count for this message."""
        if self.tokens > 0:
            return self.tokens
        # Rough estimation: chars / 4 + overhead
        overhead = 10  # role tags, formatting
        return max(1, int(len(self.content) / CHARS_PER_TOKEN) + overhead)


@dataclass
class CompactResult:
    """Result of a compaction operation."""
    strategy: CompactStrategy
    original_count: int
    compacted_count: int
    tokens_before: int
    tokens_after: int
    summary: Optional[str] = None
    removed_indices: list[int] = field(default_factory=list)


# ============================================================
# ContextManager
# ============================================================

class ContextManager:
    """
    Manages context window for agent sessions.

    Responsibilities:
    1. Estimate token counts for messages
    2. Allocate token budgets across components
    3. Detect when compaction is needed
    4. Perform micro-compact (remove low-value messages)
    5. Perform auto-compact (summarize older messages)

    Design follows Claude Code's compact system:
    - Threshold-based triggering (80% for auto, 70% for micro)
    - Importance-based message prioritization
    - Summary generation for compacted messages
    """

    def __init__(self, model: str = "default"):
        self._model = model
        self._context_window = self._get_context_window(model)
        self._max_output = self._get_max_output(model)

    # ── Token Estimation ───────────────────────────────────

    def estimate_tokens(self, text: str) -> int:
        """
        Estimate token count for a text string.

        Uses character-based estimation. For production,
        this should be replaced with actual tokenizer (tiktoken, etc.)

        Reference: Claude Code src/services/tokenEstimation.ts
        """
        if not text:
            return 0
        # Adjust for code content (typically more tokens per char)
        code_ratio = 1.0
        if any(marker in text for marker in ["def ", "class ", "function ", "import ", "=>"]):
            code_ratio = 1.2
        return max(1, int(len(text) / CHARS_PER_TOKEN * code_ratio))

    def estimate_messages_tokens(self, messages: list[Message]) -> int:
        """Estimate total token count for a list of messages."""
        return sum(msg.estimate_tokens() for msg in messages)

    def estimate_api_tokens(self, messages: list[dict[str, Any]]) -> int:
        """
        Estimate tokens for API-format messages.

        Args:
            messages: List of message dicts with 'role' and 'content'
        """
        total = 0
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                total += self.estimate_tokens(content)
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, dict):
                        text = block.get("text", "")
                        total += self.estimate_tokens(text)
            total += 10  # message overhead
        return total

    # ── Budget Allocation ──────────────────────────────────

    def allocate_budget(
        self,
        system_prompt: str = "",
        tool_definitions: list[dict] = None,
        output_reserve_ratio: float = 0.15,
    ) -> TokenBudget:
        """
        Allocate token budget across components.

        Reference: Claude Code src/query/tokenBudget.ts

        Args:
            system_prompt: System prompt text
            tool_definitions: Tool definition dicts
            output_reserve_ratio: Ratio of budget reserved for output
        """
        total = self._context_window

        # System prompt tokens
        sys_tokens = self.estimate_tokens(system_prompt) if system_prompt else 0

        # Tool definition tokens
        tool_tokens = 0
        if tool_definitions:
            for tool_def in tool_definitions:
                tool_tokens += self.estimate_tokens(json.dumps(tool_def))

        # Output reserve
        output_reserve = int(total * output_reserve_ratio)
        max_output = self._max_output
        output_reserve = max(output_reserve, max_output)

        # Available for input (history + user messages)
        available = total - sys_tokens - tool_tokens - output_reserve
        available = max(0, available)

        return TokenBudget(
            total_budget=total,
            system_prompt_tokens=sys_tokens,
            tool_definitions_tokens=tool_tokens,
            output_reserve_tokens=output_reserve,
            available_for_input=available,
        )

    # ── Compact Detection ──────────────────────────────────

    def should_compact(
        self,
        messages: list[Message],
        budget: Optional[TokenBudget] = None,
    ) -> CompactStrategy:
        """
        Determine if compaction is needed and which strategy to use.

        Returns:
            CompactStrategy to apply
        """
        if not budget:
            budget = self.allocate_budget()

        current_tokens = self.estimate_messages_tokens(messages)
        ratio = current_tokens / budget.total_budget if budget.total_budget > 0 else 0

        if ratio >= HARD_LIMIT_RATIO:
            return CompactStrategy.FULL
        elif ratio >= COMPACT_THRESHOLD_RATIO:
            return CompactStrategy.AUTO
        elif ratio >= MICRO_COMPACT_THRESHOLD_RATIO:
            return CompactStrategy.MICRO
        return CompactStrategy.NONE

    def get_usage_ratio(
        self,
        messages: list[Message],
        budget: Optional[TokenBudget] = None,
    ) -> float:
        """Get current context usage ratio (0.0 to 1.0)."""
        if not budget:
            budget = self.allocate_budget()
        current = self.estimate_messages_tokens(messages)
        return current / budget.total_budget if budget.total_budget > 0 else 0.0

    # ── Compact Operations ─────────────────────────────────

    def compact_messages(
        self,
        messages: list[Message],
        strategy: Optional[CompactStrategy] = None,
        budget: Optional[TokenBudget] = None,
    ) -> CompactResult:
        """
        Compact messages using the specified strategy.

        Args:
            messages: Message list to compact
            strategy: Compaction strategy (auto-detected if None)
            budget: Token budget (auto-allocated if None)

        Returns:
            CompactResult with compacted messages info
        """
        if not budget:
            budget = self.allocate_budget()

        if strategy is None:
            strategy = self.should_compact(messages, budget)

        tokens_before = self.estimate_messages_tokens(messages)

        if strategy == CompactStrategy.NONE:
            return CompactResult(
                strategy=strategy,
                original_count=len(messages),
                compacted_count=len(messages),
                tokens_before=tokens_before,
                tokens_after=tokens_before,
            )

        if strategy == CompactStrategy.MICRO:
            return self._micro_compact(messages, budget, tokens_before)

        if strategy == CompactStrategy.AUTO:
            return self._auto_compact(messages, budget, tokens_before)

        if strategy == CompactStrategy.FULL:
            return self._full_compact(messages, budget, tokens_before)

        return CompactResult(
            strategy=CompactStrategy.NONE,
            original_count=len(messages),
            compacted_count=len(messages),
            tokens_before=tokens_before,
            tokens_after=tokens_before,
        )

    def _micro_compact(
        self,
        messages: list[Message],
        budget: TokenBudget,
        tokens_before: int,
    ) -> CompactResult:
        """
        Micro-compact: remove low-value messages only.

        Removes messages with low importance scores:
        - Tool result details (importance < 0.3)
        - Long system messages (importance < 0.5)
        - Redundant assistant messages (importance < 0.4)

        Reference: Claude Code src/services/compact/microCompact.ts
        """
        target_tokens = int(budget.total_budget * MICRO_COMPACT_THRESHOLD_RATIO * 0.85)
        removed_indices = []
        kept_messages = []

        # Sort by importance (ascending) to identify removable messages
        indexed = [(i, msg) for i, msg in enumerate(messages)]

        # First pass: mark low-importance messages for removal
        removable = []
        for i, msg in indexed:
            if msg.importance < 0.3:
                removable.append((i, msg))

        # Sort removable by importance (lowest first)
        removable.sort(key=lambda x: x[1].importance)

        current_tokens = tokens_before
        remove_set = set()

        for idx, msg in removable:
            if current_tokens <= target_tokens:
                break
            current_tokens -= msg.estimate_tokens()
            remove_set.add(idx)
            removed_indices.append(idx)

        # Build kept messages list
        for i, msg in enumerate(messages):
            if i not in remove_set:
                kept_messages.append(msg)

        return CompactResult(
            strategy=CompactStrategy.MICRO,
            original_count=len(messages),
            compacted_count=len(kept_messages),
            tokens_before=tokens_before,
            tokens_after=current_tokens,
            removed_indices=removed_indices,
        )

    def _auto_compact(
        self,
        messages: list[Message],
        budget: TokenBudget,
        tokens_before: int,
    ) -> CompactResult:
        """
        Auto-compact: summarize older messages.

        Replaces older messages with a summary block, keeping:
        - System messages (importance >= 0.8)
        - Last N messages (recent context)
        - Messages explicitly marked as important

        Reference: Claude Code src/services/compact/autoCompact.ts
        """
        target_tokens = int(budget.total_budget * COMPACT_THRESHOLD_RATIO * 0.75)

        # Always keep: first system message + last 6 messages
        keep_first = 1 if messages and messages[0].role == "system" else 0
        keep_last = 6
        keep_last = min(keep_last, len(messages))

        # Messages to potentially summarize
        summarizable = messages[keep_first:len(messages) - keep_last]
        kept = list(messages[:keep_first]) + list(messages[len(messages) - keep_last:])

        # Build summary of removed messages
        summary_parts = []
        removed_indices = []
        current_tokens = self.estimate_messages_tokens(kept)

        for i, msg in enumerate(summarizable):
            real_index = keep_first + i
            if msg.importance >= 0.8:
                kept.insert(keep_first + len(summary_parts), msg)
                current_tokens += msg.estimate_tokens()
            else:
                removed_indices.append(real_index)
                # Add brief summary
                preview = msg.content[:200] + "..." if len(msg.content) > 200 else msg.content
                summary_parts.append(f"[{msg.role}]: {preview}")

        # Create summary message
        summary_text = ""
        if summary_parts:
            summary_text = "## Compacted Context\n\n"
            summary_text += f"The following {len(summary_parts)} messages were compacted:\n\n"
            summary_text += "\n".join(f"- {p}" for p in summary_parts[:20])

            summary_msg = Message(
                role="system",
                content=summary_text,
                importance=0.6,
                message_type="system",
                metadata={"compact": True, "original_count": len(summary_parts)},
            )
            kept.insert(keep_first, summary_msg)

        tokens_after = self.estimate_messages_tokens(kept)

        return CompactResult(
            strategy=CompactStrategy.AUTO,
            original_count=len(messages),
            compacted_count=len(kept),
            tokens_before=tokens_before,
            tokens_after=tokens_after,
            summary=summary_text,
            removed_indices=removed_indices,
        )

    def _full_compact(
        self,
        messages: list[Message],
        budget: TokenBudget,
        tokens_before: int,
    ) -> CompactResult:
        """
        Full compact: aggressive summarization.

        Keeps only:
        - Original system prompt
        - Summary of all conversation
        - Last 2 messages

        Reference: Claude Code src/services/compact/compact.ts
        """
        # Keep system prompt + last 2 messages
        keep_first = 1 if messages and messages[0].role == "system" else 0
        keep_last = min(2, len(messages))

        kept = list(messages[:keep_first]) + list(messages[-keep_last:])

        # Summarize everything in between
        middle = messages[keep_first:len(messages) - keep_last]
        removed_indices = list(range(keep_first, len(messages) - keep_last))

        summary_parts = []
        for msg in middle:
            preview = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
            summary_parts.append(f"[{msg.role}]: {preview}")

        summary_text = ""
        if summary_parts:
            summary_text = "## Full Conversation Summary\n\n"
            summary_text += f"Summary of {len(summary_parts)} prior messages:\n\n"
            summary_text += "\n".join(f"- {p}" for p in summary_parts[:30])

            summary_msg = Message(
                role="system",
                content=summary_text,
                importance=0.7,
                message_type="system",
                metadata={"compact": True, "strategy": "full", "original_count": len(summary_parts)},
            )
            kept.insert(keep_first, summary_msg)

        tokens_after = self.estimate_messages_tokens(kept)

        return CompactResult(
            strategy=CompactStrategy.FULL,
            original_count=len(messages),
            compacted_count=len(kept),
            tokens_before=tokens_before,
            tokens_after=tokens_after,
            summary=summary_text,
            removed_indices=removed_indices,
        )

    # ── Helpers ────────────────────────────────────────────

    @staticmethod
    def _get_context_window(model: str) -> int:
        """Get context window size for a model."""
        model_lower = model.lower()
        for key, window in MODEL_CONTEXT_WINDOWS.items():
            if key in model_lower:
                return window
        return MODEL_CONTEXT_WINDOWS["default"]

    @staticmethod
    def _get_max_output(model: str) -> int:
        """Get max output tokens for a model."""
        model_lower = model.lower()
        for key, max_out in MODEL_MAX_OUTPUT.items():
            if key in model_lower:
                return max_out
        return MODEL_MAX_OUTPUT["default"]

    def get_context_window(self) -> int:
        """Get the context window size for the current model."""
        return self._context_window

    def get_max_output(self) -> int:
        """Get the max output tokens for the current model."""
        return self._max_output
