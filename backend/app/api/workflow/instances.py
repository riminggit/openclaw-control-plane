"""
工作流实例 API + 步骤执行 API + Gateway 集成
实现 Phase 3-5 的所有端点
"""
from __future__ import annotations

import json
import logging
import subprocess
from datetime import datetime, timezone
from typing import Any, Optional, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.db import get_db
from app.models.workflow import (
    WorkflowTemplate,
    WorkflowInstance,
    StepDefinition,
    StepExecution,
    WorkflowLog,
    ReviewRecord,
    WorkflowEvent,
)
from app.schemas.workflow import (
    WorkflowInstanceCreate,
    WorkflowInstanceResponse,
    WorkflowInstanceListResponse,
    WorkflowStatus,
    StepStatus,
    StepExecutionResponse,
    StepExecutionListResponse,
    ReviewAction,
    CurrentStepInfo,
    LogResponse,
    LogListResponse,
    ReviewResponse,
    TerminateWorkflowRequest,
    SkipStepRequest,
    ApproveReviewRequest,
    RejectReviewRequest,
)

# 路由器定义
router = APIRouter(prefix="/api/v1/workflow-instances", tags=["workflow-instances"])

# 日志记录器
logger = logging.getLogger(__name__)


# ── 辅助函数 ───────────────────────────────────────────────────

def _generate_uuid() -> str:
    """生成 UUID"""
    return str(uuid4())


def _get_current_user_id() -> str:
    """获取当前用户 ID（临时硬编码，待集成认证系统）"""
    return "user-001"


def _now() -> str:
    """获取当前时间 ISO 格式"""
    return datetime.now(timezone.utc).isoformat()


def _parse_json(json_str: Optional[str]) -> Any:
    """解析 JSON 字符串"""
    if not json_str:
        return {}
    try:
        return json.loads(json_str)
    except:
        return {}


def _to_json(obj: Any) -> str:
    """转换为 JSON 字符串"""
    return json.dumps(obj, ensure_ascii=False)


def _get_openclaw_agents() -> List[dict]:
    """
    读取 /root/.openclaw/openclaw.json 获取 agent 列表
    
    返回格式: [{"id": "...", "name": "...", "status": "..."}, ...]
    """
    try:
        with open("/root/.openclaw/openclaw.json", "r", encoding="utf-8") as f:
            config = json.load(f)
        
        agents = []
        # 从 agents 配置中获取
        if "agents" in config:
            for agent_id, agent_config in config["agents"].items():
                agents.append({
                    "id": agent_id,
                    "name": agent_config.get("name", agent_id),
                    "display_name": agent_config.get("displayName", agent_config.get("name", agent_id)),
                    "status": "online",  # 假设都在线，后续可以实时检查
                    "capabilities": agent_config.get("capabilities", []),
                    "model": agent_config.get("model", "unknown"),
                })
        
        return agents
    except Exception as e:
        logger.error(f"读取 openclaw.json 失败: {e}")
        return []


