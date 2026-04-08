"""
Workflow Instance Service 测试
测试工作流实例服务的核心业务逻辑

测试范围：
- 实例创建
- 依赖检查
- DAG解析
- 工作流推进
- 状态转换
"""
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone

from app.models.base import Base
from app.models.workflow import (
    WorkflowTemplate, WorkflowInstance, StepExecution, StepDefinition
)
from app.services.workflow.instance_service import (
    WorkflowInstanceService,
    TemplateNotFoundError,
    DependencyParseError
)


# 测试数据库
TEST_DB_URL = "sqlite:///./test_service.db"

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


@pytest.fixture
def sample_template(db):
    """创建示例模板"""
    template = WorkflowTemplate(
        id="test-template-001",
        name="Test Template",
        description="Test template for service",
        version="v1.0",
        status="published",
        dag='{"steps": [{"id": "step1", "name": "First", "agent": "agent-1"}, {"id": "step2", "name": "Second", "agent": "agent-2", "depends_on": ["step1"]}], "edges": [{"source": "step1", "target": "step2"}]}',
        config="{}",
        created_at=datetime.now(timezone.utc).isoformat(),
        created_by="test-user",
        updated_at=datetime.now(timezone.utc).isoformat(),
        tags="[]"
    )
    db.add(template)
    db.commit()
    return template


class TestWorkflowInstanceServiceCreate:
    """测试工作流实例创建"""
    
    def test_create_instance_success(self, db, sample_template):
        """
        前置条件：存在已发布的模板
        操作步骤：创建工作流实例
        预期结果：实例创建成功，步骤被正确复制
        """
        service = WorkflowInstanceService()
        
        input_data = {"param1": "value1", "param2": 123}
        user_id = "test-user-001"
        
        instance = service.create_instance(
            template_id=sample_template.id,
            input_data=input_data,
            user_id=user_id,
            db=db
        )
        
        assert instance is not None
        assert instance.template_id == sample_template.id
        assert instance.status == "pending"
        assert instance.created_by == user_id
        
        # 验证步骤被创建
        step_executions = db.query(StepExecution).filter(
            StepExecution.workflow_instance_id == instance.id
        ).all()
        
        assert len(step_executions) == 2
        
    def test_create_instance_template_not_found(self, db):
        """
        前置条件：模板不存在
        操作步骤：尝试创建实例
        预期结果：抛出TemplateNotFoundError异常
        """
        service = WorkflowInstanceService()
        
        with pytest.raises(ValueError, match="不存在"):
            service.create_instance(
                template_id="non-existent-template",
                input_data={},
                user_id="test-user",
                db=db
            )
            
    def test_create_instance_draft_template_fails(self, db):
        """
        前置条件：模板状态为draft
        操作步骤：尝试创建实例
        预期结果：抛出异常
        """
        # 创建draft模板
        draft_template = WorkflowTemplate(
            id="draft-template-001",
            name="Draft Template",
            description="Draft",
            version="v1.0",
            status="draft",
            dag='{"steps": [{"id": "step1", "name": "Step"}], "edges": []}',
            config="{}",
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="test-user",
            updated_at=datetime.now(timezone.utc).isoformat(),
            tags="[]"
        )
        db.add(draft_template)
        db.commit()
        
        service = WorkflowInstanceService()
        
        with pytest.raises(ValueError, match="只有已发布的模板"):
            service.create_instance(
                template_id=draft_template.id,
                input_data={},
                user_id="test-user",
                db=db
            )


