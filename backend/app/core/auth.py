"""
认证核心模块
实现 JWT 认证和用户身份验证
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# HTTP Bearer 认证
security = HTTPBearer(auto_error=False)


class User(BaseModel):
    """用户模型"""
    user_id: str
    username: str
    email: Optional[str] = None
    role: str = "viewer"  # viewer, editor, admin, reviewer
    permissions: list[str] = Field(default_factory=list)


class TokenData(BaseModel):
    """Token 数据（exp 为 Unix 秒，与 PyJWT 一致）"""
    user_id: str
    username: str
    role: str
    exp: Optional[int] = None


def _jwt_secret() -> str:
    return settings.jwt_secret_key


def create_access_token(
    user_id: str,
    username: str,
    role: str = "viewer",
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    创建访问令牌
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": expire,
    }

    encoded_jwt = jwt.encode(to_encode, _jwt_secret(), algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenData]:
    """
    解码访问令牌
    """
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")
        username: str = payload.get("username")
        role: str = payload.get("role", "viewer")

        if user_id is None or username is None:
            return None

        exp_raw = payload.get("exp")
        exp_int: Optional[int] = None
        if isinstance(exp_raw, (int, float)):
            exp_int = int(exp_raw)

        return TokenData(
            user_id=user_id,
            username=username,
            role=role,
            exp=exp_int,
        )
    except jwt.PyJWTError as e:
        logger.error(f"JWT 解码失败: {e}")
        return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    """
    获取当前用户（从 JWT 令牌）
    """
    if credentials is None:
        if settings.app_env == "dev" and not settings.require_auth:
            logger.warning("未提供认证凭证，使用默认用户（仅 app_env=dev 且 require_auth=False）")
            return User(
                user_id="user-001",
                username="developer",
                email="developer@openclaw.local",
                role="admin",
                permissions=["read", "write", "admin", "review"],
            )
        raise HTTPException(
            status_code=401,
            detail={
                "code": "AUTH_REQUIRED",
                "message": "缺少认证凭证",
            },
        )

    token = credentials.credentials
    token_data = decode_access_token(token)

    if token_data is None:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "INVALID_TOKEN",
                "message": "无效的认证令牌",
            }
        )

    if token_data.exp is not None:
        if datetime.fromtimestamp(token_data.exp, tz=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "TOKEN_EXPIRED",
                    "message": "认证令牌已过期",
                }
            )

    permissions: list[str] = []
    if token_data.role == "viewer":
        permissions = ["read"]
    elif token_data.role == "editor":
        permissions = ["read", "write"]
    elif token_data.role == "reviewer":
        permissions = ["read", "review"]
    elif token_data.role == "admin":
        permissions = ["read", "write", "admin", "review"]

    return User(
        user_id=token_data.user_id,
        username=token_data.username,
        role=token_data.role,
        permissions=permissions
    )


async def get_current_user_id(
    current_user: User = Depends(get_current_user)
) -> str:
    """获取当前用户 ID（供路由注入）"""
    return current_user.user_id


def require_permission(permission: str):
    """
    权限检查装饰器工厂
    """
    async def permission_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:
        if permission not in current_user.permissions:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "PERMISSION_DENIED",
                    "message": f"缺少权限: {permission}",
                }
            )
        return current_user

    return permission_checker


# 预定义的权限检查器
require_read = require_permission("read")
require_write = require_permission("write")
require_admin = require_permission("admin")
require_review = require_permission("review")


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """
    当 settings.api_key 已配置时，要求 HTTP 请求携带 X-API-Key 且与配置一致。
    未配置 api_key 时不校验（便于本地开发）。
    WebSocket 连接不经过此中间件（Starlette 限制）；WS 侧依赖 Origin 等其它校验。
    """

    _EXEMPT_PATHS = frozenset({
        "/",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/health",
        "/api/ready",
    })

    async def dispatch(self, request: StarletteRequest, call_next):
        if not settings.api_key:
            return await call_next(request)

        path = request.url.path
        if path in self._EXEMPT_PATHS:
            return await call_next(request)
        if path.startswith("/docs") or path.startswith("/redoc"):
            return await call_next(request)

        header = (
            request.headers.get("x-api-key")
            or request.headers.get("X-API-Key")
            or ""
        ).strip()
        if header != settings.api_key:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key"},
            )
        return await call_next(request)
