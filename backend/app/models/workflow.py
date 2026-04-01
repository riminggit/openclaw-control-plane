"""
Workflow Management Models

SQLAlchemy models for workflow management system.
Based on docs/design/workflow-schema.sql
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, String, Text, Integer, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.ext.declarative import declarative_base

from .base import Base


class WorkflowTemplate(Base):
    """工作流模板表"""
    __tablename__ = "workflow_templates"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    version: Mapped[str] = mapped_column(String, nullable=False, default="v1.0")
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")  # draft / published / archived
    dag: Mapped[str] = mapped_column(Text, nullable=False)  # DAG 定义（步骤 + 边）JSON
    config: Mapped[str] = mapped_column(Text, nullable=False, default="{}")  # 全局配置 JSON
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    created_by: Mapped[str] = mapped_column(String, nullable=False)  # 关联 User.id
    updated_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    published_at: Mapped[Optional[str]] = mapped_column(String)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tags: Mapped[Optional[str]] = mapped_column(Text)  # 标签数组（JSON 格式）
    
    # Relationships
    instances: Mapped[List["WorkflowInstance"]] = relationship("WorkflowInstance", back_populates="template")
    step_definitions: Mapped[List["StepDefinition"]] = relationship("StepDefinition", back_populates="template", cascade="all, delete-orphan")
    versions: Mapped[List["WorkflowTemplateVersion"]] = relationship("WorkflowTemplateVersion", back_populates="template", cascade="all, delete-orphan")


class WorkflowInstance(Base):
    """工作流实例表"""
    __tablename__ = "workflow_instances"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    template_id: Mapped[str] = mapped_column(String, ForeignKey("workflow_templates.id", ondelete="RESTRICT"), nullable=False)
    template_version: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")  # pending / running / paused / completed / failed / terminated
    input: Mapped[str] = mapped_column(Text, nullable=False, default="{}")  # JSON
    output: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_remaining: Mapped[Optional[int]] = mapped_column(Integer)  # 预估剩余时间（秒）
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    created_by: Mapped[str] = mapped_column(String, nullable=False)  # 关联 User.id
    started_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)
    duration: Mapped[Optional[int]] = mapped_column(Integer)  # 实际耗时（秒）
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    termination_reason: Mapped[Optional[str]] = mapped_column(Text)
    
    # Relationships
    template: Mapped["WorkflowTemplate"] = relationship("WorkflowTemplate", back_populates="instances")
    step_executions: Mapped[List["StepExecution"]] = relationship("StepExecution", back_populates="workflow_instance", cascade="all, delete-orphan")
    logs: Mapped[List["WorkflowLog"]] = relationship("WorkflowLog", back_populates="workflow_instance", cascade="all, delete-orphan")
    reviews: Mapped[List["ReviewRecord"]] = relationship("ReviewRecord", back_populates="workflow_instance", cascade="all, delete-orphan")
    artifacts: Mapped[List["WorkflowArtifact"]] = relationship("WorkflowArtifact", back_populates="workflow_instance", cascade="all, delete-orphan")
    events: Mapped[List["WorkflowEvent"]] = relationship("WorkflowEvent", back_populates="workflow_instance", cascade="all, delete-orphan")
    scheduler_queue: Mapped[List["WorkflowSchedulerQueue"]] = relationship("WorkflowSchedulerQueue", back_populates="workflow_instance", cascade="all, delete-orphan")


class StepDefinition(Base):
    """步骤定义表"""
    __tablename__ = "step_definitions"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    template_id: Mapped[str] = mapped_column(String, ForeignKey("workflow_templates.id", ondelete="CASCADE"), nullable=False)
    step_id: Mapped[str] = mapped_column(String, nullable=False)  # 模板中的步骤 ID
    name: Mapped[str] = mapped_column(String, nullable=False)
    agent: Mapped[Optional[str]] = mapped_column(String)  # Agent 名称或 ID
    capabilities: Mapped[Optional[str]] = mapped_column(Text)  # Agent 能力标签（JSON 数组）
    estimated_duration: Mapped[Optional[int]] = mapped_column(Integer)  # 预估时长（分钟）
    input_schema: Mapped[Optional[str]] = mapped_column(Text)  # 输入参数 schema JSON
    output_schema: Mapped[Optional[str]] = mapped_column(Text)  # 输出参数 schema JSON
    validation_rules: Mapped[Optional[str]] = mapped_column(Text)  # 验证规则 JSON
    human_review: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 是否需要人工审核（0/1）
    retry_policy: Mapped[Optional[str]] = mapped_column(Text)  # 重试策略 JSON
    timeout_seconds: Mapped[Optional[int]] = mapped_column(Integer)  # 超时时间（秒）
    parallel_group: Mapped[Optional[str]] = mapped_column(String)  # 并行组 ID
    checker_agent: Mapped[Optional[str]] = mapped_column(String)  # 互审方 Agent
    min_issues: Mapped[Optional[int]] = mapped_column(Integer)  # 互审方必须提出的最少问题数
    depends_on: Mapped[Optional[str]] = mapped_column(Text)  # 依赖的步骤 ID 列表（JSON 数组）
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    
    # Relationships
    template: Mapped["WorkflowTemplate"] = relationship("WorkflowTemplate", back_populates="step_definitions")


class StepExecution(Base):
    """步骤执行表"""
    __tablename__ = "step_executions"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    workflow_instance_id: Mapped[str] = mapped_column(String, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False)
    step_id: Mapped[str] = mapped_column(String, nullable=False)  # 对应模板中的步骤 ID
    name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")  # pending / ready / assigned / running / awaiting_review / approved / rejected / retrying / completed / failed / cancelled / skipped
    agent_id: Mapped[Optional[str]] = mapped_column(String)  # 执行的 Agent ID
    agent_name: Mapped[Optional[str]] = mapped_column(String)
    input: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    output: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    progress_message: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)
    duration: Mapped[Optional[int]] = mapped_column(Integer)  # 实际耗时（秒）
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    error_stack: Mapped[Optional[str]] = mapped_column(Text)
    force_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0/1
    force_completed_by: Mapped[Optional[str]] = mapped_column(String)
    force_completed_reason: Mapped[Optional[str]] = mapped_column(Text)
    force_completed_at: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    
    # Relationships
    workflow_instance: Mapped["WorkflowInstance"] = relationship("WorkflowInstance", back_populates="step_executions")
    reviews: Mapped[List["ReviewRecord"]] = relationship("ReviewRecord", back_populates="step_execution", cascade="all, delete-orphan")
    logs: Mapped[List["WorkflowLog"]] = relationship("WorkflowLog", back_populates="step_execution")
    artifacts: Mapped[List["WorkflowArtifact"]] = relationship("WorkflowArtifact", back_populates="step_execution")


class ReviewRecord(Base):
    """审核记录表"""
    __tablename__ = "review_records"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    workflow_instance_id: Mapped[str] = mapped_column(String, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False)
    step_execution_id: Mapped[str] = mapped_column(String, ForeignKey("step_executions.id", ondelete="CASCADE"), nullable=False)
    reviewer_id: Mapped[str] = mapped_column(String, nullable=False)  # 审核人 ID
    reviewer_name: Mapped[Optional[str]] = mapped_column(String)
    action: Mapped[Optional[str]] = mapped_column(String)  # approve / reject / request_changes
    comment: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    timeout_at: Mapped[Optional[str]] = mapped_column(String)  # 超时时间
    timeout_action: Mapped[str] = mapped_column(String, default="auto_reject")  # auto_reject / auto_approve / escalate / notify_only
    remaining_time: Mapped[Optional[int]] = mapped_column(Integer)  # 剩余时间（秒）
    review_round: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 审核轮次
    
    # Relationships
    workflow_instance: Mapped["WorkflowInstance"] = relationship("WorkflowInstance", back_populates="reviews")
    step_execution: Mapped["StepExecution"] = relationship("StepExecution", back_populates="reviews")


class WorkflowLog(Base):
    """工作流日志表"""
    __tablename__ = "workflow_logs"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    workflow_instance_id: Mapped[str] = mapped_column(String, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False)
    step_execution_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("step_executions.id", ondelete="CASCADE"))
    timestamp: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    level: Mapped[str] = mapped_column(String, nullable=False, default="INFO")  # INFO / WARN / ERROR / DEBUG
    message: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    
    # Relationships
    workflow_instance: Mapped["WorkflowInstance"] = relationship("WorkflowInstance", back_populates="logs")
    step_execution: Mapped[Optional["StepExecution"]] = relationship("StepExecution", back_populates="logs")


# Agent model is defined in app/models/agent.py to avoid duplication


class WorkflowTemplateVersion(Base):
    """工作流模板版本历史表"""
    __tablename__ = "workflow_template_versions"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    template_id: Mapped[str] = mapped_column(String, ForeignKey("workflow_templates.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[str] = mapped_column(String, nullable=False)
    dag: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    config: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    change_summary: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    
    # Relationships
    template: Mapped["WorkflowTemplate"] = relationship("WorkflowTemplate", back_populates="versions")


class WorkflowSchedulerQueue(Base):
    """工作流调度队列表"""
    __tablename__ = "workflow_scheduler_queue"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    workflow_instance_id: Mapped[str] = mapped_column(String, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False)
    step_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")  # pending / ready / running / completed / failed
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    retry_after: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    scheduled_at: Mapped[Optional[str]] = mapped_column(String)
    started_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    
    # Relationships
    workflow_instance: Mapped["WorkflowInstance"] = relationship("WorkflowInstance", back_populates="scheduler_queue")


class WorkflowArtifact(Base):
    """工作流产出物表"""
    __tablename__ = "workflow_artifacts"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    workflow_instance_id: Mapped[str] = mapped_column(String, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False)
    step_execution_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("step_executions.id", ondelete="SET NULL"))
    artifact_type: Mapped[str] = mapped_column(String, nullable=False)  # file / document / data / code
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    storage_kind: Mapped[str] = mapped_column(String, nullable=False, default="local")  # local / feishu / s3
    storage_path: Mapped[Optional[str]] = mapped_column(Text)  # 文件路径或 URL
    metadata_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    checksum: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    
    # Relationships
    workflow_instance: Mapped["WorkflowInstance"] = relationship("WorkflowInstance", back_populates="artifacts")
    step_execution: Mapped[Optional["StepExecution"]] = relationship("StepExecution", back_populates="artifacts")


class WorkflowEvent(Base):
    """工作流事件表"""
    __tablename__ = "workflow_events"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    workflow_instance_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("workflow_instances.id", ondelete="CASCADE"))
    step_execution_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("step_executions.id", ondelete="CASCADE"))
    event_type: Mapped[str] = mapped_column(String, nullable=False)  # workflow.started / step.completed / review.approved 等
    event_data: Mapped[Optional[str]] = mapped_column(Text)  # JSON
    actor_type: Mapped[Optional[str]] = mapped_column(String)  # user / agent / system
    actor_id: Mapped[Optional[str]] = mapped_column(String)
    timestamp: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    created_at: Mapped[str] = mapped_column(String, nullable=False, default=lambda: datetime.utcnow().isoformat())
    
    # Relationships
    workflow_instance: Mapped[Optional["WorkflowInstance"]] = relationship("WorkflowInstance", back_populates="events")
