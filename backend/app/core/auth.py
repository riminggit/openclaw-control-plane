"""
认证核心模块
实现 JWT 认证和用户身份验证
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt

logger = logging.getLogger(__name__)

# JWT 配置
SECRET_KEY = "openclaw-control-plane-secret-key-change-in-production"  # 生产环境应该从环境变量读取
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
    permissions: list[str] = []


class TokenData(BaseModel):
    """Token 数据"""
    user_id: str
    username: str
    role: str
    exp: Optional[datetime] = None


def create_access_token(
    user_id: str,
    username: str,
    role: str = "viewer",
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    创建访问令牌
    
    Args:
        user_id: 用户ID
        username: 用户名
        role: 用户角色
        expires_delta: 过期时间增量
        
    Returns:
        JWT 令牌
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
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenData]:
    """
    解码访问令牌
    
    Args:
        token: JWT 令牌
        
    Returns:
        Token 数据，解码失败返回 None
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")
        username: str = payload.get("username")
        role: str = payload.get("role", "viewer")
        
        if user_id is None or username is None:
            return None
        
        return TokenData(
            user_id=user_id,
            username=username,
            role=role,
            exp=payload.get("exp")
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
    
    Args:
        request: 请求对象
        credentials: HTTP Bearer 凭证
        
    Returns:
        当前用户
        
    Raises:
        HTTPException: 认证失败
    """
    # 开发模式：如果未提供凭证，使用默认用户
    if credentials is None:
        logger.warning("未提供认证凭证，使用默认用户（开发模式）")
        return User(
            user_id="user-001",
            username="developer",
            email="developer@openclaw.local",
            role="admin",
            permissions=["read", "write", "admin"]
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
    
    # 检查令牌是否过期
    if token_data.exp and datetime.fromtimestamp(token_data.exp, tz=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "TOKEN_EXPIRED",
                "message": "认证令牌已过期",
            }
        )
    
    # 根据角色设置权限
    permissions = []
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
    """
    获取当前用户ID
    
    Args:
        current_user: 当前用户
        
    Returns:
        用户ID
    """
    return current_user.user_id


def require_permission(permission: str):
    """
    权限检查装饰器工厂
    
    Args:
        permission: 所需权限
        
    Returns:
        依赖函数
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
