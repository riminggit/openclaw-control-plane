"""
LSP Service — Phase 3 P3-12/P3-13

Provides Language Server Protocol integration for real-time
code diagnostics, completions, and analysis.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5
"""

from app.services.lsp.lsp_service import (
    LSPService,
    LSPDiagnostic,
    LSPServerInfo,
    DiagnosticSeverity,
)

__all__ = [
    "LSPService",
    "LSPDiagnostic",
    "LSPServerInfo",
    "DiagnosticSeverity",
    "get_lsp_service",
]

# Singleton instance (stateless — all methods accept db: Session)
_lsp_service: LSPService | None = None


def get_lsp_service() -> LSPService:
    """Get or create the singleton LSPService (stateless)."""
    global _lsp_service
    if _lsp_service is None:
        _lsp_service = LSPService()
    return _lsp_service