def _schedule_agent_task(agent_id: str, task_description: str, workflow_instance_id: str, step_id: str) -> bool:
    """
    通过 openclaw cron add 调度 agent 执行任务
    
    返回: 是否成功调度
    """
    try:
        # 构造命令
        cmd = [
            "openclaw", "cron", "add",
            "--at", "now",
            "--agent", agent_id,
            "-m", task_description
        ]
        
        logger.info(f"调度 agent 任务: {' '.join(cmd)}")
        
        # 执行命令
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            logger.info(f"成功调度 agent {agent_id} 执行任务")
            return True
        else:
            logger.error(f"调度 agent 失败: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"调度 agent 异常: {e}")
        return False


def _get_next_step(workflow_instance: WorkflowInstance, current_step_id: str, db: Session) -> Optional[StepExecution]:
    """
    获取下一个可执行的步骤
    
    逻辑：
    1. 找到所有依赖当前步骤的步骤
    2. 检查这些步骤的所有依赖是否都已完成
    3. 返回第一个满足条件的步骤
    """
    # 获取所有步骤执行记录
    step_executions = db.query(StepExecution).filter(
        StepExecution.workflow_instance_id == workflow_instance.id
    ).all()
    
    # 构建步骤 ID 到执行记录的映射
    step_map = {se.step_id: se for se in step_executions}
    
    # 获取当前步骤的定义（从第一个步骤执行记录获取模板信息）
    current_step = step_map.get(current_step_id)
    if not current_step:
        return None
    
    # 获取模板的步骤定义
    template = db.query(WorkflowTemplate).filter(
        WorkflowTemplate.id == workflow_instance.template_id
    ).first()
    
    if not template:
        return None
    
    # 解析 DAG
    dag = _parse_json(template.dag)
    steps = dag.get("steps", [])
    edges = dag.get("edges", [])
    
    # 找到所有以当前步骤为源的边
    next_step_ids = []
    for edge in edges:
        if edge.get("source") == current_step_id:
            next_step_ids.append(edge.get("target"))
    
    # 检查每个候选步骤是否所有依赖都已完成
    for next_step_id in next_step_ids:
        next_step_exec = step_map.get(next_step_id)
        if not next_step_exec:
            continue
        
        # 找到该步骤的所有依赖
        dependencies = []
        for edge in edges:
            if edge.get("target") == next_step_id:
                dependencies.append(edge.get("source"))
        
        # 检查所有依赖是否都已完成
        all_deps_completed = True
        for dep_step_id in dependencies:
            dep_step_exec = step_map.get(dep_step_id)
            if not dep_step_exec or dep_step_exec.status not in ["completed", "skipped"]:
                all_deps_completed = False
                break
        
        if all_deps_completed and next_step_exec.status == "pending":
            return next_step_exec
    
    return None


def _advance_workflow(workflow_instance: WorkflowInstance, db: Session) -> None:
    """
    推进工作流到下一步
    
    逻辑：
    1. 找到当前正在运行的步骤
    2. 如果没有，找到第一个 pending 的步骤
    3. 启动该步骤
    """
    # 获取所有步骤执行记录
    step_executions = db.query(StepExecution).filter(
        StepExecution.workflow_instance_id == workflow_instance.id
    ).order_by(StepExecution.created_at)
    
    # 找到第一个 pending 的步骤
    next_step = None
    for se in step_executions:
        if se.status == "pending":
            # 检查依赖是否都已完成
            # TODO: 实现依赖检查
            next_step = se
            break
    
    if next_step:
        # 启动步骤
        next_step.status = "running"
        next_step.started_at = _now()
        
        # 获取 agent 信息
        step_def = db.query(StepDefinition).filter(
            StepDefinition.template_id == workflow_instance.template_id,
            StepDefinition.step_id == next_step.step_id
        ).first()
        
        if step_def and step_def.agent:
            next_step.agent_name = step_def.agent
            
            # 调度 agent 执行
            task_desc = f"执行步骤: {next_step.name}"
            _schedule_agent_task(step_def.agent, task_desc, workflow_instance.id, next_step.id)
        
        # 记录日志
        log = WorkflowLog(
            id=_generate_uuid(),
            workflow_instance_id=workflow_instance.id,
            step_execution_id=next_step.id,
            timestamp=_now(),
            level="INFO",
            message=f"步骤 {next_step.name} 开始执行",
            created_at=_now(),
        )
        db.add(log)
        
        db.commit()
    else:
        # 没有更多步骤，工作流完成
        workflow_instance.status = "completed"
        workflow_instance.completed_at = _now()
        
        # 计算总耗时
        if workflow_instance.started_at:
            start = datetime.fromisoformat(workflow_instance.started_at.replace("Z", "+00:00"))
            end = datetime.now(timezone.utc)
            workflow_instance.duration = int((end - start).total_seconds())
        
        # 记录日志
        log = WorkflowLog(
            id=_generate_uuid(),
            workflow_instance_id=workflow_instance.id,
            timestamp=_now(),
            level="INFO",
            message="工作流执行完成",
            created_at=_now(),
        )
        db.add(log)
        
        db.commit()


# ── Phase 3: 工作流实例 API ─────────────────────────────────────────────────

@router.get("", response_model=WorkflowInstanceListResponse)
async def list_workflow_instances(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    status: Optional[str] = Query(None, description="状态筛选 (pending/running/paused/completed/failed/terminated)"),
    template_id: Optional[str] = Query(None, description="模板 ID 筛选"),
    created_by: Optional[str] = Query(None, description="创建者 ID"),
    sort_by: str = Query("created_at", description="排序字段"),
    sort_order: str = Query("desc", description="排序方向 (asc/desc)"),
    db: Session = Depends(get_db),
):
    """
    获取工作流实例列表
    
    权限: viewer
    """
    logger.info(f"获取工作流实例列表: page={page}, status={status}")
    
    # 构建查询
    query = db.query(WorkflowInstance)
    
    # 应用筛选
    if status:
        query = query.filter(WorkflowInstance.status == status)
    
    if template_id:
        query = query.filter(WorkflowInstance.template_id == template_id)
    
    if created_by:
        query = query.filter(WorkflowInstance.created_by == created_by)
    
    # 获取总数
    total = query.count()
    
    # 应用排序
    order_column = getattr(WorkflowInstance, sort_by, WorkflowInstance.created_at)
    if sort_order == "desc":
        query = query.order_by(order_column.desc())
    else:
        query = query.order_by(order_column.asc())
    
    # 应用分页
    offset = (page - 1) * page_size
    instances = query.offset(offset).limit(page_size).all()
    
    # 计算总页数
    total_pages = (total + page_size - 1) // page_size
    
    # 转换为响应格式
    data = []
    for instance in instances:
        # 获取模板名称
        template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == instance.template_id).first()
        template_name = template.name if template else None
        
        # 获取当前步骤信息
        current_step = None
        if instance.status == "running":
            running_step = db.query(StepExecution).filter(
                StepExecution.workflow_instance_id == instance.id,
                StepExecution.status == "running"
            ).first()
            
            if running_step:
                current_step = CurrentStepInfo(
                    step_id=running_step.step_id,
                    name=running_step.name,
                    status=StepStatus(running_step.status),
                    agent_name=running_step.agent_name,
                    progress=running_step.progress,
                )
        
        data.append(WorkflowInstanceResponse(
            id=instance.id,
            template_id=instance.template_id,
            template_name=template_name,
            template_version=instance.template_version,
            status=WorkflowStatus(instance.status),
            input=_parse_json(instance.input),
            output=_parse_json(instance.output) if instance.output else None,
            progress=instance.progress,
            estimated_remaining=instance.estimated_remaining,
            created_at=instance.created_at,
            created_by=instance.created_by,
            started_at=instance.started_at,
            completed_at=instance.completed_at,
            duration=instance.duration,
            error_message=instance.error_message,
            termination_reason=instance.termination_reason,
            current_step=current_step,
        ))
    
    return WorkflowInstanceListResponse(
        data=data,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=WorkflowInstanceResponse, status_code=201)
