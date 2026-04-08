"""
Workflow Instances API 测试
测试工作流实例管理的端点

测试范围：
- 实例创建和查询
- 工作流控制操作（启动、暂停、恢复、终止）
- 步骤执行状态
- 日志查询
- Agent集成
"""
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# 设置测试数据库
TEST_DB = "sqlite:///./test_control_plane_instances.db"
os.environ["DATABASE_URL"] = TEST_DB

# 删除旧的测试数据库
_db_path = TEST_DB.split("///")[-1]
if os.path.exists(_db_path):
    os.unlink(_db_path)

from app.main import app
from app.db import get_db
from app.models.workflow import WorkflowTemplate, WorkflowInstance, StepExecution
from tests.conftest import init_test_db

# 初始化最小工作流测试数据库
init_test_db()

client = TestClient(app)


class TestWorkflowInstancesList:
    """测试工作流实例列表功能"""
    
    def test_list_instances_default_params(self):
        """
        前置条件：数据库中存在工作流实例
        操作步骤：调用GET /api/v1/workflow-instances（使用默认参数）
        预期结果：返回实例列表，包含分页信息
        """
        response = client.get("/api/v1/workflow-instances")
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证响应结构
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        
    def test_list_instances_with_status_filter(self):
        """
        前置条件：数据库中存在不同状态的实例
        操作步骤：调用GET /api/v1/workflow-instances?status=running
        预期结果：只返回running状态的实例
        """
        response = client.get("/api/v1/workflow-instances?status=running")
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证所有返回的实例都是running状态
        for instance in data["data"]:
            assert instance["status"] == "running"
            
    def test_list_instances_with_template_filter(self):
        """
        前置条件：数据库中存在基于不同模板的实例
        操作步骤：调用GET /api/v1/workflow-instances?template_id=xxx
        预期结果：只返回指定模板的实例
        """
        # 先创建一个模板和实例
        template_data = {
            "name": f"Test Template {uuid.uuid4().hex[:8]}",
            "description": "For filter test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        # 发布模板
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        # 创建实例
        instance_data = {"template_id": template_id, "input": {}}
        client.post("/api/v1/workflow-instances", json=instance_data)
        
        # 按模板ID过滤
        response = client.get(f"/api/v1/workflow-instances?template_id={template_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        for instance in data["data"]:
            assert instance["template_id"] == template_id


class TestWorkflowInstancesCreate:
    """测试工作流实例创建功能"""
    
    def test_create_instance_from_published_template(self):
        """
        前置条件：存在一个已发布的模板
        操作步骤：基于模板创建工作流实例
        预期结果：返回201状态码，实例创建成功，状态为pending
        """
        # 创建并发布模板
        template_data = {
            "name": f"Instance Test Template {uuid.uuid4().hex[:8]}",
            "description": "For instance creation",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "First Step",
                        "agent": "test-agent",
                        "human_review": False
                    },
                    {
                        "id": "step2",
                        "name": "Second Step",
                        "agent": "test-agent-2",
                        "human_review": False
                    }
                ],
                "edges": [
                    {"source": "step1", "target": "step2"}
                ]
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        # 发布模板
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        # 创建实例
        instance_data = {
            "template_id": template_id,
            "input": {
                "param1": "value1",
                "param2": 123
            }
        }
        
        response = client.post("/api/v1/workflow-instances", json=instance_data)
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["template_id"] == template_id
        assert data["status"] == "pending"
        assert data["input"]["param1"] == "value1"
        assert data["input"]["param2"] == 123
        assert "id" in data
        assert "created_at" in data
        
    def test_create_instance_from_draft_template_fails(self):
        """
        前置条件：存在一个draft状态的模板
        操作步骤：尝试基于draft模板创建实例
        预期结果：返回400错误
        """
        # 创建draft模板
        template_data = {
            "name": f"Draft Template {uuid.uuid4().hex[:8]}",
            "description": "Draft",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        # 尝试创建实例
        instance_data = {"template_id": template_id, "input": {}}
        response = client.post("/api/v1/workflow-instances", json=instance_data)
        
        assert response.status_code == 400
        data = response.json()
        
        assert data["detail"]["code"] == "TEMPLATE_NOT_PUBLISHED"
        
    def test_create_instance_steps_copied_from_template(self):
        """
        前置条件：创建一个包含多个步骤的模板
        操作步骤：基于模板创建实例
        预期结果：实例包含与模板相同数量和配置的步骤
        """
        # 创建模板
        template_data = {
            "name": f"Multi-step Template {uuid.uuid4().hex[:8]}",
            "description": "Multi-step workflow",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step 1",
                        "agent": "agent-1",
                        "human_review": False
                    },
                    {
                        "id": "step2",
                        "name": "Step 2",
                        "agent": "agent-2",
                        "human_review": True
                    },
                    {
                        "id": "step3",
                        "name": "Step 3",
                        "agent": "agent-3",
                        "human_review": False
                    }
                ],
                "edges": [
                    {"source": "step1", "target": "step2"},
                    {"source": "step2", "target": "step3"}
                ]
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        # 发布模板
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        # 创建实例
        instance_data = {"template_id": template_id, "input": {}}
        response = client.post("/api/v1/workflow-instances", json=instance_data)
        
        assert response.status_code == 201
        data = response.json()
        
        # 获取实例详情查看步骤
        detail_response = client.get(f"/api/v1/workflow-instances/{data['id']}")
        instance_detail = detail_response.json()
        
        # 验证步骤数量和配置
        assert len(instance_detail["steps"]) == 3
        assert instance_detail["steps"][0]["name"] == "Step 1"
        assert instance_detail["steps"][0]["agent_name"] == "agent-1"


class TestWorkflowInstancesGet:
    """测试获取工作流实例详情功能"""
    
    def test_get_instance_by_id(self):
        """
        前置条件：创建一个工作流实例
        操作步骤：通过ID获取实例详情
        预期结果：返回完整的实例信息，包含所有步骤执行状态
        """
        # 创建模板和实例
        template_data = {
            "name": f"Get Test Template {uuid.uuid4().hex[:8]}",
            "description": "For get test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]
        
        # 获取实例详情
        get_response = client.get(f"/api/v1/workflow-instances/{instance_id}")
        
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert data["id"] == instance_id
        assert data["template_id"] == template_id
        assert "steps" in data
        assert len(data["steps"]) > 0
        
    def test_get_instance_not_found(self):
        """
        前置条件：无
        操作步骤：获取一个不存在的实例ID
        预期结果：返回404错误
        """
        response = client.get("/api/v1/workflow-instances/non-existent-id")
        
        assert response.status_code == 404
        data = response.json()
        
        assert data["detail"]["code"] == "INSTANCE_NOT_FOUND"


class TestWorkflowInstancesStart:
    """测试工作流启动功能"""
    
    def test_start_pending_instance(self):
        """
        前置条件：创建一个pending状态的实例
        操作步骤：启动工作流
        预期结果：实例状态变为running，记录启动时间
        """
        # 创建模板和实例
        template_data = {
            "name": f"Start Test Template {uuid.uuid4().hex[:8]}",
            "description": "For start test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "First Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]
        
        # 启动工作流
        start_response = client.post(f"/api/v1/workflow-instances/{instance_id}/start")
        
        assert start_response.status_code == 200
        data = start_response.json()
        
        assert data["status"] == "running"
        assert data["started_at"] is not None
        
    def test_start_already_running_instance_fails(self):
        """
        前置条件：创建并启动一个工作流实例
        操作步骤：再次尝试启动
        预期结果：返回400错误
        """
        # 创建模板和实例
        template_data = {
            "name": f"Already Running Template {uuid.uuid4().hex[:8]}",
            "description": "Test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]
        
        # 启动工作流
        client.post(f"/api/v1/workflow-instances/{instance_id}/start")
        
        # 再次启动
        second_start_response = client.post(f"/api/v1/workflow-instances/{instance_id}/start")
        
        assert second_start_response.status_code == 400
        assert "只有 pending" in second_start_response.json()["detail"]["message"]


class TestWorkflowInstancesPause:
    """测试工作流暂停功能"""
    
    def test_pause_running_instance(self):
        """
        前置条件：创建并启动一个工作流实例
        操作步骤：暂停工作流
        预期结果：实例状态变为paused
        """
        # 创建模板和实例
        template_data = {
            "name": f"Pause Test Template {uuid.uuid4().hex[:8]}",
            "description": "For pause test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]
        
        # 启动工作流
        client.post(f"/api/v1/workflow-instances/{instance_id}/start")
        
        # 暂停工作流
        pause_response = client.post(f"/api/v1/workflow-instances/{instance_id}/pause")
        
        assert pause_response.status_code == 200
        data = pause_response.json()
        
        assert data["status"] == "paused"
        
    def test_pause_not_running_instance_fails(self):
        """
        前置条件：创建一个pending状态的实例（未启动）
        操作步骤：尝试暂停
        预期结果：返回400错误
        """
        # 创建模板和实例（不启动）
        template_data = {
            "name": f"Not Running Template {uuid.uuid4().hex[:8]}",
            "description": "Test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]
        
        # 尝试暂停（未启动的实例）
        pause_response = client.post(f"/api/v1/workflow-instances/{instance_id}/pause")
        
        assert pause_response.status_code == 400
        assert "只有 running" in pause_response.json()["detail"]["message"]


class TestWorkflowInstancesResume:
    """测试工作流恢复功能"""
    
    def test_resume_paused_instance(self):
        """
        前置条件：创建、启动并暂停一个工作流实例
        操作步骤：恢复工作流
        预期结果：实例状态变为running
        """
        # 创建模板和实例
        template_data = {
            "name": f"Resume Test Template {uuid.uuid4().hex[:8]}",
            "description": "For resume test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]
        
        # 启动
        client.post(f"/api/v1/workflow-instances/{instance_id}/start")
        
        # 暂停
        client.post(f"/api/v1/workflow-instances/{instance_id}/pause")
        
        # 恢复
        resume_response = client.post(f"/api/v1/workflow-instances/{instance_id}/resume")
        
        assert resume_response.status_code == 200
        data = resume_response.json()
        
        assert data["status"] == "running"
        
    def test_resume_not_paused_instance_fails(self):
        """
        前置条件：创建并启动一个工作流实例（未暂停）
        操作步骤：尝试恢复
        预期结果：返回400错误
        """
        # 创建模板和实例
        template_data = {
            "name": f"Not Paused Template {uuid.uuid4().hex[:8]}",
            "description": "Test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]
        
        # 启动（不暂停）
        client.post(f"/api/v1/workflow-instances/{instance_id}/start")
        
        # 尝试恢复
        resume_response = client.post(f"/api/v1/workflow-instances/{instance_id}/resume")
        
        assert resume_response.status_code == 400
        assert "只有 paused" in resume_response.json()["detail"]["message"]


class TestWorkflowInstancesStop:
    """测试工作流终止功能"""
    
    def test_stop_running_instance(self):
        """
        前置条件：创建并启动一个工作流实例
        操作步骤：终止工作流，提供终止原因
        预期结果：实例状态变为terminated，记录终止原因
        """
        # 创建模板和实例
        template_data = {
            "name": f"Stop Test Template {uuid.uuid4().hex[:8]}",
            "description": "For stop test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]
        
        # 启动
        client.post(f"/api/v1/workflow-instances/{instance_id}/start")
        
        # 终止
        stop_data = {"reason": "User requested termination"}
        stop_response = client.post(
            f"/api/v1/workflow-instances/{instance_id}/stop",
            json=stop_data
        )
        
        assert stop_response.status_code == 200
        data = stop_response.json()
        
        assert data["status"] == "terminated"
        assert data["termination_reason"] == "User requested termination"
        assert data["completed_at"] is not None
        
    def test_stop_already_finished_instance_fails(self):
        """
        前置条件：创建并终止一个实例
        操作步骤：再次调用终止接口
        预期结果：返回400错误，提示实例已结束
        """
        template_data = {
            "name": f"Finished Instance Template {uuid.uuid4().hex[:8]}",
            "description": "For finished stop test",
            "dag": {
                "steps": [
                    {"id": "step1", "name": "Step", "agent": "test-agent", "human_review": False}
                ],
                "edges": []
            }
        }

        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")

        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]

        client.post(f"/api/v1/workflow-instances/{instance_id}/start")
        first_stop = client.post(
            f"/api/v1/workflow-instances/{instance_id}/stop",
            json={"reason": "first stop"}
        )
        assert first_stop.status_code == 200

        second_stop = client.post(
            f"/api/v1/workflow-instances/{instance_id}/stop",
            json={"reason": "second stop"}
        )
        assert second_stop.status_code == 400
        assert second_stop.json()["detail"]["code"] == "INSTANCE_ALREADY_FINISHED"


class TestWorkflowInstancesSteps:
    """测试步骤执行管理功能"""
    
    def test_list_instance_steps(self):
        """
        前置条件：创建一个包含多个步骤的工作流实例
        操作步骤：获取步骤列表
        预期结果：返回所有步骤执行记录，包含状态和agent信息
        """
        # 创建模板和实例
        template_data = {
            "name": f"Steps Test Template {uuid.uuid4().hex[:8]}",
            "description": "For steps test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "First",
                        "agent": "agent-1",
                        "human_review": False
                    },
                    {
                        "id": "step2",
                        "name": "Second",
                        "agent": "agent-2",
                        "human_review": False
                    }
                ],
                "edges": [
                    {"source": "step1", "target": "step2"}
                ]
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]
        
        # 获取步骤列表
        steps_response = client.get(f"/api/v1/workflow-instances/{instance_id}/steps")
        
        assert steps_response.status_code == 200
        data = steps_response.json()
        
        assert "data" in data
        assert data["total"] == 2
        
        # 验证步骤信息
        step_names = [s["name"] for s in data["data"]]
        assert "First" in step_names
        assert "Second" in step_names


class TestWorkflowInstancesLogs:
    """测试工作流日志功能"""
    
    def test_list_instance_logs(self):
        """
        前置条件：创建并启动一个工作流实例，产生日志
        操作步骤：获取工作流日志
        预期结果：返回日志列表，包含时间戳、级别、消息
        """
        # 创建模板和实例
        template_data = {
            "name": f"Logs Test Template {uuid.uuid4().hex[:8]}",
            "description": "For logs test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]
        
        # 启动工作流（会产生日志）
        client.post(f"/api/v1/workflow-instances/{instance_id}/start")
        
        # 获取日志
        logs_response = client.get(f"/api/v1/workflow-instances/{instance_id}/logs")
        
        assert logs_response.status_code == 200
        data = logs_response.json()
        
        assert "data" in data
        assert "total" in data
        
        # 验证日志结构
        if data["total"] > 0:
            log = data["data"][0]
            assert "timestamp" in log
            assert "level" in log
            assert "message" in log
            
    def test_list_instance_logs_with_level_filter(self):
        """
        前置条件：工作流执行产生不同级别的日志
        操作步骤：按日志级别过滤
        预期结果：只返回指定级别的日志
        """
        # 创建模板和实例
        template_data = {
            "name": f"Level Filter Test {uuid.uuid4().hex[:8]}",
            "description": "Test",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        template_response = client.post("/api/v1/workflow-templates", json=template_data)
        template_id = template_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        instance_data = {"template_id": template_id, "input": {}}
        create_response = client.post("/api/v1/workflow-instances", json=instance_data)
        instance_id = create_response.json()["id"]
        
        # 启动工作流
        client.post(f"/api/v1/workflow-instances/{instance_id}/start")
        
        # 获取INFO级别日志
        logs_response = client.get(
            f"/api/v1/workflow-instances/{instance_id}/logs?level=INFO"
        )
        
        assert logs_response.status_code == 200
        data = logs_response.json()
        
        # 验证所有日志都是INFO级别
        for log in data["data"]:
            assert log["level"] == "INFO"


class TestWorkflowInstancesAgents:
    """测试Agent集成功能"""
    
    def test_list_available_agents(self):
        """
        前置条件：系统中有可用的agent
        操作步骤：获取可用agent列表
        预期结果：返回agent列表，包含ID、名称、状态
        """
        response = client.get("/api/v1/workflow-instances/agents")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "data" in data
        assert "total" in data
        
        # 验证agent结构
        if data["total"] > 0:
            agent = data["data"][0]
            assert "id" in agent
            assert "name" in agent
            assert "status" in agent


# 清理测试数据库
def teardown_module(module):
    """测试结束后清理"""
    if os.path.exists(_db_path):
        os.unlink(_db_path)
