# Step 7: API 设计

**创建时间**：2026-04-02 18:53
**负责人**：rd-commander
**状态**：已完成

---

## 📋 API 设计规范

### 1. 基本原则
- RESTful 风格
- 统一的响应格式
- 清晰的错误处理
- 完整的类型定义

---

## 2. 统一响应格式

### 2.1 成功响应
```json
{
  "id": "uuid",
  "name": "string",
  ...
}
```

### 2.2 列表响应
```json
{
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5,
  "data": [...]
}
```

### 2.3 错误响应
```json
{
  "detail": "错误描述",
  "status_code": 400
}
```

---

## 3. API 端点设计

### 3.1 模板管理 API

#### GET /api/v1/workflow-templates
**描述**：获取模板列表
**查询参数**：
- `search`: 搜索关键词（可选）
- `status`: 状态筛选（draft/published/archived，可选）
- `page`: 页码（默认 1）
- `page_size`: 每页数量（默认 20，最大 100）

**响应**：模板列表

---

#### GET /api/v1/workflow-templates/:id
**描述**：获取模板详情
**路径参数**：
- `id`: 模板 ID

**响应**：模板详情

---

#### POST /api/v1/workflow-templates
**描述**：创建模板
**请求体**：
```json
{
  "name": "string",
  "description": "string",
  "dag": {
    "steps": [...],
    "edges": [...]
  },
  "config": {...},
  "tags": ["string"]
}
```

**响应**：创建的模板

---

#### PUT /api/v1/workflow-templates/:id
**描述**：更新模板
**路径参数**：
- `id`: 模板 ID

**请求体**：同创建

**响应**：更新后的模板

---

#### DELETE /api/v1/workflow-templates/:id
**描述**：删除模板
**路径参数**：
- `id`: 模板 ID

**响应**：204 No Content

---

#### POST /api/v1/workflow-templates/:id/publish
**描述**：发布模板
**路径参数**：
- `id`: 模板 ID

**响应**：发布后的模板

---

#### POST /api/v1/workflow-templates/:id/archive
**描述**：归档模板
**路径参数**：
- `id`: 模板 ID

**响应**：归档后的模板

---

### 3.2 实例管理 API

#### GET /api/v1/workflow-instances
**描述**：获取实例列表
**查询参数**：
- `template_id`: 模板 ID（可选）
- `status`: 状态筛选（可选）
- `page`: 页码
- `page_size`: 每页数量

**响应**：实例列表

---

#### GET /api/v1/workflow-instances/:id
**描述**：获取实例详情
**路径参数**：
- `id`: 实例 ID

**响应**：实例详情

---

#### POST /api/v1/workflow-instances
**描述**：启动工作流
**请求体**：
```json
{
  "template_id": "uuid",
  "input": {...}
}
```

**响应**：创建的实例

---

#### POST /api/v1/workflow-instances/:id/pause
**描述**：暂停实例
**路径参数**：
- `id`: 实例 ID

**响应**：暂停后的实例

---

#### POST /api/v1/workflow-instances/:id/resume
**描述**：恢复实例
**路径参数**：
- `id`: 实例 ID

**响应**：恢复后的实例

---

#### POST /api/v1/workflow-instances/:id/terminate
**描述**：终止实例
**路径参数**：
- `id`: 实例 ID

**请求体**：
```json
{
  "reason": "string"
}
```

**响应**：终止后的实例

---

### 3.3 审核管理 API

#### GET /api/v1/reviews/pending
**描述**：获取待审核列表

**响应**：待审核任务列表

---

#### POST /api/v1/reviews/:id/approve
**描述**：通过审核
**路径参数**：
- `id`: 审核 ID

**请求体**：
```json
{
  "comment": "string"
}
```

**响应**：审核结果

---

#### POST /api/v1/reviews/:id/reject
**描述**：拒绝审核
**路径参数**：
- `id`: 审核 ID

**请求体**：
```json
{
  "comment": "string",
  "action": "retry|terminate"
}
```

**响应**：审核结果

---

### 3.4 统计 API

#### GET /api/v1/stats/workflows
**描述**：获取工作流统计
**查询参数**：
- `start_date`: 开始日期
- `end_date`: 结束日期

**响应**：
```json
{
  "total_instances": 100,
  "success_rate": 0.85,
  "avg_duration": 3600,
  "failure_reasons": {...}
}
```

---

## 4. 状态码

- **200 OK**: 成功
- **201 Created**: 创建成功
- **204 No Content**: 删除成功
- **400 Bad Request**: 请求参数错误
- **404 Not Found**: 资源不存在
- **500 Internal Server Error**: 服务器错误

---

## 5. 数据验证

### 5.1 模板验证
- `name`: 必填，最大100字符
- `description`: 可选，最大500字符
- `dag.steps`: 至少1个步骤
- `dag.edges`: 边必须引用存在的步骤

### 5.2 实例验证
- `template_id`: 必须存在且为 published 状态
- `input`: 必须符合模板定义的输入 schema

---

## 6. API 文档

- FastAPI 自动生成 Swagger UI: `/docs`
- ReDoc: `/redoc`
- OpenAPI JSON: `/openapi.json`

---

**状态**：✅ API 设计完成
