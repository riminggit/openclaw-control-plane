"""
Workflow Templates API 测试
测试工作流模板管理的12个端点

测试范围：
- 模板CRUD操作
- 模板状态管理（发布、归档）
- 模板版本管理
- DAG验证
- 搜索和过滤功能
"""
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# 设置测试数据库
TEST_DB = "sqlite:///./test_control_plane_templates.db"
os.environ["DATABASE_URL"] = TEST_DB

# 删除旧的测试数据库
_db_path = TEST_DB.split("///")[-1]
if os.path.exists(_db_path):
    os.unlink(_db_path)

from app.main import app
from app.db import get_db
from app.models.workflow import WorkflowTemplate, WorkflowTemplateVersion, StepDefinition
from app.schemas.workflow import DAGDefinition, StepNode, EdgeNode, WorkflowConfig
from tests.conftest import init_test_db

# 初始化最小工作流测试数据库
init_test_db()

client = TestClient(app)


class TestWorkflowTemplatesList:
    """测试模板列表功能"""
    
    def test_list_templates_default_params(self):
        """
        前置条件：数据库中存在模板
        操作步骤：调用GET /api/v1/workflow-templates（使用默认参数）
        预期结果：返回模板列表，包含分页信息
        """
        response = client.get("/api/v1/workflow-templates")
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证响应结构
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        
        # 验证默认分页
        assert data["page"] == 1
        assert data["page_size"] == 20
        
    def test_list_templates_with_pagination(self):
        """
        前置条件：数据库中存在多个模板
        操作步骤：调用GET /api/v1/workflow-templates?page=2&page_size=5
        预期结果：返回第二页数据，每页5条记录
        """
        response = client.get("/api/v1/workflow-templates?page=2&page_size=5")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 2
        assert data["page_size"] == 5
        
    def test_list_templates_with_status_filter(self):
        """
        前置条件：数据库中存在不同状态的模板
        操作步骤：调用GET /api/v1/workflow-templates?status=published
        预期结果：只返回已发布的模板
        """
        response = client.get("/api/v1/workflow-templates?status=published")
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证所有返回的模板都是published状态
        for template in data["data"]:
            assert template["status"] == "published"
            
    def test_list_templates_with_search(self):
        """
        前置条件：数据库中存在包含特定关键词的模板
        操作步骤：调用GET /api/v1/workflow-templates?search=test
        预期结果：返回名称或描述中包含"test"的模板
        """
        response = client.get("/api/v1/workflow-templates?search=test")
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证返回的模板包含搜索关键词
        for template in data["data"]:
            assert (
                "test" in template["name"].lower() or
                "test" in (template.get("description") or "").lower()
            )
            
    def test_list_templates_with_sorting(self):
        """
        前置条件：数据库中存在多个模板
        操作步骤：调用GET /api/v1/workflow-templates?sort_by=name&sort_order=asc
        预期结果：按名称升序排列的模板列表
        """
        response = client.get("/api/v1/workflow-templates?sort_by=name&sort_order=asc")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) > 1:
            # 验证排序
            names = [t["name"] for t in data["data"]]
            assert names == sorted(names)