async def create_workflow_instance(
    request: WorkflowInstanceCreate,
    db: Session = Depends(get_db),
):
    """
    从模板创建工作流实例
    
    权限: editor
    """
    logger.info(f"创建工作流实例: template_id={request.template_id}")
    
    # 查询模板
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == request.template_id).first()
    
    if not template:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "TEMPLATE_NOT_FOUND",
                "message": f"模板 {request.template_id} 不存在",
            }
        )
    
    # 检查模板状态
    if template.status != "published":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "TEMPLATE_NOT_PUBLISHED",
                "message": "只有已发布的模板才能创建实例",
            }
        )
    
    # 创建工作流实例
    instance_id = _generate_uuid()
    now = _now()
    user_id = _get_current_user_id()
    
    instance = WorkflowInstance(
        id=instance_id,
        template_id=request.template_id,
        template_version=template.version,
        status="pending",
        input=_to_json(request.input),
        output=None,
        progress=0,
        created_at=now,
        created_by=user_id,
    )
    
    db.add(instance)
    
    # 从模板复制步骤定义到步骤执行
    step_definitions = db.query(StepDefinition).filter(
        StepDefinition.template_id == request.template_id
    ).all()
    
    for step_def in step_definitions:
        step_exec = StepExecution(
            id=_generate_uuid(),
            workflow_instance_id=instance_id,
            step_id=step_def.step_id,
            name=step_def.name,
            status="pending",
            agent_name=step_def.agent,
            input=None,
            output=None,
            progress=0,
            created_at=now,
            updated_at=now,
        )
        db.add(step_exec)
    
    # 更新模板使用次数
    template.usage_count += 1
    
    # 记录事件
    event = WorkflowEvent(
        id=_generate_uuid(),
        workflow_instance_id=instance_id,
        event_type="workflow.created",
        event_data=_to_json({
            "template_id": request.template_id,
            "template_name": template.name,
        }),
        actor_type="user",
        actor_id=user_id,
        timestamp=now,
        created_at=now,
    )
    db.add(event)
    
    db.commit()
    db.refresh(instance)
    
    # 转换为响应格式
    return WorkflowInstanceResponse(
        id=instance.id,
        template_id=instance.template_id,
        template_name=template.name,
        template_version=instance.template_version,
        status=WorkflowStatus(instance.status),
        input=_parse_json(instance.input),
        output=None,
        progress=instance.progress,
        estimated_remaining=instance.estimated_remaining,
        created_at=instance.created_at,
        created_by=instance.created_by,
        started_at=None,
        completed_at=None,
        duration=None,
        error_message=None,
        termination_reason=None,
        current_step=None,
    )