class TestWorkflowInstanceServiceDAGParse:
    """测试DAG解析功能"""
    
    def test_get_steps_from_template_success(self, db, sample_template):
        """
        前置条件：存在包含DAG的模板
        操作步骤：解析DAG获取步骤列表
        预期结果：返回正确的步骤列表
        """
        service = WorkflowInstanceService()
        
        steps = service.get_steps_from_template(db, sample_template.id)
        
        assert len(steps) == 2
        assert steps[0]["id"] == "step1"
        assert steps[1]["id"] == "step2"
        
    def test_get_steps_from_template_not_found(self, db):
        """
        前置条件：模板不存在
        操作步骤：尝试解析DAG
        预期结果：抛出TemplateNotFoundError异常
        """
        service = WorkflowInstanceService()
        
        with pytest.raises(TemplateNotFoundError):
            service.get_steps_from_template(db, "non-existent-template")
            
    def test_parse_dependencies_string(self, db):
        """
        前置条件：依赖字段为JSON字符串
        操作步骤：解析依赖
        预期结果：返回正确的依赖列表
        """
        service = WorkflowInstanceService()
        
        depends_on_str = '["step1", "step2"]'
        dependencies = service.parse_dependencies(depends_on_str)
        
        assert len(dependencies) == 2
        assert "step1" in dependencies
        assert "step2" in dependencies
        
    def test_parse_dependencies_list(self, db):
        """
        前置条件：依赖字段为列表
        操作步骤：解析依赖
        预期结果：返回正确的依赖列表
        """
        service = WorkflowInstanceService()
        
        depends_on_list = ["step1", "step2"]
        dependencies = service.parse_dependencies(depends_on_list)
        
        assert len(dependencies) == 2
        assert "step1" in dependencies
        
    def test_parse_dependencies_empty(self, db):
        """
        前置条件：依赖字段为空
        操作步骤：解析依赖
        预期结果：返回空列表
        """
        service = WorkflowInstanceService()
        
        dependencies = service.parse_dependencies(None)
        assert dependencies == []
        
        dependencies = service.parse_dependencies([])
        assert dependencies == []
        
    def test_parse_dependencies_invalid_json_fails(self, db):
        """
        前置条件：依赖字段为无效JSON
        操作步骤：解析依赖
        预期结果：抛出DependencyParseError异常
        """
        service = WorkflowInstanceService()
        
        with pytest.raises(DependencyParseError):
            service.parse_dependencies("invalid-json")


