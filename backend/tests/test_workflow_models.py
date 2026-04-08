"""
Workflow Models 测试
测试数据模型的创建、关系映射和验证

测试范围：
- WorkflowTemplate模型
- WorkflowInstance模型
- StepDefinition模型
- StepExecution模型
- 模型关系映射
"""
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone

from app.models.base import Base
from app.models.workflow import (
    WorkflowTemplate, WorkflowInstance, StepDefinition, 
    StepExecution, WorkflowLog, ReviewRecord, WorkflowEvent
)


# 测试数据库
TEST_DB_URL = "sqlite:///./test_models.db"

# 删除旧数据库
_db_path = TEST_DB_URL.split("///")[-1]
if os.path.exists(_db_path):
    os.unlink(_db_path)

# 创建引擎和会话
engine = create_engine(TEST_DB_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """创建测试数据库会话"""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.close()
    Base.metadata.drop_all(bind=engine)


class TestWorkflowTemplateModel:
    """测试WorkflowTemplate模型"""
    
    def test_create_template_with_minimal_fields(self, db):
        """
        前置条件：无
        操作步骤：创建包含最小必填字段的模板
        预期结果：模板创建成功
        """
        template = WorkflowTemplate(
            id="template-001",
            name="Test Template",
            version="v1.0",
            status="draft",
            dag='{"steps": [], "edges": []}',
            config="{}",
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001",
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        assert template.id == "template-001"
        assert template.name == "Test Template"
        assert template.status == "draft"
        assert template.usage_count == 0
        
    def test_create_template_with_all_fields(self, db):
        """
        前置条件：无
        操作步骤：创建包含所有字段的模板
        预期结果：模板创建成功，所有字段保存正确
        """
        template = WorkflowTemplate(
            id="template-002",
            name="Full Template",
            description="Complete template",
            version="v2.0",
            status="published",
            dag='{"steps": [{"id": "s1"}], "edges": []}',
            config='{"timeout": 60}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-002",
            updated_at=datetime.now(timezone.utc).isoformat(),
            published_at=datetime.now(timezone.utc).isoformat(),
            usage_count=10,
            tags='["prod", "important"]'
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        assert template.description == "Complete template"
        assert template.published_at is not None
        assert template.usage_count == 10
        
    def test_template_relationships(self, db):
        """
        前置条件：创建模板和实例
        操作步骤：查询模板的关系
        预期结果：关系正确映射
        """
        template = WorkflowTemplate(
            id="template-003",
            name="Template with Instance",
            version="v1.0",
            status="published",
            dag='{}',
            config='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001",
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add(template)
        
        instance = WorkflowInstance(
            id="instance-001",
            template_id="template-003",
            template_version="v1.0",
            status="pending",
            input='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001"
        )
        db.add(instance)
        db.commit()
        
        # 查询关系
        db.refresh(template)
        assert len(template.instances) == 1
        assert template.instances[0].id == "instance-001"


class TestWorkflowInstanceModel:
    """测试WorkflowInstance模型"""
    
    def test_create_instance_with_minimal_fields(self, db):
        """
        前置条件：创建模板
        操作步骤：创建工作流实例
        预期结果：实例创建成功
        """
        # 创建模板
        template = WorkflowTemplate(
            id="template-004",
            name="Test",
            version="v1.0",
            status="published",
            dag='{}',
            config='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001",
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add(template)
        
        instance = WorkflowInstance(
            id="instance-002",
            template_id="template-004",
            template_version="v1.0",
            status="pending",
            input='{"param": "value"}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001"
        )
        
        db.add(instance)
        db.commit()
        db.refresh(instance)
        
        assert instance.id == "instance-002"
        assert instance.status == "pending"
        assert instance.progress == 0
        
    def test_instance_status_transitions(self, db):
        """
        前置条件：创建实例
        操作步骤：更新实例状态
        预期结果：状态更新成功
        """
        template = WorkflowTemplate(
            id="template-005",
            name="Test",
            version="v1.0",
            status="published",
            dag='{}',
            config='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001",
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add(template)
        
        instance = WorkflowInstance(
            id="instance-003",
            template_id="template-005",
            template_version="v1.0",
            status="pending",
            input='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001"
        )
        db.add(instance)
        db.commit()
        
        # 更新状态
        instance.status = "running"
        instance.started_at = datetime.now(timezone.utc).isoformat()
        db.commit()
        
        db.refresh(instance)
        assert instance.status == "running"
        
        # 完成工作流
        instance.status = "completed"
        instance.completed_at = datetime.now(timezone.utc).isoformat()
        instance.duration = 100
        db.commit()
        
        db.refresh(instance)
        assert instance.status == "completed"
        assert instance.duration == 100


class TestStepExecutionModel:
    """测试StepExecution模型"""
    
    def test_create_step_execution(self, db):
        """
        前置条件：创建模板和实例
        操作步骤：创建步骤执行记录
        预期结果：记录创建成功
        """
        template = WorkflowTemplate(
            id="template-006",
            name="Test",
            version="v1.0",
            status="published",
            dag='{}',
            config='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001",
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add(template)
        
        instance = WorkflowInstance(
            id="instance-004",
            template_id="template-006",
            template_version="v1.0",
            status="running",
            input='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001"
        )
        db.add(instance)
        
        step_exec = StepExecution(
            id="step-exec-001",
            workflow_instance_id="instance-004",
            step_id="step1",
            name="First Step",
            status="pending",
            agent_name="agent-001",
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        
        db.add(step_exec)
        db.commit()
        db.refresh(step_exec)
        
        assert step_exec.id == "step-exec-001"
        assert step_exec.status == "pending"
        assert step_exec.retry_count == 0
        assert step_exec.max_retries == 3
        
    def test_step_execution_progress_update(self, db):
        """
        前置条件：创建步骤执行记录
        操作步骤：更新进度
        预期结果：进度更新成功
        """
        template = WorkflowTemplate(
            id="template-007",
            name="Test",
            version="v1.0",
            status="published",
            dag='{}',
            config='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001",
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add(template)
        
        instance = WorkflowInstance(
            id="instance-005",
            template_id="template-007",
            template_version="v1.0",
            status="running",
            input='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001"
        )
        db.add(instance)
        
        step_exec = StepExecution(
            id="step-exec-002",
            workflow_instance_id="instance-005",
            step_id="step1",
            name="Step",
            status="running",
            progress=0,
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add(step_exec)
        db.commit()
        
        # 更新进度
        step_exec.progress = 50
        step_exec.progress_message = "Halfway done"
        db.commit()
        
        db.refresh(step_exec)
        assert step_exec.progress == 50
        assert step_exec.progress_message == "Halfway done"


class TestReviewRecordModel:
    """测试ReviewRecord模型"""
    
    def test_create_review_record(self, db):
        """
        前置条件：创建模板、实例和步骤
        操作步骤：创建审核记录
        预期结果：记录创建成功
        """
        template = WorkflowTemplate(
            id="template-008",
            name="Test",
            version="v1.0",
            status="published",
            dag='{}',
            config='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001",
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add(template)
        
        instance = WorkflowInstance(
            id="instance-006",
            template_id="template-008",
            template_version="v1.0",
            status="running",
            input='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001"
        )
        db.add(instance)
        
        step_exec = StepExecution(
            id="step-exec-003",
            workflow_instance_id="instance-006",
            step_id="step1",
            name="Review Step",
            status="awaiting_review",
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add(step_exec)
        
        review = ReviewRecord(
            id="review-001",
            workflow_instance_id="instance-006",
            step_execution_id="step-exec-003",
            reviewer_id="reviewer-001",
            reviewer_name="John Doe",
            action="approve",
            comment="LGTM",
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat(),
            timeout_action="auto_reject",
            review_round=1
        )
        
        db.add(review)
        db.commit()
        db.refresh(review)
        
        assert review.id == "review-001"
        assert review.action == "approve"
        assert review.review_round == 1


class TestWorkflowLogModel:
    """测试WorkflowLog模型"""
    
    def test_create_workflow_log(self, db):
        """
        前置条件：创建工作流实例
        操作步骤：创建日志记录
        预期结果：日志创建成功
        """
        template = WorkflowTemplate(
            id="template-009",
            name="Test",
            version="v1.0",
            status="published",
            dag='{}',
            config='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001",
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add(template)
        
        instance = WorkflowInstance(
            id="instance-007",
            template_id="template-009",
            template_version="v1.0",
            status="running",
            input='{}',
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="user-001"
        )
        db.add(instance)
        
        log = WorkflowLog(
            id="log-001",
            workflow_instance_id="instance-007",
            timestamp=datetime.now(timezone.utc).isoformat(),
            level="INFO",
            message="Workflow started",
            created_at=datetime.now(timezone.utc).isoformat()
        )
        
        db.add(log)
        db.commit()
        db.refresh(log)
        
        assert log.id == "log-001"
        assert log.level == "INFO"
        assert log.message == "Workflow started"


# 清理测试数据库
def teardown_module(module):
    """测试结束后清理"""
    if os.path.exists(_db_path):
        os.unlink(_db_path)