@router.get("/{instance_id}", response_model=WorkflowInstanceResponse)
async def get_workflow_instance(
    instance_id: str,
    db: Session = Depends(get_db),
):
    """
    获取工作流实例详情（含所有步骤执行状态）
    
    权限: viewer
    """
    logger.info(f"获取工作流实例详情: instance_id={instance_id}")
    
    # 查询实例
    instance = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
    
    if not instance:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "INSTANCE_NOT_FOUND",
                "message": f"工作流实例 {instance_id} 不存在",
            }
        )
    
    # 获取模板名称
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == instance.template_id).first()
    template_name = template.name if template else None
    
    # 获取所有步骤执行记录
    step_executions = db.query(StepExecution).filter(
        StepExecution.workflow_instance_id == instance_id
    ).order_by(StepExecution.created_at).all()
    
    # 获取当前步骤信息
    current_step = None
    if instance.status == "running":
        running_step = next((se for se in step_executions if se.status == "running"), None)
        if running_step:
            current_step = CurrentStepInfo(
                step_id=running_step.step_id,
                name=running_step.name,
                status=StepStatus(running_step.status),
                agent_name=running_step.agent_name,
                progress=running_step.progress,
            )
    
    # 转换步骤执行记录
    steps_data = []
    for se in step_executions:
        # 获取审核信息
        review = None
        if se.status in ["awaiting_review", "approved", "rejected"]:
            review_record = db.query(ReviewRecord).filter(
                ReviewRecord.step_execution_id == se.id
            ).order_by(ReviewRecord.created_at.desc()).first()
            
            if review_record:
                review = ReviewResponse(
                    id=review_record.id,
                    workflow_instance_id=review_record.workflow_instance_id,
                    step_execution_id=review_record.step_execution_id,
                    reviewer_id=review_record.reviewer_id,
                    reviewer_name=review_record.reviewer_name,
                    action=ReviewAction(review_record.action) if review_record.action else None,
                    comment=review_record.comment,
                    created_at=review_record.created_at,
                    updated_at=review_record.updated_at,
                    timeout_at=review_record.timeout_at,
                    timeout_action=review_record.timeout_action,
                    remaining_time=review_record.remaining_time,
                    review_round=review_record.review_round,
                )
        
        steps_data.append(StepExecutionResponse(
            id=se.id,
            workflow_instance_id=se.workflow_instance_id,
            step_id=se.step_id,
            name=se.name,
            status=StepStatus(se.status),
            agent_id=se.agent_id,
            agent_name=se.agent_name,
            input=_parse_json(se.input) if se.input else None,
            output=_parse_json(se.output) if se.output else None,
            progress=se.progress,
            progress_message=se.progress_message,
            started_at=se.started_at,
            completed_at=se.completed_at,
            duration=se.duration,
            retry_count=se.retry_count,
            max_retries=se.max_retries,
            error_message=se.error_message,
            force_completed=bool(se.force_completed),
        ))
    
    return WorkflowInstanceResponse(
        id=instance.id,
        template_id=instance.template_id,
        template_name=template_name,
        template_version=instance.template_version,
        status=WorkflowStatus(instance.status),
        input=_parse_json(instance.input),
        output=_parse_json(instance.output) if instance.output else None,
        progress=instance.progress,
        estimated_remaining=instance.estimated_remaining,
        created_at=instance.created_at,
        created_by=instance.created_by,
        started_at=instance.started_at,
        completed_at=instance.completed_at,
        duration=instance.duration,
        error_message=instance.error_message,
        termination_reason=instance.termination_reason,
        current_step=current_step,
        steps=steps_data,
    )