class TestWorkflowTemplatesCreate:
    """测试模板创建功能"""
    
    def test_create_template_with_minimal_data(self):
        """
        前置条件：无
        操作步骤：创建一个包含最小必填字段的模板
        预期结果：返回201状态码，模板创建成功，状态为draft
        """
        template_data = {
            "name": f"Test Template {uuid.uuid4().hex[:8]}",
            "description": "Test description",
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
        
        response = client.post("/api/v1/workflow-templates", json=template_data)
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["name"] == template_data["name"]
        assert data["description"] == template_data["description"]
        assert data["status"] == "draft"
        assert data["version"] == "v1.0"
        assert "id" in data
        assert "created_at" in data
        
    def test_create_template_with_config(self):
        """
        前置条件：无
        操作步骤：创建一个包含config配置的模板
        预期结果：模板创建成功，config被正确保存
        """
        template_data = {
            "name": f"Test Template with Config {uuid.uuid4().hex[:8]}",
            "description": "Test with config",
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
            },
            "config": {
                "timeout_seconds": 3600,
                "max_retries": 3,
                "notification": {
                    "on_start": True,
                    "on_complete": True,
                    "on_error": True
                }
            }
        }
        
        response = client.post("/api/v1/workflow-templates", json=template_data)
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["config"]["timeout_seconds"] == 3600
        assert data["config"]["max_retries"] == 3
        
    def test_create_template_with_complex_dag(self):
        """
        前置条件：无
        操作步骤：创建一个包含多个步骤和依赖关系的复杂DAG
        预期结果：DAG验证通过，模板创建成功
        """
        template_data = {
            "name": f"Complex Workflow {uuid.uuid4().hex[:8]}",
            "description": "Complex DAG with dependencies",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Start",
                        "agent": "agent-1",
                        "human_review": False
                    },
                    {
                        "id": "step2",
                        "name": "Process",
                        "agent": "agent-2",
                        "depends_on": ["step1"],
                        "human_review": True
                    },
                    {
                        "id": "step3",
                        "name": "Finish",
                        "agent": "agent-3",
                        "depends_on": ["step2"],
                        "human_review": False
                    }
                ],
                "edges": [
                    {"source": "step1", "target": "step2"},
                    {"source": "step2", "target": "step3"}
                ]
            }
        }
        
        response = client.post("/api/v1/workflow-templates", json=template_data)
        
        assert response.status_code == 201
        data = response.json()
        
        assert len(data["dag"]["steps"]) == 3
        assert len(data["dag"]["edges"]) == 2
        
    def test_create_template_with_tags(self):
        """
        前置条件：无
        操作步骤：创建一个带有标签的模板
        预期结果：标签被正确保存和返回
        """
        template_data = {
            "name": f"Tagged Template {uuid.uuid4().hex[:8]}",
            "description": "Template with tags",
            "tags": ["production", "important", "v2"],
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
        
        response = client.post("/api/v1/workflow-templates", json=template_data)
        
        assert response.status_code == 201
        data = response.json()
        
        assert "production" in data["tags"]
        assert "important" in data["tags"]
        
    def test_create_template_invalid_dag_empty_steps(self):
        """
        前置条件：无
        操作步骤：创建一个没有步骤的模板
        预期结果：返回400错误，DAG验证失败
        """
        template_data = {
            "name": "Invalid Template",
            "description": "Empty DAG",
            "dag": {
                "steps": [],
                "edges": []
            }
        }
        
        response = client.post("/api/v1/workflow-templates", json=template_data)
        
        assert response.status_code == 400
        data = response.json()
        
        assert data["detail"]["code"] == "INVALID_DAG"
        assert "至少一个步骤" in str(data["detail"]["details"]["errors"])
        
    def test_create_template_invalid_dag_duplicate_step_ids(self):
        """
        前置条件：无
        操作步骤：创建一个步骤ID重复的模板
        预期结果：返回400错误，步骤ID必须唯一
        """
        template_data = {
            "name": "Duplicate IDs Template",
            "description": "Invalid DAG",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "First",
                        "agent": "agent-1",
                        "human_review": False
                    },
                    {
                        "id": "step1",
                        "name": "Second",
                        "agent": "agent-2",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        response = client.post("/api/v1/workflow-templates", json=template_data)
        
        assert response.status_code == 400
        data = response.json()
        
        assert data["detail"]["code"] == "INVALID_DAG"
        assert "唯一" in str(data["detail"]["details"]["errors"])


class TestWorkflowTemplatesGet:
    """测试获取模板详情功能"""
    
    def test_get_template_by_id(self):
        """
        前置条件：创建一个模板
        操作步骤：通过ID获取模板详情
        预期结果：返回完整的模板信息
        """
        # 先创建模板
        create_data = {
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
        
        create_response = client.post("/api/v1/workflow-templates", json=create_data)
        assert create_response.status_code == 201
        template_id = create_response.json()["id"]
        
        # 获取模板详情
        get_response = client.get(f"/api/v1/workflow-templates/{template_id}")
        
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert data["id"] == template_id
        assert data["name"] == create_data["name"]
        assert data["description"] == create_data["description"]
        assert "dag" in data
        assert "steps" in data["dag"]
        
    def test_get_template_not_found(self):
        """
        前置条件：无
        操作步骤：获取一个不存在的模板ID
        预期结果：返回404错误
        """
        response = client.get("/api/v1/workflow-templates/non-existent-id")
        
        assert response.status_code == 404
        data = response.json()
        
        assert data["detail"]["code"] == "TEMPLATE_NOT_FOUND"


class TestWorkflowTemplatesUpdate:
    """测试模板更新功能"""
    
    def test_update_template_name(self):
        """
        前置条件：创建一个模板
        操作步骤：更新模板名称
        预期结果：名称更新成功，版本号自动递增
        """
        # 创建模板
        create_data = {
            "name": f"Update Test {uuid.uuid4().hex[:8]}",
            "description": "Original description",
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
        
        create_response = client.post("/api/v1/workflow-templates", json=create_data)
        template_id = create_response.json()["id"]
        original_version = create_response.json()["version"]
        
        # 更新名称
        update_data = {"name": "Updated Name"}
        update_response = client.put(
            f"/api/v1/workflow-templates/{template_id}",
            json=update_data
        )
        
        assert update_response.status_code == 200
        data = update_response.json()
        
        assert data["name"] == "Updated Name"
        # 名称更新不改变版本号
        assert data["version"] == original_version
        
    def test_update_template_dag(self):
        """
        前置条件：创建一个模板
        操作步骤：更新模板的DAG（添加新步骤）
        预期结果：DAG更新成功，版本号递增
        """
        # 创建模板
        create_data = {
            "name": f"DAG Update Test {uuid.uuid4().hex[:8]}",
            "description": "Test DAG update",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Original Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        create_response = client.post("/api/v1/workflow-templates", json=create_data)
        template_id = create_response.json()["id"]
        original_version = create_response.json()["version"]
        
        # 更新DAG
        update_data = {
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Updated Step 1",
                        "agent": "test-agent",
                        "human_review": False
                    },
                    {
                        "id": "step2",
                        "name": "New Step 2",
                        "agent": "test-agent-2",
                        "human_review": True
                    }
                ],
                "edges": [
                    {"source": "step1", "target": "step2"}
                ]
            }
        }
        
        update_response = client.put(
            f"/api/v1/workflow-templates/{template_id}",
            json=update_data
        )
        
        assert update_response.status_code == 200
        data = update_response.json()
        
        assert len(data["dag"]["steps"]) == 2
        assert data["version"] != original_version  # 版本号应该递增
        
    def test_update_template_not_found(self):
        """
        前置条件：无
        操作步骤：更新一个不存在的模板
        预期结果：返回404错误
        """
        update_data = {"name": "Updated Name"}
        response = client.put(
            "/api/v1/workflow-templates/non-existent-id",
            json=update_data
        )
        
        assert response.status_code == 404


class TestWorkflowTemplatesDelete:
    """测试模板删除功能"""
    
    def test_delete_template(self):
        """
        前置条件：创建一个模板
        操作步骤：删除模板
        预期结果：返回成功消息，模板被删除
        """
        # 创建模板
        create_data = {
            "name": f"Delete Test {uuid.uuid4().hex[:8]}",
            "description": "To be deleted",
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
        
        create_response = client.post("/api/v1/workflow-templates", json=create_data)
        template_id = create_response.json()["id"]
        
        # 删除模板
        delete_response = client.delete(f"/api/v1/workflow-templates/{template_id}")
        
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] is True
        
        # 验证模板已被删除
        get_response = client.get(f"/api/v1/workflow-templates/{template_id}")
        assert get_response.status_code == 404
        
    def test_delete_template_not_found(self):
        """
        前置条件：无
        操作步骤：删除一个不存在的模板
        预期结果：返回404错误
        """
        response = client.delete("/api/v1/workflow-templates/non-existent-id")
        
        assert response.status_code == 404


class TestWorkflowTemplatesPublish:
    """测试模板发布功能"""
    
    def test_publish_draft_template(self):
        """
        前置条件：创建一个draft状态的模板
        操作步骤：发布模板
        预期结果：模板状态变为published，记录发布时间
        """
        # 创建draft模板
        create_data = {
            "name": f"Publish Test {uuid.uuid4().hex[:8]}",
            "description": "To be published",
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
        
        create_response = client.post("/api/v1/workflow-templates", json=create_data)
        template_id = create_response.json()["id"]
        
        # 发布模板
        publish_response = client.post(
            f"/api/v1/workflow-templates/{template_id}/publish"
        )
        
        assert publish_response.status_code == 200
        data = publish_response.json()
        
        assert data["status"] == "published"
        assert data["published_at"] is not None
        
    def test_publish_already_published_template(self):
        """
        前置条件：创建并发布一个模板
        操作步骤：再次发布已发布的模板
        预期结果：返回400错误
        """
        # 创建并发布模板
        create_data = {
            "name": f"Already Published {uuid.uuid4().hex[:8]}",
            "description": "Already published",
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
        
        create_response = client.post("/api/v1/workflow-templates", json=create_data)
        template_id = create_response.json()["id"]
        
        publish_response = client.post(
            f"/api/v1/workflow-templates/{template_id}/publish"
        )
        assert publish_response.status_code == 200
        
        # 再次尝试发布
        second_publish_response = client.post(
            f"/api/v1/workflow-templates/{template_id}/publish"
        )
        
        assert second_publish_response.status_code == 400
        assert "只有草稿状态" in second_publish_response.json()["detail"]["message"]


class TestWorkflowTemplatesArchive:
    """测试模板归档功能"""
    
    def test_archive_template(self):
        """
        前置条件：创建一个模板
        操作步骤：归档模板
        预期结果：模板状态变为archived
        """
        # 创建模板
        create_data = {
            "name": f"Archive Test {uuid.uuid4().hex[:8]}",
            "description": "To be archived",
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
        
        create_response = client.post("/api/v1/workflow-templates", json=create_data)
        template_id = create_response.json()["id"]
        
        # 归档模板
        archive_response = client.post(
            f"/api/v1/workflow-templates/{template_id}/archive"
        )
        
        assert archive_response.status_code == 200
        data = archive_response.json()
        
        assert data["status"] == "archived"


class TestWorkflowTemplatesDuplicate:
    """测试模板复制功能"""
    
    def test_duplicate_template(self):
        """
        前置条件：创建并发布一个模板
        操作步骤：复制模板
        预期结果：创建一个新的draft状态模板，内容与原模板相同
        """
        # 创建并发布模板
        create_data = {
            "name": f"Original Template {uuid.uuid4().hex[:8]}",
            "description": "Original",
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
        
        create_response = client.post("/api/v1/workflow-templates", json=create_data)
        template_id = create_response.json()["id"]
        
        client.post(f"/api/v1/workflow-templates/{template_id}/publish")
        
        # 复制模板
        duplicate_data = {
            "name": f"Duplicated Template {uuid.uuid4().hex[:8]}",
            "description": "Duplicated from original"
        }
        
        duplicate_response = client.post(
            f"/api/v1/workflow-templates/{template_id}/duplicate",
            json=duplicate_data
        )
        
        assert duplicate_response.status_code == 201
        data = duplicate_response.json()
        
        assert data["name"] == duplicate_data["name"]
        assert data["status"] == "draft"  # 复制的模板应该是draft状态
        assert data["id"] != template_id  # 应该是新的ID


class TestWorkflowTemplatesVersions:
    """测试模板版本管理功能"""
    
    def test_list_template_versions(self):
        """
        前置条件：创建一个模板并多次更新
        操作步骤：获取版本历史
        预期结果：返回版本列表，包含版本号和变更说明
        """
        # 创建模板
        create_data = {
            "name": f"Version Test {uuid.uuid4().hex[:8]}",
            "description": "Test versioning",
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
        
        create_response = client.post("/api/v1/workflow-templates", json=create_data)
        template_id = create_response.json()["id"]
        
        # 更新DAG以触发版本递增
        update_data = {
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Updated Step",
                        "agent": "test-agent",
                        "human_review": False
                    },
                    {
                        "id": "step2",
                        "name": "New Step",
                        "agent": "test-agent-2",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        client.put(
            f"/api/v1/workflow-templates/{template_id}",
            json=update_data
        )
        
        # 获取版本历史
        versions_response = client.get(
            f"/api/v1/workflow-templates/{template_id}/versions"
        )
        
        assert versions_response.status_code == 200
        data = versions_response.json()
        
        assert "data" in data
        assert data["total"] >= 2  # 至少有初始版本和更新版本
        
    def test_rollback_template_version(self):
        """
        前置条件：创建模板并进行多次更新
        操作步骤：回滚到之前的版本
        预期结果：模板恢复到指定版本的状态，创建新版本记录
        """
        # 创建模板
        create_data = {
            "name": f"Rollback Test {uuid.uuid4().hex[:8]}",
            "description": "Test rollback",
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Original Step",
                        "agent": "test-agent",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        create_response = client.post("/api/v1/workflow-templates", json=create_data)
        template_id = create_response.json()["id"]
        original_version = create_response.json()["version"]
        
        # 更新DAG
        update_data = {
            "dag": {
                "steps": [
                    {
                        "id": "step1",
                        "name": "Updated Step",
                        "agent": "test-agent",
                        "human_review": False
                    },
                    {
                        "id": "step2",
                        "name": "New Step",
                        "agent": "test-agent-2",
                        "human_review": False
                    }
                ],
                "edges": []
            }
        }
        
        client.put(
            f"/api/v1/workflow-templates/{template_id}",
            json=update_data
        )
        
        # 回滚到原始版本
        rollback_data = {"version": original_version}
        rollback_response = client.post(
            f"/api/v1/workflow-templates/{template_id}/rollback",
            json=rollback_data
        )
        
        assert rollback_response.status_code == 200
        data = rollback_response.json()
        
        # 验证DAG已恢复
        assert len(data["dag"]["steps"]) == 1
        assert data["dag"]["steps"][0]["name"] == "Original Step"


# 清理测试数据库
def teardown_module(module):
    """测试结束后清理"""
    if os.path.exists(_db_path):
        os.unlink(_db_path)
