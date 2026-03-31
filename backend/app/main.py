from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.auth import ApiKeyMiddleware
from app.db import init_db, seed_db
from app.api.routes import router
from app.api.ws_proxy import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_db()
    yield


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)

origins = [item.strip() for item in settings.cors_origins.split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(ws_router)
app.add_middleware(ApiKeyMiddleware)


@app.get("/")
def root() -> dict[str, str]:
    return {"name": settings.app_name, "status": "running", "version": "0.2.0", "docs": "/docs"}