@router.post("/{instance_id}/start", response_model=WorkflowInstanceResponse)
async def start_workflow_instance(
    instance_id: str,
    db: Session = Depends(get_db),
):
    """
    启动工作流执行
    
    权限: editor
    """
    logger.info(f"启动工作流: instance_id={instance_id}")
    
    # 查询实例
    instance = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
    
    if not instance:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "INSTANCE_NOT_FOUND",
                "message": f"工作流实例 {instance_id} 不存在",
            }
        )
    
    # 检查状态
    if instance.status != "pending":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INSTANCE_NOT_PENDING",
                "message": f"工作流状态为 '{instance.status}'，只有 pending 状态才能启动",
            }
        )
    
    # 更新状态
    now = _now()
    instance.status = "running"
    instance.started_at = now
    
    # 记录事件
    event = WorkflowEvent(
        id=_generate_uuid(),
        workflow_instance_id=instance_id,
        event_type="workflow.started",
        actor_type="user",
        actor_id=_get_current_user_id(),
        timestamp=now,
        created_at=now,
    )
    db.add(event)
    
    # 记录日志
    log = WorkflowLog(
        id=_generate_uuid(),
        workflow_instance_id=instance_id,
        timestamp=now,
        level="INFO",
        message="工作流启动执行",
        created_at=now,
    )
    db.add(log)
    
    db.commit()
    
    # 启动第一个步骤
    _advance_workflow(instance, db)
    
    # 重新加载实例
    db.refresh(instance)
    
    # 返回更新后的实例
    return await get_workflow_instance(instance_id, db)


@router.post("/{instance_id}/pause", response_model=WorkflowInstanceResponse)
async def pause_workflow_instance(
    instance_id: str,
    db: Session = Depends(get_db),
):
    """
    暂停工作流
    
    权限: editor
    """
    logger.info(f"暂停工作流: instance_id={instance_id}")
    
    # 查询实例
    instance = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
    
    if not instance:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "INSTANCE_NOT_FOUND",
                "message": f"工作流实例 {instance_id} 不存在",
            }
        )
    
    # 检查状态
    if instance.status != "running":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INSTANCE_NOT_RUNNING",
                "message": f"工作流状态为 '{instance.status}'，只有 running 状态才能暂停",
            }
        )
    
    # 更新状态
    now = _now()
    instance.status = "paused"
    
    # 暂停当前正在运行的步骤
    running_step = db.query(StepExecution).filter(
        StepExecution.workflow_instance_id == instance_id,
        StepExecution.status == "running"
    ).first()
    
    if running_step:
        # TODO: 通知 agent 停止
        logger.info(f"暂停步骤: {running_step.step_id}")
    
    # 记录事件
    event = WorkflowEvent(
        id=_generate_uuid(),
        workflow_instance_id=instance_id,
        event_type="workflow.paused",
        actor_type="user",
        actor_id=_get_current_user_id(),
        timestamp=now,
        created_at=now,
    )
    db.add(event)
    
    # 记录日志
    log = WorkflowLog(
        id=_generate_uuid(),
        workflow_instance_id=instance_id,
        timestamp=now,
        level="INFO",
        message="工作流已暂停",
        created_at=now,
    )
    db.add(log)
    
    db.commit()
    db.refresh(instance)
    
    return await get_workflow_instance(instance_id, db)


