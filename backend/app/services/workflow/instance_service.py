"""
工作流实例服务层
负责工作流实例的核心业务逻辑
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional, List
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.workflow import (
    WorkflowTemplate,
    WorkflowInstance,
    StepExecution,
    WorkflowLog,
    WorkflowEvent,
)

logger = logging.getLogger(__name__)


class TemplateNotFoundError(Exception):
    """模板未找到异常"""
    pass


class DependencyParseError(Exception):
    """依赖解析异常"""
    pass


class WorkflowInstanceService:
    """工作流实例服务"""
    
    @staticmethod
    def generate_uuid() -> str:
        """生成 UUID"""
        return str(uuid4())
    
    @staticmethod
    def now() -> str:
        """获取当前时间 ISO 格式"""
        return datetime.now(timezone.utc).isoformat()
    
    @staticmethod
    def parse_json(json_str: Optional[str]) -> Any:
        """解析 JSON 字符串"""
        if not json_str:
            return {}
        try:
            return json.loads(json_str)
        except:
            return {}
    
    @staticmethod
    def to_json(obj: Any) -> str:
        """转换为 JSON 字符串"""
        return json.dumps(obj, ensure_ascii=False)
    
    @classmethod
    def get_steps_from_template(cls, db: Session, template_id: str) -> List[dict]:
        """
        从 WorkflowTemplate.dag 字段解析步骤定义（统一数据源）
        
        Args:
            db: 数据库会话
            template_id: 模板ID
            
        Returns:
            步骤定义列表
            
        Raises:
            TemplateNotFoundError: 模板不存在
        """
        template = db.query(WorkflowTemplate).filter_by(id=template_id).first()
        if not template:
            raise TemplateNotFoundError(f"Template {template_id} not found")
        
        dag = cls.parse_json(template.dag)
        # DAG 格式：{"steps": [...], "edges": [...]}
        # 兼容处理：优先使用 steps，如果没有则尝试 nodes
        return dag.get('steps', dag.get('nodes', []))
    
    @classmethod
    def check_dependencies(
        cls,
        db: Session,
        step_id: str,
        template_id: str,
        step_executions: List[StepExecution]
    ) -> bool:
        """
        统一依赖检查逻辑（统一使用 WorkflowTemplate.dag）
        
        Args:
            db: 数据库会话
            step_id: 步骤ID
            template_id: 模板ID
            step_executions: 步骤执行记录列表
            
        Returns:
            依赖是否满足
            
        Raises:
            DependencyParseError: 依赖解析失败
        """
        # 从统一数据源获取步骤定义
        steps = cls.get_steps_from_template(db, template_id)
        
        # 找到当前步骤的定义
        step_data = next((s for s in steps if s['id'] == step_id), None)
        if not step_data:
            # 如果步骤定义不存在，说明数据有问题，应该抛出异常
            raise DependencyParseError(f"Step {step_id} not found in template {template_id}")
        
        # 如果没有依赖，直接返回 True
        depends_on = step_data.get('depends_on')
        if not depends_on:
            return True
        
        # 解析依赖列表（depends_on 可能是字符串或列表）
        dependency_ids = []
        if isinstance(depends_on, str):
            try:
                dependency_ids = json.loads(depends_on)
            except json.JSONDecodeError as e:
                raise DependencyParseError(f"Failed to parse depends_on field for step {step_id}: {e}")
        elif isinstance(depends_on, list):
            dependency_ids = depends_on
        else:
            raise DependencyParseError(f"Invalid depends_on type for step {step_id}: {type(depends_on)}")
        
        # 如果没有依赖项，返回 True
        if not dependency_ids:
            return True
        
        # 检查每个依赖步骤是否已完成
        step_map = {se.step_id: se for se in step_executions}
        for dep_id in dependency_ids:
            dep_exec = step_map.get(dep_id)
            
            # 依赖步骤必须存在且状态为 completed 或 skipped
            if not dep_exec or dep_exec.status not in ["completed", "skipped"]:
                logger.info(f"Step {step_id} dependency {dep_id} not satisfied (status: {dep_exec.status if dep_exec else 'not found'})")
                return False
        
        return True
    
    @classmethod
    def parse_dependencies(cls, depends_on: Any) -> List[str]:
        """
        解析依赖字段
        
        Args:
            depends_on: 依赖字段（字符串或列表）
            
        Returns:
            依赖ID列表
            
        Raises:
            DependencyParseError: 解析失败
        """
        if not depends_on:
            return []
        
        if isinstance(depends_on, list):
            return depends_on
        
        if isinstance(depends_on, str):
            try:
                return json.loads(depends_on)
            except json.JSONDecodeError as e:
                raise DependencyParseError(f"Failed to parse depends_on field: {e}")
        
        raise DependencyParseError(f"Invalid depends_on type: {type(depends_on)}")
    
    @classmethod
    def create_instance(
        cls,
        template_id: str,
        input_data: dict,
        user_id: str,
        db: Session
    ) -> WorkflowInstance:
        """
        创建工作流实例
        
        Args:
            template_id: 模板ID
            input_data: 输入数据
            user_id: 用户ID
            db: 数据库会话
            
        Returns:
            创建的工作流实例
        """
        # 查询模板
        template = db.query(WorkflowTemplate).filter(
            WorkflowTemplate.id == template_id
        ).first()
        
        if not template:
            raise ValueError(f"模板 {template_id} 不存在")
        
        if template.status != "published":
            raise ValueError("只有已发布的模板才能创建实例")
        
        # 创建实例
        instance_id = cls.generate_uuid()
        now = cls.now()
        
        instance = WorkflowInstance(
            id=instance_id,
            template_id=template_id,
            template_version=template.version,
            status="pending",
            input=cls.to_json(input_data),
            output=None,
            progress=0,
            created_at=now,
            created_by=user_id,
        )
        
        db.add(instance)
        
        # 从模板的 DAG 字段读取步骤定义（统一数据源）
        steps = cls.get_steps_from_template(db, template_id)
        
        for step_data in steps:
            step_exec = StepExecution(
                id=cls.generate_uuid(),
                workflow_instance_id=instance_id,
                step_id=step_data['id'],
                name=step_data.get('name', step_data['id']),
                status="pending",
                agent_name=step_data.get('agent'),
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
            id=cls.generate_uuid(),
            workflow_instance_id=instance_id,
            event_type="workflow.created",
            event_data=cls.to_json({
                "template_id": template_id,
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
        
        return instance
    
    @classmethod
    def advance_workflow(
        cls,
        workflow_instance: WorkflowInstance,
        db: Session
    ) -> None:
        """
        推进工作流到下一步
        
        Args:
            workflow_instance: 工作流实例
            db: 数据库会话
        """
        # 获取所有步骤执行记录
        step_executions = db.query(StepExecution).filter(
            StepExecution.workflow_instance_id == workflow_instance.id
        ).order_by(StepExecution.created_at)
        
        # 找到第一个依赖满足的 pending 步骤
        next_step = None
        for se in step_executions:
            if se.status == "pending":
                # 使用统一的依赖检查逻辑
                try:
                    deps_satisfied = cls.check_dependencies(
                        db,
                        se.step_id,
                        workflow_instance.template_id,
                        step_executions
                    )
                    
                    if deps_satisfied:
                        next_step = se
                        break
                except DependencyParseError as e:
                    # 依赖解析失败，记录错误并跳过此步骤
                    logger.error(f"Dependency check failed for step {se.name}: {e}")
                    # 标记步骤为失败状态
                    se.status = "failed"
                    se.error_message = str(e)
                    se.updated_at = cls.now()
                    continue
        
        if next_step:
            # 启动步骤
            next_step.status = "running"
            next_step.started_at = cls.now()
            
            # 从统一数据源获取 agent 信息
            steps = cls.get_steps_from_template(db, workflow_instance.template_id)
            step_data = next((s for s in steps if s['id'] == next_step.step_id), None)
            
            if step_data and step_data.get('agent'):
                agent_name = step_data['agent']
                next_step.agent_name = agent_name
                
                # 调度 agent 执行（由调度服务处理）
                from app.services.workflow.scheduler_service import SchedulerService
                task_desc = f"执行步骤: {next_step.name}"
                SchedulerService.schedule_agent_task(
                    agent_name,
                    task_desc,
                    workflow_instance.id,
                    next_step.id
                )
            
            # 记录日志
            log = WorkflowLog(
                id=cls.generate_uuid(),
                workflow_instance_id=workflow_instance.id,
                step_execution_id=next_step.id,
                timestamp=cls.now(),
                level="INFO",
                message=f"步骤 {next_step.name} 开始执行",
                created_at=cls.now(),
            )
            db.add(log)
            
            db.commit()
        else:
            # 没有更多步骤，工作流完成
            workflow_instance.status = "completed"
            workflow_instance.completed_at = cls.now()
            
            # 计算总耗时
            if workflow_instance.started_at:
                start = datetime.fromisoformat(workflow_instance.started_at.replace("Z", "+00:00"))
                end = datetime.now(timezone.utc)
                workflow_instance.duration = int((end - start).total_seconds())
            
            # 记录日志
            log = WorkflowLog(
                id=cls.generate_uuid(),
                workflow_instance_id=workflow_instance.id,
                timestamp=cls.now(),
                level="INFO",
                message="工作流执行完成",
                created_at=cls.now(),
            )
            db.add(log)
            
            db.commit()
    
    @classmethod
    def get_next_step(
        cls,
        workflow_instance: WorkflowInstance,
        current_step_id: str,
        db: Session
    ) -> Optional[StepExecution]:
        """
        获取下一个可执行的步骤
        
        重构说明：统一使用 get_steps_from_template 和 check_dependencies 方法
        避免数据源和依赖检查逻辑的不一致
        
        Args:
            workflow_instance: 工作流实例
            current_step_id: 当前步骤ID
            db: 数据库会话
            
        Returns:
            下一个步骤执行记录，如果没有则返回None
        """
        try:
            # 获取所有步骤执行记录
            step_executions = db.query(StepExecution).filter(
                StepExecution.workflow_instance_id == workflow_instance.id
            ).all()
            
            # 构建步骤 ID 到执行记录的映射
            step_map = {se.step_id: se for se in step_executions}
            
            # 获取当前步骤的执行记录
            current_step_exec = step_map.get(current_step_id)
            if not current_step_exec:
                logger.warning(f"Current step {current_step_id} not found in instance {workflow_instance.id}")
                return None
            
            # 使用统一的数据源获取步骤定义
            steps = cls.get_steps_from_template(db, workflow_instance.template_id)
            
            # 找出所有未完成的步骤（pending状态）
            unfinished_steps = [
                step for step in steps 
                if step_map.get(step['id']) and 
                   step_map.get(step['id']).status == "pending"
            ]
            
            # 按顺序返回第一个依赖满足的步骤
            for step in unfinished_steps:
                # 使用统一的依赖检查方法
                if cls.check_dependencies(
                    db=db,
                    step_id=step['id'],
                    template_id=workflow_instance.template_id,
                    step_executions=step_executions
                ):
                    return step_map.get(step['id'])
            
            # 所有步骤已完成或依赖未满足
            return None
            
        except TemplateNotFoundError as e:
            logger.error(f"Template not found: {e}")
            return None
        except DependencyParseError as e:
            logger.error(f"Dependency parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in get_next_step: {e}")
            return None
