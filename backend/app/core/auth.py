"""Optional API Key authentication middleware."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.core.config import settings


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """If API_KEY env is set, require X-API-Key header for /api/** routes."""
    async def dispatch(self, request, call_next):
        api_key = getattr(settings, "api_key", None)
        if api_key and request.url.path.startswith("/api"):
            provided = request.headers.get("X-API-Key")
            if provided != api_key:
                return JSONResponse(status_code=401, content={"detail": "Invalid or missing API key"})
        return await call_next(request)