@router.post("/{instance_id}/resume", response_model=WorkflowInstanceResponse)
async def resume_workflow_instance(
    instance_id: str,
    db: Session = Depends(get_db),
):
    """
    恢复工作流
    
    权限: editor
    """
    logger.info(f"恢复工作流: instance_id={instance_id}")
    
    # 查询实例
    instance = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
    
    if not instance:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "INSTANCE_NOT_FOUND",
                "message": f"工作流实例 {instance_id} 不存在",
            }
        )
    
    # 检查状态
    if instance.status != "paused":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INSTANCE_NOT_PAUSED",
                "message": f"工作流状态为 '{instance.status}'，只有 paused 状态才能恢复",
            }
        )
    
    # 更新状态
    now = _now()
    instance.status = "running"
    
    # 记录事件
    event = WorkflowEvent(
        id=_generate_uuid(),
        workflow_instance_id=instance_id,
        event_type="workflow.resumed",
        actor_type="user",
        actor_id=_get_current_user_id(),
        timestamp=now,
        created_at=now,
    )
    db.add(event)
    
    # 记录日志
    log = WorkflowLog(
        id=_generate_uuid(),
        workflow_instance_id=instance_id,
        timestamp=now,
        level="INFO",
        message="工作流已恢复",
        created_at=now,
    )
    db.add(log)
    
    db.commit()
    
    # 继续执行（找到暂停时正在运行的步骤或下一个 pending 步骤）
    _advance_workflow(instance, db)
    
    db.refresh(instance)
    
    return await get_workflow_instance(instance_id, db)


@router.post("/{instance_id}/stop", response_model=WorkflowInstanceResponse)
async def stop_workflow_instance(
    instance_id: str,
    request: TerminateWorkflowRequest,
    db: Session = Depends(get_db),
):
    """
    终止工作流
    
    权限: editor
    """
    logger.info(f"终止工作流: instance_id={instance_id}, reason={request.reason}")
    
    # 查询实例
    instance = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
    
    if not instance:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "INSTANCE_NOT_FOUND",
                "message": f"工作流实例 {instance_id} 不存在",
            }
        )
    
    # 检查状态
    if instance.status in ["completed", "terminated", "failed"]:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INSTANCE_ALREADY_FINISHED",
                "message": f"工作流状态为 '{instance.status}'，无法终止",
            }
        )
    
    # 更新状态
    now = _now()
    instance.status = "terminated"
    instance.termination_reason = request.reason
    instance.completed_at = now
    
    # 计算总耗时
    if instance.started_at:
        start = datetime.fromisoformat(instance.started_at.replace("Z", "+00:00"))
        end = datetime.now(timezone.utc)
        instance.duration = int((end - start).total_seconds())
    
    # 取消所有正在运行的步骤
    running_steps = db.query(StepExecution).filter(
        StepExecution.workflow_instance_id == instance_id,
        StepExecution.status == "running"
    ).all()
    
    for step in running_steps:
        step.status = "cancelled"
        step.updated_at = now
        # TODO: 通知 agent 停止
    
    # 记录事件
    event = WorkflowEvent(
        id=_generate_uuid(),
        workflow_instance_id=instance_id,
        event_type="workflow.terminated",
        event_data=_to_json({"reason": request.reason}),
        actor_type="user",
        actor_id=_get_current_user_id(),
        timestamp=now,
        created_at=now,
    )
    db.add(event)
    
    # 记录日志
    log = WorkflowLog(
        id=_generate_uuid(),
        workflow_instance_id=instance_id,
        timestamp=now,
        level="WARN",
        message=f"工作流已终止: {request.reason}",
        created_at=now,
    )
    db.add(log)
    
    db.commit()
    db.refresh(instance)
    
    return await get_workflow_instance(instance_id, db)


# ── Phase 4: 步骤执行 API ─────────────────────────────────────────────────

@router.get("/{instance_id}/steps", response_model=StepExecutionListResponse)
async def list_step_executions(
    instance_id: str,
    db: Session = Depends(get_db),
):
    """
    获取步骤列表（含状态/agent/耗时）
    
    权限: viewer
    """
    logger.info(f"获取步骤列表: instance_id={instance_id}")
    
    # 查询实例
    instance = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
    
    if not instance:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "INSTANCE_NOT_FOUND",
                "message": f"工作流实例 {instance_id} 不存在",
            }
        )
    
    # 获取所有步骤执行记录
    step_executions = db.query(StepExecution).filter(
        StepExecution.workflow_instance_id == instance_id
    ).order_by(StepExecution.created_at).all()
    
    # 转换为响应格式
    data = []
    for se in step_executions:
        # 获取步骤定义，检查是否需要人工审核
        step_def = db.query(StepDefinition).filter(
            StepDefinition.template_id == instance.template_id,
            StepDefinition.step_id == se.step_id
        ).first()
        
        human_review = bool(step_def.human_review) if step_def else False
        
        data.append(StepExecutionResponse(
            id=se.id,
            workflow_instance_id=se.workflow_instance_id,
            step_id=se.step_id,
            name=se.name,
            status=StepStatus(se.status),
            agent_id=se.agent_id,
            agent_name=se.agent_name,
            input=_parse_json(se.input) if se.input else None,
            output=_parse_json(se.output) if se.output else None,
            progress=se.progress,
            progress_message=se.progress_message,
            started_at=se.started_at,
            completed_at=se.completed_at,
            duration=se.duration,
            retry_count=se.retry_count,
            max_retries=se.max_retries,
            error_message=se.error_message,
            force_completed=bool(se.force_completed),
            human_review=human_review,
        ))
    
    return StepExecutionListResponse(
        data=data,
        total=len(data),
        page=1,
        page_size=len(data),
        total_pages=1,
    )


