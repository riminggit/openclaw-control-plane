from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.auth import ApiKeyMiddleware
from app.db import init_db, seed_db
from app.api.routes import router
from app.api.ws_proxy import router as ws_router
from app.api.analytics import router as analytics_router
from app.api.lifecycle import router as lifecycle_router
from app.api.chat import router as chat_router
from app.api.kanban import router as kanban_router
from app.api.agents_mgmt import router as agents_mgmt_router
from app.api.channels import router as channels_router
from app.api.logs import router as logs_router
from app.api.services import router as services_router
from app.api.skills import router as skills_router
from app.api.memory import router as memory_router
from app.api.usage import router as usage_router
from app.api.security import router as security_router
from app.api.extensions import router as extensions_router
from app.api.communication import router as communication_router
from app.api.gateway_rest import router as gateway_rest_router
from app.api.agent_skills import router as agent_skills_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_db()
    yield


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)

origins = [item.strip() for item in settings.cors_origins.split(",") if item.strip()]
# M-09: In dev mode, allow common local development origins as fallback
if not origins and settings.app_env == "dev":
    origins = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else [],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    allow_credentials=True,
)
app.include_router(router)
app.include_router(ws_router)
app.include_router(analytics_router)
app.include_router(lifecycle_router)
app.include_router(chat_router)
app.include_router(kanban_router)
app.include_router(agents_mgmt_router)
app.include_router(channels_router)
app.include_router(logs_router)
app.include_router(services_router)
app.include_router(skills_router)
app.include_router(memory_router)
app.include_router(usage_router)
app.include_router(security_router)
app.include_router(extensions_router)
app.include_router(gateway_rest_router)
app.include_router(communication_router)
app.include_router(agent_skills_router)
from app.api.workflow.templates import router as workflow_router
from app.api.workflow.ops import router as workflow_ops_router
from app.api.workflow.instances import router as workflow_instances_router
app.include_router(workflow_router)
app.include_router(workflow_ops_router)
app.include_router(workflow_instances_router)
from app.api.thoughts import router as thoughts_router
app.include_router(thoughts_router)
from app.api.progress import router as progress_router
from app.api.model_config import router as model_config_router
app.include_router(progress_router)
app.include_router(model_config_router)

# v3 API routes
from app.api.v2.feature_flags import router as v2_feature_flags_router
app.include_router(v2_feature_flags_router)

# Phase 3 v2 API routes
from app.api.v2.verification import router as v2_verification_router
from app.api.v2.plugins import router as v2_plugins_router
from app.api.v2.cron import router as v2_cron_router
from app.api.v2.triggers import router as v2_triggers_router
from app.api.v2.lsp import router as v2_lsp_router
app.include_router(v2_verification_router)
app.include_router(v2_plugins_router)
app.include_router(v2_cron_router)
app.include_router(v2_triggers_router)
app.include_router(v2_lsp_router)

# M-10: ApiKeyMiddleware added BEFORE CORSMiddleware so it executes AFTER CORS
# (Starlette middleware executes in reverse order of addition)
app.add_middleware(ApiKeyMiddleware)


@app.get("/")
def root() -> dict[str, str]:
    return {"name": settings.app_name, "status": "running", "version": "0.2.0", "docs": "/docs"}
