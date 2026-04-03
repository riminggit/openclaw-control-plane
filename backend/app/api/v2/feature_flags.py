"""
Feature Flags API for OpenClaw v3.

Provides read-only access to feature flag states for admin/debugging.

Reference: docs/requirements/openclaw-v3/07-api-design.md
"""

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user_id
from app.core.feature_flags import FeatureFlags, get_feature_flags

router = APIRouter(prefix="/api/v2", tags=["v3", "feature-flags"])


@router.get("/feature-flags")
async def list_feature_flags(
    user_id: str = Depends(get_current_user_id),
    flags: FeatureFlags = Depends(get_feature_flags),
):
    """
    List all feature flags and their current states.

    Requires authentication. Returns a dictionary of flag names to boolean values.
    """
    return {
        "flags": flags.get_all_flags(),
        "requested_by": user_id,
    }
