"""
工作流模板 API
实现 12 个工作流模板管理端点
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db import get_db
from app.models.workflow import (
    WorkflowTemplate,
    WorkflowTemplateVersion,
    StepDefinition,
)
from app.schemas.workflow import (
    WorkflowTemplateCreate,
    WorkflowTemplateUpdate,
    WorkflowTemplateResponse,
    WorkflowTemplateListResponse,
    TemplateStatus,
    DAGDefinition,
    WorkflowConfig,
)

# 路由器定义
router = APIRouter(prefix="/api/v1/workflow-templates", tags=["workflow-templates"])

# 日志记录器
logger = logging.getLogger(__name__)


# ── 辅助函数 ───────────────────────────────────────────────────

def _generate_uuid() -> str:
    """生成 UUID"""
    return str(uuid4())


def _get_current_user_id() -> str:
    """获取当前用户 ID（临时硬编码，待集成认证系统）"""
    return "user-001"


def _validate_dag(dag: DAGDefinition) -> List[str]:
    """
    验证 DAG 定义
    
    返回错误消息列表，空列表表示验证通过
    """
    errors = []
    
    # 1. 检查是否有步骤
    if not dag.steps:
        errors.append("DAG 必须包含至少一个步骤")
        return errors
    
    # 2. 检查步骤 ID 是否唯一
    step_ids = [step.id for step in dag.steps]
    if len(step_ids) != len(set(step_ids)):
        errors.append("步骤 ID 必须唯一")
    
    # 3. 检查边引用的节点是否存在
    step_id_set = set(step_ids)
    for edge in dag.edges:
        if edge.source not in step_id_set:
            errors.append(f"边引用的源节点 '{edge.source}' 不存在")
        if edge.target not in step_id_set:
            errors.append(f"边引用的目标节点 '{edge.target}' 不存在")
    
    # 4. 检查是否有起始节点（没有依赖的节点）
    has_start = False
    for step in dag.steps:
        if not step.depends_on:
            has_start = True
            break
    
    if not has_start:
        errors.append("DAG 必须包含至少一个起始节点（无依赖的步骤）")
    
    # 5. TODO: 检查循环依赖（需要实现拓扑排序）
    
    return errors


def _dag_to_json(dag: DAGDefinition) -> str:
    """将 DAG 对象转换为 JSON 字符串"""
    return json.dumps(dag.model_dump(), ensure_ascii=False)


def _config_to_json(config: WorkflowConfig) -> str:
    """将 Config 对象转换为 JSON 字符串"""
    return json.dumps(config.model_dump(), ensure_ascii=False)


def _json_to_dag(json_str: str) -> DAGDefinition:
    """将 JSON 字符串转换为 DAG 对象"""
    return DAGDefinition(**json.loads(json_str))


def _json_to_config(json_str: str) -> WorkflowConfig:
    """将 JSON 字符串转换为 Config 对象"""
    return WorkflowConfig(**json.loads(json_str))


# ── API 端点实现 ────────────────────────────────────────────────────────

@router.get("", response_model=WorkflowTemplateListResponse)
async def list_workflow_templates(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    status: Optional[str] = Query(None, description="状态筛选 (draft/published/archived)"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    tags: Optional[str] = Query(None, description="标签筛选（逗号分隔）"),
    created_by: Optional[str] = Query(None, description="创建者 ID"),
    sort_by: str = Query("created_at", description="排序字段"),
    sort_order: str = Query("desc", description="排序方向 (asc/desc)"),
    db: Session = Depends(get_db),
):
    """
    获取模板列表
    
    权限: viewer
    """
    logger.info(f"获取模板列表: page={page}, page_size={page_size}, status={status}, search={search}")
    
    # 构建查询
    query = db.query(WorkflowTemplate)
    
    # 应用筛选
    if status:
        query = query.filter(WorkflowTemplate.status == status)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                WorkflowTemplate.name.ilike(search_term),
                WorkflowTemplate.description.ilike(search_term),
            )
        )
    
    if created_by:
        query = query.filter(WorkflowTemplate.created_by == created_by)
    
    if tags:
        # TODO: 实现 JSON 标签查询
        pass
    
    # 获取总数
    total = query.count()
    
    # 应用排序
    order_column = getattr(WorkflowTemplate, sort_by, WorkflowTemplate.created_at)
    if sort_order == "desc":
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column.asc())
    
    # 应用分页
    offset = (page - 1) * page_size
    templates = query.offset(offset).limit(page_size).all()
    
    # 计算总页数
    total_pages = (total + page_size - 1) // page_size
    
    # 转换为响应格式
    data = []
    for template in templates:
        dag = _json_to_dag(template.dag)
        config = _json_to_config(template.config)
        
        data.append(WorkflowTemplateResponse(
            id=template.id,
            name=template.name,
            description=template.description,
            version=template.version,
            status=TemplateStatus(template.status),
            dag=dag,
            config=config,
            created_at=template.created_at,
            created_by=template.created_by,
            updated_at=template.updated_at,
            published_at=template.published_at,
            usage_count=template.usage_count,
            tags=json.loads(template.tags) if template.tags else [],
            steps=[{
                "id": step.id,
                "name": step.name,
                "agent": step.agent,
                "estimated_duration": step.estimated_duration,
                "human_review": bool(step.human_review),
            } for step in dag.steps],
        ))
    
    return WorkflowTemplateListResponse(
        data=data,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{template_id}", response_model=WorkflowTemplateResponse)
async def get_workflow_template(
    template_id: str,
    db: Session = Depends(get_db),
):
    """
    获取模板详情
    
    权限: viewer
    """
    logger.info(f"获取模板详情: template_id={template_id}")
    
    # 查询模板
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "TEMPLATE_NOT_FOUND",
                "message": f"模板 {template_id} 不存在",
                "details": {"template_id": template_id}
            }
        )
    
    # 转换为响应格式
    dag = _json_to_dag(template.dag)
    config = _json_to_config(template.config)
    
    return WorkflowTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        version=template.version,
        status=TemplateStatus(template.status),
        dag=dag,
        config=config,
        created_at=template.created_at,
        created_by=template.created_by,
        updated_at=template.updated_at,
        published_at=template.published_at,
        usage_count=template.usage_count,
        tags=json.loads(template.tags) if template.tags else [],
        steps=[{
            "id": step.id,
            "name": step.name,
            "agent": step.agent,
            "estimated_duration": step.estimated_duration,
            "human_review": bool(step.human_review),
        } for step in dag.steps],
    )


@router.post("", response_model=WorkflowTemplateResponse, status_code=201)
async def create_workflow_template(
    request: WorkflowTemplateCreate,
    db: Session = Depends(get_db),
):
    """
    创建模板
    
    权限: editor
    """
    logger.info(f"创建模板: name={request.name}")
    
    # 验证 DAG
    errors = _validate_dag(request.dag)
    if errors:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_DAG",
                "message": "DAG 验证失败",
                "details": {"errors": errors}
            }
        )
    
    # 创建模板记录
    template_id = _generate_uuid()
    now = datetime.now(timezone.utc).isoformat()
    user_id = _get_current_user_id()
    
    template = WorkflowTemplate(
        id=template_id,
        name=request.name,
        description=request.description,
        version="v1.0",
        status="draft",
        dag=_dag_to_json(request.dag),
        config=_config_to_json(request.config),
        created_at=now,
        created_by=user_id,
        updated_at=now,
        published_at=None,
        usage_count=0,
        tags=json.dumps(request.tags, ensure_ascii=False) if request.tags else "[]",
    )
    
    db.add(template)
    
    # 创建步骤定义记录
    for step in request.dag.steps:
        step_def = StepDefinition(
            id=_generate_uuid(),
            template_id=template_id,
            step_id=step.id,
            name=step.name,
            agent=step.agent,
            capabilities=json.dumps(step.capabilities, ensure_ascii=False) if step.capabilities else None,
            estimated_duration=step.estimated_duration,
            human_review=1 if step.human_review else 0,
            depends_on=json.dumps(step.depends_on, ensure_ascii=False) if step.depends_on else "[]",
            created_at=now,
        )
        db.add(step_def)
    
    # 创建初始版本记录
    version = WorkflowTemplateVersion(
        id=_generate_uuid(),
        template_id=template_id,
        version="v1.0",
        dag=_dag_to_json(request.dag),
        config=_config_to_json(request.config),
        change_summary="初始版本",
        created_at=now,
        created_by=user_id,
    )
    db.add(version)
    
    db.commit()
    db.refresh(template)
    
    # 转换为响应格式
    dag = _json_to_dag(template.dag)
    config = _json_to_config(template.config)
    
    return WorkflowTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        version=template.version,
        status=TemplateStatus(template.status),
        dag=dag,
        config=config,
        created_at=template.created_at,
        created_by=template.created_by,
        updated_at=template.updated_at,
        published_at=template.published_at,
        usage_count=template.usage_count,
        tags=json.loads(template.tags) if template.tags else [],
        steps=[{
            "id": step.id,
            "name": step.name,
            "agent": step.agent,
            "estimated_duration": step.estimated_duration,
            "human_review": bool(step.human_review),
        } for step in dag.steps],
    )


@router.put("/{template_id}", response_model=WorkflowTemplateResponse)
async def update_workflow_template(
    template_id: str,
    request: WorkflowTemplateUpdate,
    db: Session = Depends(get_db),
):
    """
    更新模板
    
    权限: editor
    """
    logger.info(f"更新模板: template_id={template_id}")
    
    # 查询模板
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "TEMPLATE_NOT_FOUND",
                "message": f"模板 {template_id} 不存在",
                "details": {"template_id": template_id}
            }
        )
    
    # 检查模板状态
    if template.status == "published":
        # 已发布的模板需要特殊处理（可能需要创建新版本）
        logger.warning(f"更新已发布的模板: {template_id}")
    
    # 更新字段
    update_data = {}
    if request.name is not None:
        update_data["name"] = request.name
    if request.description is not None:
        update_data["description"] = request.description
    if request.dag is not None:
        # 验证 DAG
        errors = _validate_dag(request.dag)
        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_DAG",
                    "message": "DAG 验证失败",
                    "details": {"errors": errors}
                }
            )
        update_data["dag"] = _dag_to_json(request.dag)
    if request.config is not None:
        update_data["config"] = _config_to_json(request.config)
    if request.tags is not None:
        update_data["tags"] = json.dumps(request.tags, ensure_ascii=False)
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # 更新模板
    for key, value in update_data.items():
        setattr(template, key, value)
    
    # 如果更新了 DAG，需要更新步骤定义
    if request.dag is not None:
        # 删除旧的步骤定义
        db.query(StepDefinition).filter(StepDefinition.template_id == template_id).delete()
        
        # 创建新的步骤定义
        for step in request.dag.steps:
            step_def = StepDefinition(
                id=_generate_uuid(),
                template_id=template_id,
                step_id=step.id,
                name=step.name,
                agent=step.agent,
                capabilities=json.dumps(step.capabilities, ensure_ascii=False) if step.capabilities else None,
                estimated_duration=step.estimated_duration,
                human_review=1 if step.human_review else 0,
                depends_on=json.dumps(step.depends_on, ensure_ascii=False) if step.depends_on else "[]",
                created_at=datetime.now(timezone.utc).isoformat(),
            )
            db.add(step_def)
    
    # 创建新版本记录
    if request.dag is not None or request.config is not None:
        # 递增版本号
        version_parts = template.version.split(".")
        major = int(version_parts[0][1:])  # 去掉 'v'
        minor = int(version_parts[1]) + 1
        new_version = f"v{major}.{minor}"
        
        version = WorkflowTemplateVersion(
            id=_generate_uuid(),
            template_id=template_id,
            version=new_version,
            dag=template.dag,
            config=template.config,
            change_summary="更新模板",
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by=_get_current_user_id(),
        )
        db.add(version)
        template.version = new_version
    
    db.commit()
    db.refresh(template)
    
    # 转换为响应格式
    dag = _json_to_dag(template.dag)
    config = _json_to_config(template.config)
    
    return WorkflowTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        version=template.version,
        status=TemplateStatus(template.status),
        dag=dag,
        config=config,
        created_at=template.created_at,
        created_by=template.created_by,
        updated_at=template.updated_at,
        published_at=template.published_at,
        usage_count=template.usage_count,
        tags=json.loads(template.tags) if template.tags else [],
        steps=[{
            "id": step.id,
            "name": step.name,
            "agent": step.agent,
            "estimated_duration": step.estimated_duration,
            "human_review": bool(step.human_review),
        } for step in dag.steps],
    )


@router.delete("/{template_id}")
async def delete_workflow_template(
    template_id: str,
    db: Session = Depends(get_db),
):
    """
    删除模板
    
    权限: admin
    """
    logger.info(f"删除模板: template_id={template_id}")
    
    # 查询模板
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "TEMPLATE_NOT_FOUND",
                "message": f"模板 {template_id} 不存在",
                "details": {"template_id": template_id}
            }
        )
    
    # TODO: 检查是否有活动的工作流实例
    # from app.models.workflow import WorkflowInstance
    # active_instances = db.query(WorkflowInstance).filter(
    #     WorkflowInstance.template_id == template_id,
    #     WorkflowInstance.status.in_(["pending", "running", "paused"])
    # ).count()
    # if active_instances > 0:
    #     raise HTTPException(
    #         status_code=409,
    #         detail={
    #             "code": "TEMPLATE_HAS_ACTIVE_INSTANCES",
    #             "message": f"模板有 {active_instances} 个活动实例，无法删除",
    #         }
    #     )
    
    # 删除模板（级联删除步骤定义、版本历史）
    db.delete(template)
    db.commit()
    
    return {"success": True, "message": "模板已删除"}


@router.post("/{template_id}/publish", response_model=WorkflowTemplateResponse)
async def publish_workflow_template(
    template_id: str,
    db: Session = Depends(get_db),
):
    """
    发布模板
    
    权限: editor
    """
    logger.info(f"发布模板: template_id={template_id}")
    
    # 查询模板
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "TEMPLATE_NOT_FOUND",
                "message": f"模板 {template_id} 不存在",
                "details": {"template_id": template_id}
            }
        )
    
    # 检查模板状态
    if template.status != "draft":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "TEMPLATE_NOT_DRAFT",
                "message": f"模板状态为 '{template.status}'，只有草稿状态的模板才能发布",
            }
        )
    
    # 验证 DAG 完整性
    dag = _json_to_dag(template.dag)
    errors = _validate_dag(dag)
    if errors:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_DAG",
                "message": "DAG 验证失败",
                "details": {"errors": errors}
            }
        )
    
    # 更新状态
    now = datetime.now(timezone.utc).isoformat()
    template.status = "published"
    template.published_at = now
    template.updated_at = now
    
    db.commit()
    db.refresh(template)
    
    # 转换为响应格式
    config = _json_to_config(template.config)
    
    return WorkflowTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        version=template.version,
        status=TemplateStatus(template.status),
        dag=dag,
        config=config,
        created_at=template.created_at,
        created_by=template.created_by,
        updated_at=template.updated_at,
        published_at=template.published_at,
        usage_count=template.usage_count,
        tags=json.loads(template.tags) if template.tags else [],
        steps=[{
            "id": step.id,
            "name": step.name,
            "agent": step.agent,
            "estimated_duration": step.estimated_duration,
            "human_review": bool(step.human_review),
        } for step in dag.steps],
    )


@router.post("/{template_id}/archive", response_model=WorkflowTemplateResponse)
async def archive_workflow_template(
    template_id: str,
    db: Session = Depends(get_db),
):
    """
    归档模板
    
    权限: editor
    """
    logger.info(f"归档模板: template_id={template_id}")
    
    # 查询模板
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "TEMPLATE_NOT_FOUND",
                "message": f"模板 {template_id} 不存在",
                "details": {"template_id": template_id}
            }
        )
    
    # 更新状态
    template.status = "archived"
    template.updated_at = datetime.now(timezone.utc).isoformat()
    
    db.commit()
    db.refresh(template)
    
    # 转换为响应格式
    dag = _json_to_dag(template.dag)
    config = _json_to_config(template.config)
    
    return WorkflowTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        version=template.version,
        status=TemplateStatus(template.status),
        dag=dag,
        config=config,
        created_at=template.created_at,
        created_by=template.created_by,
        updated_at=template.updated_at,
        published_at=template.published_at,
        usage_count=template.usage_count,
        tags=json.loads(template.tags) if template.tags else [],
        steps=[{
            "id": step.id,
            "name": step.name,
            "agent": step.agent,
            "estimated_duration": step.estimated_duration,
            "human_review": bool(step.human_review),
        } for step in dag.steps],
    )


@router.post("/{template_id}/duplicate", response_model=WorkflowTemplateResponse, status_code=201)
async def duplicate_workflow_template(
    template_id: str,
    request: BaseModel,
    db: Session = Depends(get_db),
):
    """
    复制模板
    
    权限: editor
    """
    # 定义请求 schema
    class DuplicateRequest(BaseModel):
        name: str = Field(..., min_length=1, max_length=200)
        description: Optional[str] = None
    
    req = DuplicateRequest(**request.model_dump())
    
    logger.info(f"复制模板: template_id={template_id}, new_name={req.name}")
    
    # 查询源模板
    source_template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
    
    if not source_template:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "TEMPLATE_NOT_FOUND",
                "message": f"模板 {template_id} 不存在",
                "details": {"template_id": template_id}
            }
        )
    
    # 创建新模板
    template_id_new = _generate_uuid()
    now = datetime.now(timezone.utc).isoformat()
    user_id = _get_current_user_id()
    
    new_template = WorkflowTemplate(
        id=template_id_new,
        name=req.name,
        description=req.description or source_template.description,
        version="v1.0",
        status="draft",
        dag=source_template.dag,
        config=source_template.config,
        created_at=now,
        created_by=user_id,
        updated_at=now,
        published_at=None,
        usage_count=0,
        tags=source_template.tags,
    )
    
    db.add(new_template)
    
    # 复制步骤定义
    source_steps = db.query(StepDefinition).filter(StepDefinition.template_id == template_id).all()
    for source_step in source_steps:
        new_step = StepDefinition(
            id=_generate_uuid(),
            template_id=template_id_new,
            step_id=source_step.step_id,
            name=source_step.name,
            agent=source_step.agent,
            capabilities=source_step.capabilities,
            estimated_duration=source_step.estimated_duration,
            human_review=source_step.human_review,
            depends_on=source_step.depends_on,
            created_at=now,
        )
        db.add(new_step)
    
    # 创建初始版本记录
    version = WorkflowTemplateVersion(
        id=_generate_uuid(),
        template_id=template_id_new,
        version="v1.0",
        dag=source_template.dag,
        config=source_template.config,
        change_summary=f"复制自模板 {source_template.name}",
        created_at=now,
        created_by=user_id,
    )
    db.add(version)
    
    db.commit()
    db.refresh(new_template)
    
    # 转换为响应格式
    dag = _json_to_dag(new_template.dag)
    config = _json_to_config(new_template.config)
    
    return WorkflowTemplateResponse(
        id=new_template.id,
        name=new_template.name,
        description=new_template.description,
        version=new_template.version,
        status=TemplateStatus(new_template.status),
        dag=dag,
        config=config,
        created_at=new_template.created_at,
        created_by=new_template.created_by,
        updated_at=new_template.updated_at,
        published_at=new_template.published_at,
        usage_count=new_template.usage_count,
        tags=json.loads(new_template.tags) if new_template.tags else [],
        steps=[{
            "id": step.id,
            "name": step.name,
            "agent": step.agent,
            "estimated_duration": step.estimated_duration,
            "human_review": bool(step.human_review),
        } for step in dag.steps],
    )


@router.post("/import", response_model=WorkflowTemplateResponse, status_code=201)
async def import_workflow_template(
    file: UploadFile = File(..., description="YAML 或 JSON 文件"),
    db: Session = Depends(get_db),
):
    """
    导入模板
    
    权限: editor
    """
    logger.info(f"导入模板: filename={file.filename}")
    
    # TODO: 实现导入逻辑
    raise HTTPException(
        status_code=501,
        detail={
            "code": "NOT_IMPLEMENTED",
            "message": "模板导入功能待实现",
        }
    )


@router.get("/{template_id}/export")
async def export_workflow_template(
    template_id: str,
    format: str = Query("json", description="导出格式 (json/yaml)"),
    db: Session = Depends(get_db),
):
    """
    导出模板
    
    权限: viewer
    """
    logger.info(f"导出模板: template_id={template_id}, format={format}")
    
    # TODO: 实现导出逻辑
    raise HTTPException(
        status_code=501,
        detail={
            "code": "NOT_IMPLEMENTED",
            "message": "模板导出功能待实现",
        }
    )


@router.get("/{template_id}/versions")
async def list_template_versions(
    template_id: str,
    db: Session = Depends(get_db),
):
    """
    获取模板版本历史
    
    权限: viewer
    """
    logger.info(f"获取模板版本历史: template_id={template_id}")
    
    # 查询版本历史
    versions = db.query(WorkflowTemplateVersion).filter(
        WorkflowTemplateVersion.template_id == template_id
    ).order_by(WorkflowTemplateVersion.created_at.desc()).all()
    
    # 转换为响应格式
    data = [
        {
            "version": version.version,
            "change_summary": version.change_summary,
            "created_at": version.created_at,
            "created_by": version.created_by,
        }
        for version in versions
    ]
    
    return {
        "data": data,
        "total": len(data),
    }


@router.post("/{template_id}/rollback", response_model=WorkflowTemplateResponse)
async def rollback_template_version(
    template_id: str,
    request: BaseModel,
    db: Session = Depends(get_db),
):
    """
    回滚到指定版本
    
    权限: editor
    """
    # 定义请求 schema
    class RollbackRequest(BaseModel):
        version: str = Field(..., description="目标版本号")
    
    req = RollbackRequest(**request.model_dump())
    
    logger.info(f"回滚模板版本: template_id={template_id}, version={req.version}")
    
    # 查询模板
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "TEMPLATE_NOT_FOUND",
                "message": f"模板 {template_id} 不存在",
                "details": {"template_id": template_id}
            }
        )
    
    # 查询目标版本
    target_version = db.query(WorkflowTemplateVersion).filter(
        WorkflowTemplateVersion.template_id == template_id,
        WorkflowTemplateVersion.version == req.version,
    ).first()
    
    if not target_version:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "VERSION_NOT_FOUND",
                "message": f"版本 {req.version} 不存在",
                "details": {"version": req.version}
            }
        )
    
    # 恢复 DAG 和配置
    template.dag = target_version.dag
    template.config = target_version.config
    template.updated_at = datetime.now(timezone.utc).isoformat()
    
    # 递增版本号
    version_parts = template.version.split(".")
    major = int(version_parts[0][1:])  # 去掉 'v'
    minor = int(version_parts[1]) + 1
    new_version = f"v{major}.{minor}"
    
    # 创建新版本记录
    version = WorkflowTemplateVersion(
        id=_generate_uuid(),
        template_id=template_id,
        version=new_version,
        dag=target_version.dag,
        config=target_version.config,
        change_summary=f"回滚到版本 {req.version}",
        created_at=datetime.now(timezone.utc).isoformat(),
        created_by=_get_current_user_id(),
    )
    db.add(version)
    template.version = new_version
    
    # 更新步骤定义
    db.query(StepDefinition).filter(StepDefinition.template_id == template_id).delete()
    
    dag = _json_to_dag(target_version.dag)
    for step in dag.steps:
        step_def = StepDefinition(
            id=_generate_uuid(),
            template_id=template_id,
            step_id=step.id,
            name=step.name,
            agent=step.agent,
            capabilities=json.dumps(step.capabilities, ensure_ascii=False) if step.capabilities else None,
            estimated_duration=step.estimated_duration,
            human_review=1 if step.human_review else 0,
            depends_on=json.dumps(step.depends_on, ensure_ascii=False) if step.depends_on else "[]",
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(step_def)
    
    db.commit()
    db.refresh(template)
    
    # 转换为响应格式
    config = _json_to_config(template.config)
    
    return WorkflowTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        version=template.version,
        status=TemplateStatus(template.status),
        dag=dag,
        config=config,
        created_at=template.created_at,
        created_by=template.created_by,
        updated_at=template.updated_at,
        published_at=template.published_at,
        usage_count=template.usage_count,
        tags=json.loads(template.tags) if template.tags else [],
        steps=[{
            "id": step.id,
            "name": step.name,
            "agent": step.agent,
            "estimated_duration": step.estimated_duration,
            "human_review": bool(step.human_review),
        } for step in dag.steps],
    )


# ── 导出路由器 ──────────────────────────────────────────────────────────

__all__ = ["router"]
