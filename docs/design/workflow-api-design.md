# OpenClaw Control Plane - 工作流管理系统 API 设计文档

> **版本**: v1.0
> **日期**: 2026-04-01
> **作者**: rd-lead
> **状态**: 设计阶段

---

## 目录

1. [文件结构](#1-文件结构)
2. [API 端点清单](#2-api-端点清单)
   - 2.1 [工作流模板 API](#21-工作流模板-api)
   - 2.2 [工作流实例 API](#22-工作流实例-api)
   - 2.3 [步骤执行 API](#23-步骤执行-api)
   - 2.4 [人工审核 API](#24-人工审核-api)
   - 2.5 [Agent 管理 API](#25-agent-管理-api)
   - 2.6 [统计与监控 API](#26-统计与监控-api)
   - 2.7 [产出物管理 API](#27-产出物管理-api)
3. [WebSocket 事件](#3-websocket-事件)
4. [Gateway 集成方案](#4-gateway-集成方案)
5. [错误码定义](#5-错误码定义)
6. [通用数据结构](#6-通用数据结构)
7. [认证与权限](#7-认证与权限)

---

## 1. 文件结构

### 1.1 后端文件结构

```
backend/app/
├── api/
│   ├── __init__.py
│   ├── workflow/
│   │   ├── __init__.py
│   │   ├── templates.py        # 工作流模板 API
│   │   ├── instances.py        # 工作流实例 API
│   │   ├── steps.py            # 步骤执行 API
│   │   ├── reviews.py          # 人工审核 API
│   │   ├── agents.py           # Agent 管理 API
│   │   ├── artifacts.py        # 产出物管理 API
│   │   └── stats.py            # 统计与监控 API
│   ├── websocket.py            # WebSocket 处理
│   └── deps.py                 # 依赖注入
├── services/
│   ├── workflow/
│   │   ├── template_service.py       # 模板服务
│   │   ├── instance_service.py       # 实例服务
│   │   ├── step_service.py           # 步骤服务
│   │   ├── scheduler_service.py      # DAG 调度器
│   │   ├── agent_matcher_service.py  # Agent 匹配器
│   │   └── review_service.py         # 审核服务
│   ├── gateway/
│   │   ├── gateway_client.py         # Gateway API 客户端
│   │   └── agent_dispatcher.py       # Agent 任务分发器
│   └── notification/
│       ├── notification_service.py   # 通知服务
│       └── websocket_manager.py      # WebSocket 连接管理
├── models/
│   └── workflow.py             # 工作流相关模型（扩展现有 models.py）
├── schemas/
│   └── workflow.py             # Pydantic schemas
└── tasks/
    ├── scheduler_task.py       # Celery 调度任务
    └── timeout_task.py         # 超时检查任务
```

### 1.2 前端文件结构

```
frontend/src/
├── api/
│   ├── workflow.ts             # 工作流 API 客户端
│   ├── templates.ts            # 模板 API
│   ├── instances.ts            # 实例 API
│   ├── steps.ts                # 步骤 API
│   ├── reviews.ts              # 审核 API
│   ├── agents.ts               # Agent API
│   └── websocket.ts            # WebSocket 客户端
├── components/
│   ├── workflow/
│   │   ├── DAGEditor.tsx       # DAG 编辑器组件
│   │   ├── DAGViewer.tsx       # DAG 可视化组件
│   │   ├── StepCard.tsx        # 步骤卡片
│   │   ├── ReviewModal.tsx     # 审核弹窗
│   │   └── ProgressRing.tsx    # 进度环
│   └── ...
├── pages/
│   ├── workflows/
│   │   ├── Templates.tsx       # 模板列表页
│   │   ├── TemplateDetail.tsx  # 模板详情页
│   │   ├── Instances.tsx       # 实例列表页
│   │   ├── InstanceDetail.tsx  # 实例详情页
│   │   └── Reviews.tsx         # 审核中心页
│   └── ...
└── hooks/
    ├── useWorkflow.ts          # 工作流相关 hooks
    ├── useWebSocket.ts         # WebSocket hook
    └── usePolling.ts           # 轮询 hook
```

---

## 2. API 端点清单

### 2.1 工作流模板 API

#### 2.1.1 获取模板列表

**端点**: `GET /api/v1/workflow-templates`

**权限**: `viewer`

**查询参数**:
- `page` (integer, optional): 页码，默认 1
- `page_size` (integer, optional): 每页数量，默认 20，最大 100
- `status` (string, optional): 状态筛选（draft / published / archived）
- `search` (string, optional): 搜索关键词（名称/描述）
- `tags` (string, optional): 标签筛选（逗号分隔）
- `created_by` (string, optional): 创建者 ID
- `sort_by` (string, optional): 排序字段（created_at / usage_count / name），默认 created_at
- `sort_order` (string, optional): 排序方向（asc / desc），默认 desc

**请求示例**:
```http
GET /api/v1/workflow-templates?page=1&page_size=20&status=published&search=研发流水线&sort_by=usage_count&sort_order=desc
```

**响应体**:
```json
{
  "data": [
    {
      "id": "uuid-001",
      "name": "研发流水线-标准流程",
      "description": "完整的 20 步研发流水线",
      "version": "v1.0",
      "status": "published",
      "usage_count": 15,
      "tags": ["研发", "标准流程"],
      "created_at": "2026-04-01T10:00:00Z",
      "created_by": "user-001",
      "updated_at": "2026-04-01T12:00:00Z",
      "published_at": "2026-04-01T12:00:00Z",
      "step_count": 20
    }
  ],
  "total": 5,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

#### 2.1.2 获取模板详情

**端点**: `GET /api/v1/workflow-templates/{template_id}`

**权限**: `viewer`

**路径参数**:
- `template_id` (string, required): 模板 UUID

**响应体**:
```json
{
  "id": "uuid-001",
  "name": "研发流水线-标准流程",
  "description": "完整的 20 步研发流水线",
  "version": "v1.0",
  "status": "published",
  "dag": {
    "steps": [
      {
        "id": "step1",
        "name": "需求分析",
        "agent": "rd-product-researcher",
        "capabilities": ["research"],
        "estimated_duration": 60,
        "output": "docs/requirements.md",
        "validation": ["四部分完整"],
        "human_review": false,
        "depends_on": []
      }
    ],
    "edges": [
      {"source": "step1", "target": "step2"}
    ]
  },
  "config": {
    "single_step_timeout": 1800,
    "workflow_timeout": 86400,
    "max_retries": 3,
    "failure_strategy": "escalate"
  },
  "created_at": "2026-04-01T10:00:00Z",
  "created_by": "user-001",
  "updated_at": "2026-04-01T12:00:00Z",
  "published_at": "2026-04-01T12:00:00Z",
  "usage_count": 15,
  "tags": ["研发", "标准流程"],
  "steps": [
    {
      "id": "step1",
      "name": "需求分析",
      "agent": "rd-product-researcher",
      "estimated_duration": 60,
      "human_review": false
    }
  ]
}
```

#### 2.1.3 创建模板

**端点**: `POST /api/v1/workflow-templates`

**权限**: `editor`

**请求体**:
```json
{
  "name": "研发流水线-标准流程",
  "description": "完整的 20 步研发流水线",
  "dag": {
    "steps": [
      {
        "id": "step1",
        "name": "需求分析",
        "agent": "rd-product-researcher",
        "capabilities": ["research"],
        "estimated_duration": 60,
        "output": "docs/requirements.md",
        "validation": ["四部分完整"],
        "human_review": false,
        "depends_on": []
      }
    ],
    "edges": [
      {"source": "step1", "target": "step2"}
    ]
  },
  "config": {
    "single_step_timeout": 1800,
    "workflow_timeout": 86400,
    "max_retries": 3,
    "failure_strategy": "escalate"
  },
  "tags": ["研发", "标准流程"]
}
```

**响应体**: 同 2.1.2

#### 2.1.4 更新模板

**端点**: `PUT /api/v1/workflow-templates/{template_id}`

**权限**: `editor`

**路径参数**:
- `template_id` (string, required): 模板 UUID

**请求体**: 同 2.1.3

**响应体**: 同 2.1.2

#### 2.1.5 删除模板

**端点**: `DELETE /api/v1/workflow-templates/{template_id}`

**权限**: `admin`

**路径参数**:
- `template_id` (string, required): 模板 UUID

**响应体**:
```json
{
  "success": true,
  "message": "模板已删除"
}
```

#### 2.1.6 发布模板

**端点**: `POST /api/v1/workflow-templates/{template_id}/publish`

**权限**: `editor`

**路径参数**:
- `template_id` (string, required): 模板 UUID

**响应体**: 同 2.1.2（status 变为 published）

#### 2.1.7 归档模板

**端点**: `POST /api/v1/workflow-templates/{template_id}/archive`

**权限**: `editor`

**路径参数**:
- `template_id` (string, required): 模板 UUID

**响应体**: 同 2.1.2（status 变为 archived）

#### 2.1.8 复制模板

**端点**: `POST /api/v1/workflow-templates/{template_id}/duplicate`

**权限**: `editor`

**路径参数**:
- `template_id` (string, required): 模板 UUID

**请求体**:
```json
{
  "name": "研发流水线-自定义流程",
  "description": "基于标准流程的自定义版本"
}
```

**响应体**: 同 2.1.2（新创建的模板，status 为 draft）

#### 2.1.9 导入模板

**端点**: `POST /api/v1/workflow-templates/import`

**权限**: `editor`

**请求体**: `multipart/form-data`
- `file` (file, required): YAML 或 JSON 文件

**响应体**: 同 2.1.2

#### 2.1.10 导出模板

**端点**: `GET /api/v1/workflow-templates/{template_id}/export`

**权限**: `viewer`

**路径参数**:
- `template_id` (string, required): 模板 UUID

**查询参数**:
- `format` (string, optional): 导出格式（json / yaml），默认 json

**响应**: 文件下载

#### 2.1.11 获取模板版本历史

**端点**: `GET /api/v1/workflow-templates/{template_id}/versions`

**权限**: `viewer`

**路径参数**:
- `template_id` (string, required): 模板 UUID

**响应体**:
```json
{
  "data": [
    {
      "version": "v1.0",
      "change_summary": "初始版本",
      "created_at": "2026-04-01T10:00:00Z",
      "created_by": "user-001"
    },
    {
      "version": "v0.9",
      "change_summary": "草稿版本",
      "created_at": "2026-03-30T10:00:00Z",
      "created_by": "user-001"
    }
  ],
  "total": 2
}
```

#### 2.1.12 回滚到指定版本

**端点**: `POST /api/v1/workflow-templates/{template_id}/rollback`

**权限**: `editor`

**路径参数**:
- `template_id` (string, required): 模板 UUID

**请求体**:
```json
{
  "version": "v0.9"
}
```

**响应体**: 同 2.1.2

---

### 2.2 工作流实例 API

#### 2.2.1 获取实例列表

**端点**: `GET /api/v1/workflows`

**权限**: `viewer`

**查询参数**:
- `page` (integer, optional): 页码，默认 1
- `page_size` (integer, optional): 每页数量，默认 20
- `status` (string, optional): 状态筛选（pending / running / paused / completed / failed / terminated）
- `template_id` (string, optional): 模板 ID
- `created_by` (string, optional): 创建者 ID
- `start_date` (string, optional): 开始时间（ISO 8601）
- `end_date` (string, optional): 结束时间（ISO 8601）
- `sort_by` (string, optional): 排序字段，默认 created_at
- `sort_order` (string, optional): 排序方向，默认 desc

**响应体**:
```json
{
  "data": [
    {
      "id": "wf-001",
      "template_id": "uuid-001",
      "template_name": "研发流水线-标准流程",
      "template_version": "v1.0",
      "status": "running",
      "input": {
        "project_name": "OpenClaw Control Plane",
        "requirements_path": "/path/to/req.md"
      },
      "output": null,
      "progress": 65,
      "estimated_remaining": 1800,
      "created_at": "2026-04-01T10:00:00Z",
      "created_by": "user-001",
      "started_at": "2026-04-01T10:05:00Z",
      "completed_at": null,
      "duration": null,
      "current_step": {
        "step_id": "step5",
        "name": "UI + 架构 + 数据库设计",
        "status": "running",
        "agent_name": "rd-backend-arch",
        "progress": 45
      }
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

#### 2.2.2 获取实例详情

**端点**: `GET /api/v1/workflows/{workflow_id}`

**权限**: `viewer`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID

**响应体**:
```json
{
  "id": "wf-001",
  "template_id": "uuid-001",
  "template_name": "研发流水线-标准流程",
  "template_version": "v1.0",
  "status": "running",
  "input": {
    "project_name": "OpenClaw Control Plane",
    "requirements_path": "/path/to/req.md"
  },
  "output": null,
  "progress": 65,
  "estimated_remaining": 1800,
  "created_at": "2026-04-01T10:00:00Z",
  "created_by": "user-001",
  "started_at": "2026-04-01T10:05:00Z",
  "completed_at": null,
  "duration": null,
  "error_message": null,
  "termination_reason": null,
  "steps": [
    {
      "id": "se-001",
      "step_id": "step1",
      "name": "需求分析",
      "status": "completed",
      "agent_id": "agent-001",
      "agent_name": "rd-product-researcher",
      "progress": 100,
      "started_at": "2026-04-01T10:05:00Z",
      "completed_at": "2026-04-01T11:05:00Z",
      "duration": 3600,
      "retry_count": 0
    },
    {
      "id": "se-002",
      "step_id": "step2",
      "name": "需求验证",
      "status": "completed",
      "agent_id": "agent-002",
      "agent_name": "rd-commander",
      "progress": 100,
      "started_at": "2026-04-01T11:05:00Z",
      "completed_at": "2026-04-01T11:35:00Z",
      "duration": 1800,
      "retry_count": 0
    },
    {
      "id": "se-003",
      "step_id": "step3",
      "name": "PRD 编写",
      "status": "running",
      "agent_id": "agent-003",
      "agent_name": "rd-product-manager",
      "progress": 65,
      "progress_message": "正在编写功能需求",
      "started_at": "2026-04-01T11:35:00Z",
      "completed_at": null,
      "duration": null,
      "retry_count": 0,
      "human_review": true
    }
  ]
}
```

#### 2.2.3 启动新工作流

**端点**: `POST /api/v1/workflows`

**权限**: `editor`

**请求体**:
```json
{
  "template_id": "uuid-001",
  "input": {
    "project_name": "OpenClaw Control Plane",
    "requirements_path": "/path/to/req.md"
  },
  "execution_mode": "standard"
}
```

**响应体**: 同 2.2.2

#### 2.2.4 暂停工作流

**端点**: `POST /api/v1/workflows/{workflow_id}/pause`

**权限**: `editor`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID

**响应体**: 同 2.2.2（status 变为 paused）

#### 2.2.5 恢复工作流

**端点**: `POST /api/v1/workflows/{workflow_id}/resume`

**权限**: `editor`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID

**响应体**: 同 2.2.2（status 变为 running）

#### 2.2.6 终止工作流

**端点**: `POST /api/v1/workflows/{workflow_id}/terminate`

**权限**: `editor`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID

**请求体**:
```json
{
  "reason": "需求变更，项目暂停"
}
```

**响应体**: 同 2.2.2（status 变为 terminated）

#### 2.2.7 删除工作流实例

**端点**: `DELETE /api/v1/workflows/{workflow_id}`

**权限**: `admin`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID

**响应体**:
```json
{
  "success": true,
  "message": "工作流实例已删除"
}
```

#### 2.2.8 获取工作流日志

**端点**: `GET /api/v1/workflows/{workflow_id}/logs`

**权限**: `viewer`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID

**查询参数**:
- `level` (string, optional): 日志级别（INFO / WARN / ERROR / DEBUG）
- `step_id` (string, optional): 步骤 ID
- `start_time` (string, optional): 开始时间（ISO 8601）
- `end_time` (string, optional): 结束时间（ISO 8601）
- `search` (string, optional): 搜索关键词
- `limit` (integer, optional): 返回条数限制，默认 100

**响应体**:
```json
{
  "data": [
    {
      "id": "log-001",
      "step_execution_id": "se-003",
      "timestamp": "2026-04-01T11:40:00Z",
      "level": "INFO",
      "message": "开始执行 PRD 编写",
      "metadata": {
        "agent": "rd-product-manager"
      }
    }
  ],
  "total": 50
}
```

#### 2.2.9 导出工作流报告

**端点**: `GET /api/v1/workflows/{workflow_id}/export`

**权限**: `viewer`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID

**查询参数**:
- `format` (string, optional): 导出格式（pdf / json / html），默认 pdf

**响应**: 文件下载

#### 2.2.10 获取工作流事件时间线

**端点**: `GET /api/v1/workflows/{workflow_id}/timeline`

**权限**: `viewer`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID

**查询参数**:
- `event_types` (string, optional): 事件类型筛选（逗号分隔）

**响应体**:
```json
{
  "data": [
    {
      "id": "event-001",
      "event_type": "workflow.started",
      "timestamp": "2026-04-01T10:05:00Z",
      "actor_type": "user",
      "actor_id": "user-001",
      "event_data": {
        "input": {
          "project_name": "OpenClaw Control Plane"
        }
      }
    },
    {
      "id": "event-002",
      "event_type": "step.completed",
      "timestamp": "2026-04-01T11:05:00Z",
      "actor_type": "agent",
      "actor_id": "agent-001",
      "event_data": {
        "step_id": "step1",
        "duration": 3600
      }
    }
  ],
  "total": 15
}
```

---

### 2.3 步骤执行 API

#### 2.3.1 获取工作流的所有步骤

**端点**: `GET /api/v1/workflows/{workflow_id}/steps`

**权限**: `viewer`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID

**查询参数**:
- `status` (string, optional): 状态筛选

**响应体**:
```json
{
  "data": [
    {
      "id": "se-001",
      "step_id": "step1",
      "name": "需求分析",
      "status": "completed",
      "agent_id": "agent-001",
      "agent_name": "rd-product-researcher",
      "progress": 100,
      "started_at": "2026-04-01T10:05:00Z",
      "completed_at": "2026-04-01T11:05:00Z",
      "duration": 3600,
      "retry_count": 0
    }
  ],
  "total": 20
}
```

#### 2.3.2 获取步骤详情

**端点**: `GET /api/v1/workflows/{workflow_id}/steps/{step_execution_id}`

**权限**: `viewer`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID
- `step_execution_id` (string, required): 步骤执行 ID

**响应体**:
```json
{
  "id": "se-003",
  "workflow_instance_id": "wf-001",
  "step_id": "step3",
  "name": "PRD 编写",
  "status": "running",
  "agent_id": "agent-003",
  "agent_name": "rd-product-manager",
  "input": {
    "requirements": "docs/requirements.md"
  },
  "output": null,
  "progress": 65,
  "progress_message": "正在编写功能需求",
  "started_at": "2026-04-01T11:35:00Z",
  "completed_at": null,
  "duration": null,
  "retry_count": 0,
  "max_retries": 3,
  "error_message": null,
  "force_completed": false,
  "human_review": true,
  "review": {
    "id": "review-001",
    "reviewer_id": "user-002",
    "reviewer_name": "审核人A",
    "action": null,
    "timeout_at": "2026-04-02T11:35:00Z",
    "remaining_time": 82800
  },
  "artifacts": [
    {
      "id": "artifact-001",
      "name": "prd.md",
      "artifact_type": "document",
      "size_bytes": 15000,
      "storage_path": "/artifacts/wf-001/step3/prd.md"
    }
  ]
}
```

#### 2.3.3 重试步骤

**端点**: `POST /api/v1/workflows/{workflow_id}/steps/{step_execution_id}/retry`

**权限**: `editor`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID
- `step_execution_id` (string, required): 步骤执行 ID

**响应体**: 同 2.3.2（status 变为 retrying → running）

#### 2.3.4 跳过步骤

**端点**: `POST /api/v1/workflows/{workflow_id}/steps/{step_execution_id}/skip`

**权限**: `editor`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID
- `step_execution_id` (string, required): 步骤执行 ID

**请求体**:
```json
{
  "reason": "该步骤不需要执行"
}
```

**响应体**: 同 2.3.2（status 变为 skipped）

#### 2.3.5 强制完成步骤

**端点**: `POST /api/v1/workflows/{workflow_id}/steps/{step_execution_id}/force-complete`

**权限**: `admin`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID
- `step_execution_id` (string, required): 步骤执行 ID

**请求体**:
```json
{
  "reason": "外部依赖已手动确认完成",
  "output": {
    "manual_completion": true
  }
}
```

**响应体**: 同 2.3.2（status 变为 completed，force_completed = true）

#### 2.3.6 重新分配 Agent

**端点**: `POST /api/v1/workflows/{workflow_id}/steps/{step_execution_id}/reassign`

**权限**: `editor`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID
- `step_execution_id` (string, required): 步骤执行 ID

**请求体**:
```json
{
  "agent_id": "agent-004"
}
```

**响应体**: 同 2.3.2（agent_id 更新）

#### 2.3.7 Agent 上报进度

**端点**: `POST /api/v1/workflows/{workflow_id}/steps/{step_execution_id}/progress`

**权限**: `agent`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID
- `step_execution_id` (string, required): 步骤执行 ID

**请求体**:
```json
{
  "progress": 75,
  "message": "正在处理数据",
  "estimated_remaining": 900
}
```

**响应体**:
```json
{
  "success": true
}
```

#### 2.3.8 获取步骤日志

**端点**: `GET /api/v1/workflows/{workflow_id}/steps/{step_execution_id}/logs`

**权限**: `viewer`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID
- `step_execution_id` (string, required): 步骤执行 ID

**查询参数**:
- `level` (string, optional): 日志级别
- `limit` (integer, optional): 返回条数限制

**响应体**:
```json
{
  "data": [
    {
      "id": "log-001",
      "timestamp": "2026-04-01T11:40:00Z",
      "level": "INFO",
      "message": "开始执行 PRD 编写",
      "metadata": {}
    }
  ],
  "total": 20
}
```

#### 2.3.9 获取步骤输出

**端点**: `GET /api/v1/workflows/{workflow_id}/steps/{step_execution_id}/output`

**权限**: `viewer`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID
- `step_execution_id` (string, required): 步骤执行 ID

**响应体**:
```json
{
  "output": {
    "document_path": "docs/prd.md",
    "sections_completed": 5,
    "total_sections": 8
  },
  "artifacts": [
    {
      "id": "artifact-001",
      "name": "prd.md",
      "artifact_type": "document",
      "size_bytes": 15000,
      "download_url": "/api/v1/artifacts/artifact-001/download"
    }
  ]
}
```

#### 2.3.10 获取步骤输入

**端点**: `GET /api/v1/workflows/{workflow_id}/steps/{step_execution_id}/input`

**权限**: `viewer`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID
- `step_execution_id` (string, required): 步骤执行 ID

**响应体**:
```json
{
  "input": {
    "requirements": "docs/requirements.md",
    "validation_result": "passed"
  },
  "dependencies": [
    {
      "step_id": "step1",
      "step_name": "需求分析",
      "output": {
        "document_path": "docs/requirements.md"
      }
    },
    {
      "step_id": "step2",
      "step_name": "需求验证",
      "output": {
        "validation": "passed"
      }
    }
  ]
}
```

---

### 2.4 人工审核 API

#### 2.4.1 获取待审核列表

**端点**: `GET /api/v1/reviews/pending`

**权限**: `reviewer`

**查询参数**:
- `page` (integer, optional): 页码，默认 1
- `page_size` (integer, optional): 每页数量，默认 20
- `reviewer_id` (string, optional): 审核人 ID（默认当前用户）

**响应体**:
```json
{
  "data": [
    {
      "id": "review-001",
      "workflow_instance_id": "wf-001",
      "workflow_name": "研发流水线-需求新增",
      "step_execution_id": "se-003",
      "step_name": "PRD 编写",
      "reviewer_id": "user-002",
      "reviewer_name": "审核人A",
      "created_at": "2026-04-01T11:35:00Z",
      "timeout_at": "2026-04-02T11:35:00Z",
      "remaining_time": 82800,
      "review_round": 1,
      "outputs": {
        "summary": "已完成功能需求、非功能需求、API 设计部分",
        "files": [
          {
            "name": "prd.md",
            "size_bytes": 15000,
            "preview_url": "/api/v1/artifacts/artifact-001/preview"
          }
        ],
        "reasoning": "Agent 思考链路..."
      }
    }
  ],
  "total": 3,
  "page": 1,
  "page_size": 20
}
```

#### 2.4.2 获取审核详情

**端点**: `GET /api/v1/reviews/{review_id}`

**权限**: `reviewer`

**路径参数**:
- `review_id` (string, required): 审核记录 UUID

**响应体**:
```json
{
  "id": "review-001",
  "workflow_instance_id": "wf-001",
  "workflow_name": "研发流水线-需求新增",
  "step_execution_id": "se-003",
  "step_name": "PRD 编写",
  "reviewer_id": "user-002",
  "reviewer_name": "审核人A",
  "action": null,
  "comment": null,
  "created_at": "2026-04-01T11:35:00Z",
  "updated_at": "2026-04-01T11:35:00Z",
  "timeout_at": "2026-04-02T11:35:00Z",
  "timeout_action": "auto_reject",
  "remaining_time": 82800,
  "review_round": 1,
  "outputs": {
    "summary": "已完成功能需求、非功能需求、API 设计部分",
    "files": [
      {
        "id": "artifact-001",
        "name": "prd.md",
        "size_bytes": 15000,
        "preview_url": "/api/v1/artifacts/artifact-001/preview",
        "download_url": "/api/v1/artifacts/artifact-001/download"
      }
    ],
    "reasoning": "Agent 思考链路...",
    "dependencies": [
      {
        "step_id": "step1",
        "step_name": "需求分析",
        "output_summary": "42 个功能点"
      },
      {
        "step_id": "step2",
        "step_name": "需求验证",
        "output_summary": "验证通过"
      }
    ]
  },
  "history": [
    {
      "round": 1,
      "action": "request_changes",
      "comment": "缺少异常处理部分",
      "created_at": "2026-04-01T14:00:00Z",
      "reviewer_name": "审核人B"
    }
  ]
}
```

#### 2.4.3 通过审核

**端点**: `POST /api/v1/reviews/{review_id}/approve`

**权限**: `reviewer`

**路径参数**:
- `review_id` (string, required): 审核记录 UUID

**请求体**:
```json
{
  "comment": "PRD 内容完整，结构清晰，可以继续"
}
```

**响应体**:
```json
{
  "success": true,
  "review": {
    "id": "review-001",
    "action": "approve",
    "comment": "PRD 内容完整，结构清晰，可以继续",
    "updated_at": "2026-04-01T15:00:00Z"
  },
  "workflow": {
    "id": "wf-001",
    "status": "running",
    "progress": 70
  }
}
```

#### 2.4.4 拒绝审核

**端点**: `POST /api/v1/reviews/{review_id}/reject`

**权限**: `reviewer`

**路径参数**:
- `review_id` (string, required): 审核记录 UUID

**请求体**:
```json
{
  "comment": "需求分析不完整，缺少非功能需求，需要重新分析"
}
```

**响应体**:
```json
{
  "success": true,
  "review": {
    "id": "review-001",
    "action": "reject",
    "comment": "需求分析不完整，缺少非功能需求，需要重新分析",
    "updated_at": "2026-04-01T15:00:00Z"
  },
  "workflow": {
    "id": "wf-001",
    "status": "terminated",
    "progress": 65
  }
}
```

#### 2.4.5 要求修改

**端点**: `POST /api/v1/reviews/{review_id}/request-changes`

**权限**: `reviewer`

**路径参数**:
- `review_id` (string, required): 审核记录 UUID

**请求体**:
```json
{
  "comment": "PRD 整体结构良好，但需要补充以下内容：\n1. 异常处理流程\n2. 性能要求\n3. 安全性要求"
}
```

**响应体**:
```json
{
  "success": true,
  "review": {
    "id": "review-001",
    "action": "request_changes",
    "comment": "PRD 整体结构良好，但需要补充以下内容：\n1. 异常处理流程\n2. 性能要求\n3. 安全性要求",
    "updated_at": "2026-04-01T15:00:00Z",
    "review_round": 1
  },
  "workflow": {
    "id": "wf-001",
    "status": "paused",
    "progress": 65
  }
}
```

#### 2.4.6 获取工作流的审核记录

**端点**: `GET /api/v1/workflows/{workflow_id}/reviews`

**权限**: `viewer`

**路径参数**:
- `workflow_id` (string, required): 工作流实例 UUID

**响应体**:
```json
{
  "data": [
    {
      "id": "review-001",
      "step_name": "PRD 编写",
      "reviewer_name": "审核人A",
      "action": "approve",
      "comment": "PRD 内容完整",
      "created_at": "2026-04-01T15:00:00Z",
      "review_round": 1
    }
  ],
  "total": 1
}
```

#### 2.4.7 获取审核统计

**端点**: `GET /api/v1/reviews/stats`

**权限**: `reviewer`

**查询参数**:
- `reviewer_id` (string, optional): 审核人 ID（默认当前用户）
- `start_date` (string, optional): 开始日期
- `end_date` (string, optional): 结束日期

**响应体**:
```json
{
  "total_pending": 3,
  "total_completed_today": 5,
  "timeout_warnings": 1,
  "avg_review_time_seconds": 1800,
  "by_action": {
    "approve": 15,
    "reject": 2,
    "request_changes": 3
  }
}
```

---

### 2.5 Agent 管理 API

#### 2.5.1 获取 Agent 列表

**端点**: `GET /api/v1/agents`

**权限**: `viewer`

**查询参数**:
- `status` (string, optional): 状态筛选（online / degraded / offline）
- `capability` (string, optional): 能力标签筛选
- `search` (string, optional): 搜索关键词

**响应体**:
```json
{
  "data": [
    {
      "id": "agent-001",
      "name": "rd-product-researcher",
      "display_name": "产品研究员",
      "capabilities": ["research", "requirements"],
      "status": "online",
      "current_task_id": null,
      "current_workflow_instance_id": null,
      "current_step_execution_id": null,
      "last_heartbeat": "2026-04-01T15:00:00Z",
      "created_at": "2026-03-01T10:00:00Z"
    }
  ],
  "total": 15
}
```

#### 2.5.2 获取 Agent 详情

**端点**: `GET /api/v1/agents/{agent_id}`

**权限**: `viewer`

**路径参数**:
- `agent_id` (string, required): Agent ID

**响应体**:
```json
{
  "id": "agent-001",
  "name": "rd-product-researcher",
  "display_name": "产品研究员",
  "capabilities": ["research", "requirements"],
  "status": "online",
  "current_task": {
    "workflow_instance_id": "wf-001",
    "step_execution_id": "se-003",
    "step_name": "PRD 编写",
    "progress": 65
  },
  "last_heartbeat": "2026-04-01T15:00:00Z",
  "config": {
    "model": "gpt-4",
    "temperature": 0.7
  },
  "metadata": {},
  "statistics": {
    "total_tasks": 50,
    "completed_tasks": 45,
    "failed_tasks": 2,
    "avg_task_duration": 3600,
    "success_rate": 0.9
  },
  "created_at": "2026-03-01T10:00:00Z",
  "updated_at": "2026-04-01T15:00:00Z"
}
```

#### 2.5.3 同步 Agent 状态

**端点**: `POST /api/v1/agents/{agent_id}/sync`

**权限**: `editor`

**路径参数**:
- `agent_id` (string, required): Agent ID

**响应体**:
```json
{
  "success": true,
  "agent": {
    "id": "agent-001",
    "status": "online",
    "last_heartbeat": "2026-04-01T15:05:00Z"
  }
}
```

#### 2.5.4 清理 Agent 数据

**端点**: `POST /api/v1/agents/{agent_id}/cleanup`

**权限**: `editor`

**路径参数**:
- `agent_id` (string, required): Agent ID

**响应体**:
```json
{
  "success": true,
  "message": "Agent 数据已清理"
}
```

#### 2.5.5 停止 Agent

**端点**: `POST /api/v1/agents/{agent_id}/stop`

**权限**: `admin`

**路径参数**:
- `agent_id` (string, required): Agent ID

**响应体**:
```json
{
  "success": true,
  "agent": {
    "id": "agent-001",
    "status": "offline"
  }
}
```

#### 2.5.6 重启 Agent

**端点**: `POST /api/v1/agents/{agent_id}/restart`

**权限**: `admin`

**路径参数**:
- `agent_id` (string, required): Agent ID

**响应体**:
```json
{
  "success": true,
  "agent": {
    "id": "agent-001",
    "status": "online",
    "last_heartbeat": "2026-04-01T15:05:00Z"
  }
}
```

#### 2.5.7 批量同步 Agent

**端点**: `POST /api/v1/agents/batch-sync`

**权限**: `editor`

**响应体**:
```json
{
  "success": true,
  "synced_count": 15,
  "failed_count": 0
}
```

#### 2.5.8 批量清理 Agent

**端点**: `POST /api/v1/agents/batch-cleanup`

**权限**: `editor`

**请求体**:
```json
{
  "agent_ids": ["agent-001", "agent-002"]
}
```

**响应体**:
```json
{
  "success": true,
  "cleaned_count": 2
}
```

#### 2.5.9 获取 Agent 负载统计

**端点**: `GET /api/v1/agents/load-stats`

**权限**: `viewer`

**响应体**:
```json
{
  "data": [
    {
      "agent_id": "agent-001",
      "agent_name": "rd-product-researcher",
      "status": "online",
      "current_tasks": 2,
      "running_tasks": 1,
      "avg_task_duration": 3600
    }
  ],
  "total_agents": 15,
  "online_agents": 12,
  "offline_agents": 3
}
```

---

### 2.6 统计与监控 API

#### 2.6.1 工作流统计

**端点**: `GET /api/v1/stats/workflows`

**权限**: `viewer`

**查询参数**:
- `start_date` (string, optional): 开始日期（ISO 8601）
- `end_date` (string, optional): 结束日期（ISO 8601）
- `template_id` (string, optional): 模板 ID

**响应体**:
```json
{
  "total": 100,
  "by_status": {
    "pending": 5,
    "running": 10,
    "paused": 3,
    "completed": 75,
    "failed": 5,
    "terminated": 2
  },
  "success_rate": 0.75,
  "avg_duration_seconds": 7200,
  "by_template": [
    {
      "template_id": "uuid-001",
      "template_name": "研发流水线-标准流程",
      "count": 50,
      "success_rate": 0.8,
      "avg_duration_seconds": 8000
    }
  ],
  "time_series": [
    {
      "date": "2026-04-01",
      "total": 5,
      "completed": 4,
      "failed": 1
    }
  ]
}
```

#### 2.6.2 Agent 统计

**端点**: `GET /api/v1/stats/agents`

**权限**: `viewer`

**查询参数**:
- `start_date` (string, optional): 开始日期
- `end_date` (string, optional): 结束日期

**响应体**:
```json
{
  "total_agents": 15,
  "online_agents": 12,
  "offline_agents": 3,
  "by_agent": [
    {
      "agent_id": "agent-001",
      "agent_name": "rd-product-researcher",
      "total_tasks": 50,
      "completed_tasks": 45,
      "failed_tasks": 2,
      "success_rate": 0.9,
      "avg_task_duration": 3600,
      "total_tokens": 500000,
      "estimated_cost_usd": 50.0
    }
  ],
  "total_tasks": 500,
  "total_tokens": 5000000,
  "total_cost_usd": 500.0
}
```

#### 2.6.3 任务统计

**端点**: `GET /api/v1/stats/tasks`

**权限**: `viewer`

**查询参数**:
- `start_date` (string, optional): 开始日期
- `end_date` (string, optional): 结束日期

**响应体**:
```json
{
  "total": 500,
  "by_status": {
    "pending": 50,
    "running": 20,
    "completed": 400,
    "failed": 30
  },
  "by_category": {
    "backend": 200,
    "frontend": 150,
    "testing": 100,
    "other": 50
  },
  "avg_duration_seconds": 1800,
  "time_series": [
    {
      "date": "2026-04-01",
      "total": 20,
      "completed": 18,
      "failed": 2
    }
  ]
}
```

#### 2.6.4 系统健康检查

**端点**: `GET /api/v1/health`

**权限**: `public`

**响应体**:
```json
{
  "status": "ok",
  "timestamp": "2026-04-01T15:00:00Z",
  "components": {
    "database": "ok",
    "redis": "ok",
    "gateway": "ok",
    "agents": {
      "online": 12,
      "offline": 3
    }
  },
  "version": "1.0.0"
}
```

#### 2.6.5 审核统计

**端点**: `GET /api/v1/stats/reviews`

**权限**: `viewer`

**查询参数**:
- `start_date` (string, optional): 开始日期
- `end_date` (string, optional): 结束日期

**响应体**:
```json
{
  "total": 50,
  "pending": 3,
  "by_action": {
    "approve": 40,
    "reject": 5,
    "request_changes": 5
  },
  "avg_review_time_seconds": 1800,
  "timeout_count": 2,
  "by_reviewer": [
    {
      "reviewer_id": "user-002",
      "reviewer_name": "审核人A",
      "total_reviews": 20,
      "avg_review_time_seconds": 1500
    }
  ]
}
```

---

### 2.7 产出物管理 API

#### 2.7.1 获取产出物列表

**端点**: `GET /api/v1/artifacts`

**权限**: `viewer`

**查询参数**:
- `workflow_instance_id` (string, optional): 工作流实例 ID
- `step_execution_id` (string, optional): 步骤执行 ID
- `artifact_type` (string, optional): 产出物类型
- `page` (integer, optional): 页码
- `page_size` (integer, optional): 每页数量

**响应体**:
```json
{
  "data": [
    {
      "id": "artifact-001",
      "workflow_instance_id": "wf-001",
      "step_execution_id": "se-003",
      "artifact_type": "document",
      "name": "prd.md",
      "description": "产品需求文档",
      "storage_kind": "local",
      "storage_path": "/artifacts/wf-001/step3/prd.md",
      "size_bytes": 15000,
      "checksum": "sha256:abc123",
      "created_at": "2026-04-01T11:35:00Z"
    }
  ],
  "total": 5
}
```

#### 2.7.2 获取产出物详情

**端点**: `GET /api/v1/artifacts/{artifact_id}`

**权限**: `viewer`

**路径参数**:
- `artifact_id` (string, required): 产出物 UUID

**响应体**: 同 2.7.1 中的单个对象

#### 2.7.3 下载产出物

**端点**: `GET /api/v1/artifacts/{artifact_id}/download`

**权限**: `viewer`

**路径参数**:
- `artifact_id` (string, required): 产出物 UUID

**响应**: 文件下载

#### 2.7.4 预览产出物

**端点**: `GET /api/v1/artifacts/{artifact_id}/preview`

**权限**: `viewer`

**路径参数**:
- `artifact_id` (string, required): 产出物 UUID

**查询参数**:
- `format` (string, optional): 预览格式（html / raw），默认 html

**响应**: HTML 或原始内容

#### 2.7.5 删除产出物

**端点**: `DELETE /api/v1/artifacts/{artifact_id}`

**权限**: `admin`

**路径参数**:
- `artifact_id` (string, required): 产出物 UUID

**响应体**:
```json
{
  "success": true,
  "message": "产出物已删除"
}
```

---

## 3. WebSocket 事件

### 3.1 连接端点

**端点**: `wss://[host]/api/v1/ws`

**认证**: JWT Token 通过查询参数传递
```
wss://[host]/api/v1/ws?token=[jwt_token]
```

### 3.2 订阅频道

#### 3.2.1 订阅方式

客户端发送 JSON 消息：
```json
{
  "action": "subscribe",
  "channel": "workflows"
}
```

#### 3.2.2 取消订阅

```json
{
  "action": "unsubscribe",
  "channel": "workflows"
}
```

### 3.3 频道列表

| 频道 | 订阅方式 | 事件类型 | 说明 |
|------|----------|----------|------|
| `workflows` | `{ "action": "subscribe", "channel": "workflows" }` | workflow.created, workflow.updated, workflow.deleted | 所有工作流实例变更 |
| `workflow.{id}` | `{ "action": "subscribe", "channel": "workflow.123" }` | workflow.started, workflow.paused, workflow.resumed, workflow.completed, workflow.failed | 单个工作流实例变更 |
| `workflow.{id}.steps` | `{ "action": "subscribe", "channel": "workflow.123.steps" }` | step.started, step.progress, step.completed, step.failed, step.awaiting_review | 工作流步骤变更 |
| `agent.{id}` | `{ "action": "subscribe", "channel": "agent.456" }` | agent.online, agent.offline, agent.task_assigned, agent.task_completed | Agent 状态变更 |
| `reviews` | `{ "action": "subscribe", "channel": "reviews" }` | review.created, review.approved, review.rejected, review.timeout_warning | 审核相关事件 |
| `user.{id}` | `{ "action": "subscribe", "channel": "user.789" }` | notification.new | 用户通知 |

### 3.4 事件格式

#### 3.4.1 通用事件格式

```json
{
  "event": "step.progress",
  "channel": "workflow.wf-001.steps",
  "timestamp": "2026-04-01T10:35:12Z",
  "data": {
    "workflow_id": "wf-001",
    "step_id": "se-003",
    "step_name": "PRD 编写",
    "progress": 65,
    "message": "正在编写功能需求",
    "estimated_remaining": 1800
  }
}
```

#### 3.4.2 工作流事件

##### workflow.created
```json
{
  "event": "workflow.created",
  "timestamp": "2026-04-01T10:00:00Z",
  "data": {
    "workflow_id": "wf-001",
    "template_name": "研发流水线-标准流程",
    "created_by": "user-001"
  }
}
```

##### workflow.started
```json
{
  "event": "workflow.started",
  "timestamp": "2026-04-01T10:05:00Z",
  "data": {
    "workflow_id": "wf-001",
    "current_step": {
      "step_id": "step1",
      "step_name": "需求分析",
      "agent_name": "rd-product-researcher"
    }
  }
}
```

##### workflow.completed
```json
{
  "event": "workflow.completed",
  "timestamp": "2026-04-01T18:00:00Z",
  "data": {
    "workflow_id": "wf-001",
    "duration": 28800,
    "progress": 100
  }
}
```

#### 3.4.3 步骤事件

##### step.started
```json
{
  "event": "step.started",
  "timestamp": "2026-04-01T10:05:00Z",
  "data": {
    "workflow_id": "wf-001",
    "step_id": "se-003",
    "step_name": "PRD 编写",
    "agent_id": "agent-003",
    "agent_name": "rd-product-manager"
  }
}
```

##### step.progress
```json
{
  "event": "step.progress",
  "timestamp": "2026-04-01T10:35:12Z",
  "data": {
    "workflow_id": "wf-001",
    "step_id": "se-003",
    "progress": 65,
    "message": "正在编写功能需求",
    "estimated_remaining": 1800
  }
}
```

##### step.completed
```json
{
  "event": "step.completed",
  "timestamp": "2026-04-01T11:35:00Z",
  "data": {
    "workflow_id": "wf-001",
    "step_id": "se-003",
    "duration": 3600,
    "output": {
      "document_path": "docs/prd.md"
    }
  }
}
```

##### step.awaiting_review
```json
{
  "event": "step.awaiting_review",
  "timestamp": "2026-04-01T11:35:00Z",
  "data": {
    "workflow_id": "wf-001",
    "step_id": "se-003",
    "step_name": "PRD 编写",
    "review_id": "review-001",
    "reviewer_id": "user-002",
    "timeout_at": "2026-04-02T11:35:00Z"
  }
}
```

#### 3.4.4 审核事件

##### review.created
```json
{
  "event": "review.created",
  "timestamp": "2026-04-01T11:35:00Z",
  "data": {
    "review_id": "review-001",
    "workflow_id": "wf-001",
    "step_name": "PRD 编写",
    "reviewer_id": "user-002",
    "timeout_at": "2026-04-02T11:35:00Z"
  }
}
```

##### review.approved
```json
{
  "event": "review.approved",
  "timestamp": "2026-04-01T15:00:00Z",
  "data": {
    "review_id": "review-001",
    "workflow_id": "wf-001",
    "reviewer_id": "user-002",
    "comment": "PRD 内容完整"
  }
}
```

##### review.timeout_warning
```json
{
  "event": "review.timeout_warning",
  "timestamp": "2026-04-02T09:35:00Z",
  "data": {
    "review_id": "review-001",
    "workflow_id": "wf-001",
    "remaining_time": 7200,
    "reviewer_id": "user-002"
  }
}
```

#### 3.4.5 Agent 事件

##### agent.online
```json
{
  "event": "agent.online",
  "timestamp": "2026-04-01T10:00:00Z",
  "data": {
    "agent_id": "agent-001",
    "agent_name": "rd-product-researcher"
  }
}
```

##### agent.task_assigned
```json
{
  "event": "agent.task_assigned",
  "timestamp": "2026-04-01T10:05:00Z",
  "data": {
    "agent_id": "agent-001",
    "workflow_id": "wf-001",
    "step_id": "se-001",
    "step_name": "需求分析"
  }
}
```

---

## 4. Gateway 集成方案

### 4.1 架构概览

```
┌─────────────┐
│   前端 UI   │
└──────┬──────┘
       │ REST API / WebSocket
       ▼
┌─────────────────────────┐
│  Control Plane Backend  │
│  (FastAPI)              │
└──────┬──────────────────┘
       │
       ├─ PostgreSQL (数据存储)
       │
       └─ OpenClaw Gateway API (Agent 调度)
           │
           └─ Agent 集群
```

### 4.2 Gateway API 集成

#### 4.2.1 Gateway 客户端配置

**文件**: `backend/app/services/gateway/gateway_client.py`

```python
import httpx
from typing import Dict, Any, Optional

class GatewayClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}"}
        )
    
    async def dispatch_task_to_agent(
        self,
        agent_id: str,
        task_type: str,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """分发任务到指定 Agent"""
        response = await self.client.post(
            f"/api/v1/agents/{agent_id}/tasks",
            json={
                "task_type": task_type,
                "payload": payload
            }
        )
        response.raise_for_status()
        return response.json()
    
    async def get_agent_status(self, agent_id: str) -> Dict[str, Any]:
        """获取 Agent 状态"""
        response = await self.client.get(f"/api/v1/agents/{agent_id}/status")
        response.raise_for_status()
        return response.json()
    
    async def send_message_to_session(
        self,
        session_key: str,
        message: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """发送消息到 Agent 会话"""
        response = await self.client.post(
            f"/api/v1/sessions/{session_key}/messages",
            json={
                "message": message,
                "context": context
            }
        )
        response.raise_for_status()
        return response.json()
```

#### 4.2.2 Agent 分发器

**文件**: `backend/app/services/gateway/agent_dispatcher.py`

```python
from typing import Dict, Any, Optional
from .gateway_client import GatewayClient

class AgentDispatcher:
    def __init__(self, gateway_client: GatewayClient):
        self.gateway_client = gateway_client
    
    async def dispatch_step_to_agent(
        self,
        step_execution_id: str,
        agent_id: str,
        step_name: str,
        input_data: Dict[str, Any],
        workflow_context: Dict[str, Any]
    ) -> str:
        """分发工作流步骤到 Agent"""
        payload = {
            "step_execution_id": step_execution_id,
            "step_name": step_name,
            "input": input_data,
            "workflow_context": workflow_context,
            "callback_url": f"/api/v1/internal/steps/{step_execution_id}/callback"
        }
        
        result = await self.gateway_client.dispatch_task_to_agent(
            agent_id=agent_id,
            task_type="workflow_step",
            payload=payload
        )
        
        return result["session_key"]
    
    async def notify_step_completion(
        self,
        step_execution_id: str,
        status: str,
        output: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ):
        """通知步骤完成（内部回调）"""
        # 这个方法会被 Gateway 回调触发
        # 更新数据库中的步骤状态
        pass
```

### 4.3 任务分发流程

```
1. DAG 调度器识别可执行步骤
   ↓
2. Agent 匹配器选择合适的 Agent
   ↓
3. 调用 AgentDispatcher.dispatch_step_to_agent()
   ↓
4. Gateway 创建 Agent 会话并分发任务
   ↓
5. Agent 开始执行，通过 WebSocket 上报进度
   ↓
6. 执行完成后，Gateway 回调 Control Plane
   ↓
7. Control Plane 更新步骤状态，触发 DAG 调度器继续
```

### 4.4 回调端点

#### 4.4.1 步骤完成回调

**端点**: `POST /api/v1/internal/steps/{step_execution_id}/callback`

**权限**: `internal` (仅 Gateway 可访问)

**请求体**:
```json
{
  "status": "completed",
  "output": {
    "document_path": "docs/prd.md"
  },
  "artifacts": [
    {
      "name": "prd.md",
      "storage_path": "/artifacts/wf-001/step3/prd.md",
      "size_bytes": 15000
    }
  ],
  "metrics": {
    "duration": 3600,
    "tokens_used": 50000
  }
}
```

**响应体**:
```json
{
  "success": true
}
```

#### 4.4.2 步骤进度回调

**端点**: `POST /api/v1/internal/steps/{step_execution_id}/progress`

**权限**: `internal`

**请求体**:
```json
{
  "progress": 65,
  "message": "正在编写功能需求",
  "estimated_remaining": 1800
}
```

---

## 5. 错误码定义

### 5.1 通用错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| `INVALID_REQUEST` | 400 | 请求参数无效 |
| `UNAUTHORIZED` | 401 | 未授权 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 资源冲突 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

### 5.2 工作流错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| `WORKFLOW_NOT_FOUND` | 404 | 工作流不存在 |
| `WORKFLOW_ALREADY_RUNNING` | 409 | 工作流已在运行中 |
| `WORKFLOW_NOT_RUNNING` | 400 | 工作流未运行 |
| `WORKFLOW_TERMINATED` | 400 | 工作流已终止 |
| `TEMPLATE_NOT_FOUND` | 404 | 模板不存在 |
| `TEMPLATE_NOT_PUBLISHED` | 400 | 模板未发布 |
| `TEMPLATE_HAS_ACTIVE_INSTANCES` | 409 | 模板有活动实例，无法删除 |
| `DAG_CYCLE_DETECTED` | 400 | DAG 检测到循环依赖 |
| `DAG_NO_START_NODE` | 400 | DAG 缺少起始节点 |
| `STEP_NOT_FOUND` | 404 | 步骤不存在 |
| `STEP_ALREADY_COMPLETED` | 400 | 步骤已完成 |
| `STEP_NOT_RETRYABLE` | 400 | 步骤不可重试 |
| `AGENT_NOT_FOUND` | 404 | Agent 不存在 |
| `AGENT_OFFLINE` | 400 | Agent 离线 |
| `AGENT_BUSY` | 409 | Agent 忙碌 |
| `NO_AVAILABLE_AGENT` | 400 | 无可用 Agent |

### 5.3 审核错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| `REVIEW_NOT_FOUND` | 404 | 审核记录不存在 |
| `REVIEW_ALREADY_COMPLETED` | 400 | 审核已完成 |
| `REVIEW_TIMEOUT` | 400 | 审核已超时 |
| `REVIEW_COMMENT_REQUIRED` | 400 | 审核意见必填 |

### 5.4 错误响应格式

```json
{
  "error": {
    "code": "WORKFLOW_NOT_FOUND",
    "message": "工作流实例 wf-999 不存在",
    "details": {
      "workflow_id": "wf-999"
    }
  }
}
```

---

## 6. 通用数据结构

### 6.1 分页响应

```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

### 6.2 排序参数

- `sort_by`: 排序字段（如 created_at, updated_at, name）
- `sort_order`: 排序方向（asc / desc）

### 6.3 时间范围参数

- `start_date`: 开始时间（ISO 8601 格式）
- `end_date`: 结束时间（ISO 8601 格式）

### 6.4 状态枚举

#### 6.4.1 工作流状态

```typescript
enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TERMINATED = 'terminated'
}
```

#### 6.4.2 步骤状态

```typescript
enum StepStatus {
  PENDING = 'pending',
  READY = 'ready',
  ASSIGNED = 'assigned',
  RUNNING = 'running',
  AWAITING_REVIEW = 'awaiting_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETRYING = 'retrying',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped'
}
```

#### 6.4.3 审核动作

```typescript
enum ReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  REQUEST_CHANGES = 'request_changes'
}
```

#### 6.4.4 Agent 状态

```typescript
enum AgentStatus {
  ONLINE = 'online',
  DEGRADED = 'degraded',
  OFFLINE = 'offline'
}
```

---

## 7. 认证与权限

### 7.1 认证方式

使用 JWT Bearer Token 认证：

```http
Authorization: Bearer <jwt_token>
```

### 7.2 权限角色

| 角色 | 权限 |
|------|------|
| `admin` | 所有权限，包括删除、强制完成、系统配置 |
| `editor` | 创建、更新、启动、暂停、恢复、终止工作流 |
| `reviewer` | 审核工作流步骤 |
| `viewer` | 只读权限，查看工作流状态和日志 |
| `agent` | Agent 专用权限，上报进度和状态 |

### 7.3 权限矩阵

| 操作 | admin | editor | reviewer | viewer | agent |
|------|-------|--------|----------|--------|-------|
| 查看模板列表 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 创建模板 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 更新模板 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 删除模板 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 发布模板 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 查看工作流列表 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 启动工作流 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 暂停/恢复工作流 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 终止工作流 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 删除工作流 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 查看步骤详情 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 重试步骤 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 跳过步骤 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 强制完成步骤 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 重新分配 Agent | ✅ | ✅ | ❌ | ❌ | ❌ |
| Agent 上报进度 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 查看待审核列表 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 通过审核 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 拒绝审核 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 要求修改 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 查看 Agent 列表 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 同步 Agent 状态 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 停止/重启 Agent | ✅ | ❌ | ❌ | ❌ | ❌ |
| 查看统计数据 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 下载产出物 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 删除产出物 | ✅ | ❌ | ❌ | ❌ | ❌ |

### 7.4 资源级权限控制

某些资源支持更细粒度的权限控制：

- **工作流实例**：创建者拥有 editor 权限，即使角色是 viewer
- **审核记录**：仅指定的审核人或管理员可操作
- **模板**：创建者拥有 editor 权限

### 7.5 JWT Token 结构

```json
{
  "sub": "user-001",
  "username": "zhang_san",
  "role": "editor",
  "exp": 1712345678,
  "iat": 1712342078
}
```

---

## 8. 附录

### 8.1 API 端点总览

**总计**: 63 个端点

| 模块 | 端点数量 |
|------|----------|
| 工作流模板 | 12 |
| 工作流实例 | 10 |
| 步骤执行 | 10 |
| 人工审核 | 7 |
| Agent 管理 | 9 |
| 统计与监控 | 5 |
| 产出物管理 | 5 |
| 内部回调 | 2 |
| WebSocket | 3+ |

### 8.2 技术栈建议

**后端**:
- FastAPI (Python 3.10+)
- SQLAlchemy 2.0
- PostgreSQL 14+
- Redis 7+ (缓存和 WebSocket 状态)
- Celery (异步任务)
- Pydantic (数据验证)

**前端**:
- React 18+
- TypeScript 5+
- React Flow (DAG 可视化)
- Zustand (状态管理)
- React Query (数据获取)
- TailwindCSS (样式)

**实时通信**:
- WebSocket
- Server-Sent Events (SSE)

**Gateway 集成**:
- httpx (HTTP 客户端)
- OpenAPI 客户端生成

### 8.3 性能优化建议

1. **数据库优化**:
   - 使用索引（已在 Schema 中定义）
   - 使用连接池
   - 读写分离（如需要）
   - 使用物化视图（统计查询）

2. **API 性能**:
   - 使用 Redis 缓存常用数据（模板列表、Agent 状态）
   - 使用分页避免大量数据传输
   - 使用字段选择器（GraphQL 风格）
   - 使用压缩（gzip）

3. **WebSocket 优化**:
   - 使用消息批量更新
   - 使用消息压缩
   - 使用心跳保持连接

4. **前端优化**:
   - 使用虚拟滚动（长列表）
   - 使用 Web Worker（DAG 渲染）
   - 使用 Service Worker（离线支持）

### 8.4 监控与告警

1. **应用监控**:
   - API 响应时间
   - 错误率
   - WebSocket 连接数
   - 数据库查询性能

2. **业务监控**:
   - 工作流成功率
   - 审核超时率
   - Agent 可用率
   - 任务队列长度

3. **告警规则**:
   - API 错误率 > 5%
   - 工作流失败率 > 10%
   - 审核超时 > 24 小时
   - Agent 离线 > 10 分钟
   - 数据库连接池耗尽

---

## 9. 变更记录

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-04-01 | rd-lead | 初始版本，包含完整 API 设计 |

---

**文档完成**

> **下一步**: 由 rd-backend-arch 进行技术评审，确认 API 设计的可行性和性能