@router.post("/{instance_id}/steps/{step_id}/retry", response_model=StepExecutionResponse)
async def retry_step_execution(
    instance_id: str,
    step_id: str,
    db: Session = Depends(get_db),
):
    """
    重试步骤（状态回 running）
    
    权限: editor
    """
    logger.info(f"重试步骤: instance_id={instance_id}, step_id={step_id}")
    
    # 查询步骤执行记录
    step_exec = db.query(StepExecution).filter(
        StepExecution.workflow_instance_id == instance_id,
        StepExecution.id == step_id
    ).first()
    
    if not step_exec:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "STEP_NOT_FOUND",
                "message": f"步骤 {step_id} 不存在",
            }
        )
    
    # 检查状态
    if step_exec.status not in ["failed", "cancelled"]:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "STEP_NOT_RETRYABLE",
                "message": f"步骤状态为 '{step_exec.status}'，只有 failed 或 cancelled 状态才能重试",
            }
        )
    
    # 检查重试次数
    if step_exec.retry_count >= step_exec.max_retries:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "MAX_RETRIES_EXCEEDED",
                "message": f"已达到最大重试次数 {step_exec.max_retries}",
            }
        )
    
    # 更新状态
    now = _now()
    step_exec.status = "running"
    step_exec.retry_count += 1
    step_exec.error_message = None
    step_exec.started_at = now
    step_exec.completed_at = None
    step_exec.updated_at = now
    
    # 重新调度 agent
    if step_exec.agent_name:
        task_desc = f"重试步骤: {step_exec.name}"
        _schedule_agent_task(step_exec.agent_name, task_desc, instance_id, step_id)
    
    # 记录日志
    log = WorkflowLog(
        id=_generate_uuid(),
        workflow_instance_id=instance_id,
        step_execution_id=step_id,
        timestamp=now,
        level="INFO",
        message=f"步骤 {step_exec.name} 开始重试 (第 {step_exec.retry_count} 次)",
        created_at=now,
    )
    db.add(log)
    
    db.commit()
    db.refresh(step_exec)
    
    # 获取步骤定义，检查是否需要人工审核
    instance = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
    step_def = db.query(StepDefinition).filter(
        StepDefinition.template_id == instance.template_id,
        StepDefinition.step_id == step_exec.step_id
    ).first()
    
    human_review = bool(step_def.human_review) if step_def else False
    
    return StepExecutionResponse(
        id=step_exec.id,
        workflow_instance_id=step_exec.workflow_instance_id,
        step_id=step_exec.step_id,
        name=step_exec.name,
        status=StepStatus(step_exec.status),
        agent_id=step_exec.agent_id,
        agent_name=step_exec.agent_name,
        input=_parse_json(step_exec.input) if step_exec.input else None,
        output=_parse_json(step_exec.output) if step_exec.output else None,
        progress=step_exec.progress,
        progress_message=step_exec.progress_message,
        started_at=step_exec.started_at,
        completed_at=step_exec.completed_at,
        duration=step_exec.duration,
        retry_count=step_exec.retry_count,
        max_retries=step_exec.max_retries,
        error_message=step_exec.error_message,
        force_completed=bool(step_exec.force_completed),
        human_review=human_review,
    )


@router.post("/{instance_id}/steps/{step_id}/skip", response_model=StepExecutionResponse)
async def skip_step_execution(
    instance_id: str,
    step_id: str,
