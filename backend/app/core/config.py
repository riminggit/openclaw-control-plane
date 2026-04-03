import logging
import warnings

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    app_name: str = "OpenClaw Control Plane API"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8080
    database_url: str = "sqlite:///./control_plane.db"
    cors_origins: str = ""  # P0-2: default deny all, must be explicitly configured
    api_key: str | None = None
    # JWT — set JWT_SECRET_KEY in production (never use default outside local dev)
    jwt_secret_key: str = "openclaw-control-plane-dev-jwt-secret-change-me"
    # Whether to require authentication (set to True in production)
    require_auth: bool = False

    # ============================================================
    # v3 Feature Flags (all default to False — opt-in)
    # ============================================================

    # Core orchestration
    orchestration_v3_enabled: bool = False
    orchestration_profile_v2_enabled: bool = False
    plan_subtask_v2_enabled: bool = False

    # Agent capabilities
    coordinator_mode_enabled: bool = False
    swarm_mode_enabled: bool = False
    verification_agent_enabled: bool = False
    fork_subagent_enabled: bool = False
    worktree_isolation_enabled: bool = False

    # Intelligence features
    plan_mode_enabled: bool = False
    context_management_enabled: bool = False
    session_memory_enabled: bool = False
    cost_tracking_enabled: bool = False

    # Tool & extension features
    skills_system_enabled: bool = False
    mcp_dynamic_discovery_enabled: bool = False
    plugin_system_enabled: bool = False
    lsp_integration_enabled: bool = False
    cron_triggers_enabled: bool = False

    # ============================================================
    # v3 LLM Configuration
    # ============================================================

    anthropic_api_key: str | None = None
    default_model: str = "claude-sonnet-4-20250514"
    max_context_tokens: int = 200000

    # Context management
    auto_compact_threshold: float = 0.8
    micro_compact_threshold: float = 0.6

    # Cost tracking
    cost_budget_alert_threshold: float = 100.0

    # MCP configuration
    mcp_connection_timeout: int = 30
    mcp_tool_cache_ttl: int = 300

    # Memory system
    memory_extraction_interval: int = 10
    memory_max_size_kb: int = 100

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()

# Warn if using insecure defaults in non-dev environments
if settings.app_env != "dev":
    if settings.jwt_secret_key == "openclaw-control-plane-dev-jwt-secret-change-me":
        warnings.warn(
            "SECURITY WARNING: Using default JWT secret key in non-dev environment! "
            "Set JWT_SECRET_KEY environment variable immediately.",
            stacklevel=2,
        )
    if not settings.require_auth:
        warnings.warn(
            "SECURITY WARNING: Authentication is not required in non-dev environment! "
            "Set REQUIRE_AUTH=true environment variable.",
            stacklevel=2,
        )
