"""Model configuration API - read/write openclaw.json model settings."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

import json, os

router = APIRouter(prefix="/api/model-config", tags=["model-config"])

CONFIG_PATH = os.path.expanduser("~/.openclaw/openclaw.json")

def _load() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)

def _save(cfg: dict) -> None:
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

@router.get("/defaults")
def get_defaults():
    """Get default model settings (primary + fallbacks)."""
    cfg = _load()
    return cfg.get("agents", {}).get("defaults", {}).get("model", {"primary": "", "fallbacks": []})

class DefaultsUpdate(BaseModel):
    primary: str
    fallbacks: list[str]

@router.put("/defaults")
def update_defaults(payload: DefaultsUpdate):
    """Update default model settings."""
    cfg = _load()
    cfg.setdefault("agents", {}).setdefault("defaults", {}).setdefault("model", {})
    cfg["agents"]["defaults"]["model"] = {"primary": payload.primary, "fallbacks": payload.fallbacks}
    _save(cfg)
    return {"ok": True}

@router.get("/providers")
def get_providers():
    """Get all model providers (API keys masked)."""
    cfg = _load()
    providers = cfg.get("models", {}).get("providers", {})
    result = {}
    for name, p in providers.items():
        api_key = p.get("apiKey", "")
        masked = api_key[:6] + "..." + api_key[-4:] if len(api_key) > 10 else "***"
        result[name] = {
            "baseUrl": p.get("baseUrl", ""),
            "apiKey": masked,
            "api": p.get("api", ""),
            "models": p.get("models", []),
        }
    return result

class ProviderModel(BaseModel):
    id: str = ""
    name: str = ""
    reasoning: bool = False
    input: list[str] = []
    contextWindow: int | None = None

class ProviderUpdate(BaseModel):
    baseUrl: str = ""
    apiKey: str = ""
    api: str = ""
    models: list[ProviderModel] = []

@router.put("/providers/{name}")
def update_provider(name: str, payload: ProviderUpdate):
    """Update a provider's config (apiKey, baseUrl, models)."""
    cfg = _load()
    providers = cfg.setdefault("models", {}).setdefault("providers", {})
    existing = providers.get(name, {})
    updated = {**existing}
    if payload.baseUrl:
        updated["baseUrl"] = payload.baseUrl
    if payload.apiKey and payload.apiKey != "***":
        updated["apiKey"] = payload.apiKey
    if payload.api:
        updated["api"] = payload.api
    if payload.models:
        updated["models"] = [{"id": m.id, "name": m.name, "reasoning": m.reasoning, "input": m.input, **({"contextWindow": m.contextWindow} if m.contextWindow else {})} for m in payload.models]
    providers[name] = updated
    _save(cfg)
    return {"ok": True}
