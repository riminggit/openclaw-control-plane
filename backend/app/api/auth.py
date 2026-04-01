"""
认证 API
提供登录、注册、令牌刷新等端点
"""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr

from app.core.auth import (
    create_access_token,
    get_current_user,
    User,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
logger = logging.getLogger(__name__)


# ── 请求/响应模型 ───────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """登录请求"""
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6)


class LoginResponse(BaseModel):
    """登录响应"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: User


class RegisterRequest(BaseModel):
    """注册请求"""
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)
    email: Optional[EmailStr] = None


class UserProfileResponse(BaseModel):
    """用户信息响应"""
    user: User


# ── API 端点 ────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    用户登录
    
    开发模式：接受任何用户名和密码，返回测试令牌
    生产模式：需要验证用户名和密码
    """
    logger.info(f"用户登录: username={request.username}")
    
    # 开发模式：简化认证，直接生成令牌
    # 生产模式：需要验证数据库中的用户名和密码
    access_token = create_access_token(
        user_id=f"user-{request.username}",
        username=request.username,
        role="admin"  # 开发模式下给予管理员权限
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=24 * 3600,  # 24小时
        user=User(
            user_id=f"user-{request.username}",
            username=request.username,
            role="admin",
            permissions=["read", "write", "admin", "review"]
        )
    )


@router.post("/register", response_model=UserProfileResponse, status_code=201)
async def register(request: RegisterRequest):
    """
    用户注册
    
    开发模式：总是成功
    生产模式：需要创建用户记录
    """
    logger.info(f"用户注册: username={request.username}")
    
    # 开发模式：简化注册
    # 生产模式：需要将用户信息保存到数据库
    return UserProfileResponse(
        user=User(
            user_id=f"user-{request.username}",
            username=request.username,
            email=request.email,
            role="viewer",
            permissions=["read"]
        )
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户信息
    """
    return UserProfileResponse(user=current_user)


@router.post("/refresh")
async def refresh_token(
    current_user: User = Depends(get_current_user)
):
    """
    刷新访问令牌
    """
    access_token = create_access_token(
        user_id=current_user.user_id,
        username=current_user.username,
        role=current_user.role
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 24 * 3600,
    }


# ── 导出路由器 ──────────────────────────────────────────────────────────

__all__ = ["router"]
