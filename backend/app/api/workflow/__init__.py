"""
工作流 API 模块
"""
from .templates import router as templates_router
from .ops import router as ops_router

router = templates_router  # backward compat