class TestWorkflowInstanceServiceDependencyCheck:
    """测试依赖检查功能"""
    
    def test_check_dependencies_satisfied(self, db, sample_template):
        """
        前置条件：步骤的依赖已完成
        操作步骤：检查依赖是否满足
        预期结果：返回True
        """
        service = WorkflowInstanceService()
        
        # 创建实例
        instance = WorkflowInstance(
            id="test-instance-001",
            template_id=sample_template.id,
            template_version="v1.0",
            status="running",
            input="{}",
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="test-user"
        )
        db.add(instance)
        
        # 创建步骤执行记录
        step1_exec = StepExecution(
            id="step1-exec-id",
            workflow_instance_id=instance.id,
            step_id="step1",
            name="First",
            status="completed",  # step1已完成
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        step2_exec = StepExecution(
            id="step2-exec-id",
            workflow_instance_id=instance.id,
            step_id="step2",
            name="Second",
            status="pending",
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add_all([step1_exec, step2_exec])
        db.commit()
        
        # 检查step2的依赖（依赖step1）
        step_executions = [step1_exec, step2_exec]
        is_satisfied = service.check_dependencies(
            db=db,
            step_id="step2",
            template_id=sample_template.id,
            step_executions=step_executions
        )
        
        assert is_satisfied is True
        
    def test_check_dependencies_not_satisfied(self, db, sample_template):
        """
        前置条件：步骤的依赖未完成
        操作步骤：检查依赖是否满足
        预期结果：返回False
        """
        service = WorkflowInstanceService()
        
        # 创建实例
        instance = WorkflowInstance(
            id="test-instance-002",
            template_id=sample_template.id,
            template_version="v1.0",
            status="running",
            input="{}",
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="test-user"
        )
        db.add(instance)
        
        # 创建步骤执行记录（step1未完成）
        step1_exec = StepExecution(
            id="step1-exec-id-2",
            workflow_instance_id=instance.id,
            step_id="step1",
            name="First",
            status="running",  # step1正在运行
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        step2_exec = StepExecution(
            id="step2-exec-id-2",
            workflow_instance_id=instance.id,
            step_id="step2",
            name="Second",
            status="pending",
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add_all([step1_exec, step2_exec])
        db.commit()
        
        # 检查step2的依赖（依赖step1）
        step_executions = [step1_exec, step2_exec]
        is_satisfied = service.check_dependencies(
            db=db,
            step_id="step2",
            template_id=sample_template.id,
            step_executions=step_executions
        )
        
        assert is_satisfied is False
        
    def test_check_dependencies_no_dependencies(self, db, sample_template):
        """
        前置条件：步骤无依赖
        操作步骤：检查依赖
        预期结果：返回True
        """
        service = WorkflowInstanceService()
        
        # 创建实例
        instance = WorkflowInstance(
            id="test-instance-003",
            template_id=sample_template.id,
            template_version="v1.0",
            status="running",
            input="{}",
            created_at=datetime.now(timezone.utc).isoformat(),
            created_by="test-user"
        )
        db.add(instance)
        
        # 创建step1执行记录（无依赖）
        step1_exec = StepExecution(
            id="step1-exec-id-3",
            workflow_instance_id=instance.id,
            step_id="step1",
            name="First",
            status="pending",
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat()
        )
        db.add(step1_exec)
        db.commit()
        
        # 检查step1的依赖（无依赖）
        is_satisfied = service.check_dependencies(
            db=db,
            step_id="step1",
            template_id=sample_template.id,
            step_executions=[step1_exec]
        )
        
        assert is_satisfied is True


class TestWorkflowInstanceServiceAdvance:
    """测试工作流推进功能"""
    
    def test_advance_workflow_starts_first_step(self, db, sample_template):
        """
        前置条件：工作流实例刚创建
        操作步骤：推进工作流
        预期结果：第一个步骤开始执行
        """
        service = WorkflowInstanceService()
        
        # 创建实例
        instance = service.create_instance(
            template_id=sample_template.id,
            input_data={},
            user_id="test-user",
            db=db
        )
        
        # 创建步骤执行记录（pending状态）
        step_executions = db.query(StepExecution).filter(
            StepExecution.workflow_instance_id == instance.id
        ).all()
        
        # 推进工作流
        service.advance_workflow(instance, db)
        
        # 刷新实例
        db.refresh(instance)
        
        # 验证第一个步骤开始执行
        first_step = db.query(StepExecution).filter(
            StepExecution.workflow_instance_id == instance.id,
            StepExecution.step_id == "step1"
        ).first()
        
        assert first_step.status == "running"
        assert first_step.started_at is not None
        
    def test_advance_workflow_completes_when_all_done(self, db, sample_template):
        """
        前置条件：所有步骤都已完成
        操作步骤：推进工作流
        预期结果：工作流状态变为completed
        """
        service = WorkflowInstanceService()
        
        # 创建实例
        instance = service.create_instance(
            template_id=sample_template.id,
            input_data={},
            user_id="test-user",
            db=db
        )
        
        # 获取所有步骤并标记为完成
        step_executions = db.query(StepExecution).filter(
            StepExecution.workflow_instance_id == instance.id
        ).all()
        
        for step_exec in step_executions:
            step_exec.status = "completed"
            step_exec.completed_at = datetime.now(timezone.utc).isoformat()
            
        db.commit()
        
        # 推进工作流
        service.advance_workflow(instance, db)
        
        # 刷新实例
        db.refresh(instance)
        
        # 验证工作流已完成
        assert instance.status == "completed"
        assert instance.completed_at is not None


class TestWorkflowInstanceServiceGetNextStep:
    """测试获取下一步功能"""
    
    def test_get_next_step_with_dependencies(self, db, sample_template):
        """
        前置条件：第一个步骤已完成，第二个步骤依赖第一个
        操作步骤：获取下一个步骤
        预期结果：返回第二个步骤
        """
        service = WorkflowInstanceService()
        
        # 创建实例
        instance = service.create_instance(
            template_id=sample_template.id,
            input_data={},
            user_id="test-user",
            db=db
        )
        
        # 标记第一个步骤为完成
        step1_exec = db.query(StepExecution).filter(
            StepExecution.workflow_instance_id == instance.id,
            StepExecution.step_id == "step1"
        ).first()
        
        step1_exec.status = "completed"
        step1_exec.completed_at = datetime.now(timezone.utc).isoformat()
        db.commit()
        
        # 获取下一个步骤
        next_step = service.get_next_step(
            workflow_instance=instance,
            current_step_id="step1",
            db=db
        )
        
        assert next_step is not None
        assert next_step.step_id == "step2"
        
    def test_get_next_step_no_more_steps(self, db, sample_template):
        """
        前置条件：所有步骤都已完成
        操作步骤：获取下一个步骤
        预期结果：返回None
        """
        service = WorkflowInstanceService()
        
        # 创建实例
        instance = service.create_instance(
            template_id=sample_template.id,
            input_data={},
            user_id="test-user",
            db=db
        )
        
        # 标记所有步骤为完成
        step_executions = db.query(StepExecution).filter(
            StepExecution.workflow_instance_id == instance.id
        ).all()
        
        for step_exec in step_executions:
            step_exec.status = "completed"
            step_exec.completed_at = datetime.now(timezone.utc).isoformat()
            
        db.commit()
        
        # 获取下一个步骤
        next_step = service.get_next_step(
            workflow_instance=instance,
            current_step_id="step2",
            db=db
        )
        
        assert next_step is None


# 清理测试数据库
def teardown_module(module):
    """测试结束后清理"""
    if os.path.exists(_db_path):
        os.unlink(_db_path)
