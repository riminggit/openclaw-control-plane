"""
Verification Service — Phase 3 P3-1/P3-2/P3-3

Provides automated verification of agent outputs against acceptance criteria.
Runs as an independent agent that validates implementation quality.

Reference: docs/requirements/openclaw-v3/09-implementation-plan.md §9.5
"""

from app.services.verification.verification_service import (
    VerificationService,
    VerificationResult,
    VerificationReport,
    VerificationStatus,
)

__all__ = [
    "VerificationService",
    "VerificationResult",
    "VerificationReport",
    "VerificationStatus",
    "get_verification_service",
]

# Singleton instance (stateless — all methods accept db: Session)
_verification_service: VerificationService | None = None


def get_verification_service() -> VerificationService:
    """Get or create the singleton VerificationService (stateless)."""
    global _verification_service
    if _verification_service is None:
        _verification_service = VerificationService()
    return _verification_service
