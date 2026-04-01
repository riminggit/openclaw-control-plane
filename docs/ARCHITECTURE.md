# OpenClaw Control Plane - 系统架构说明

## 系统概述

OpenClaw Control Plane 是一个现代化的工作流管理系统，提供完整的 DAG 工作流引擎、Agent 调度和人工审核功能。

## 核心架构

### 1. 分层架构

```
┌─────────────────────────────────────┐
│         前端层 (React + TS)          │
│  - 页面组件                          │
│  - 状态管理 (Hooks)                  │
│  - API 客户端                        │
└─────────────────────────────────────┘
                ↕ HTTP/WebSocket
┌─────────────────────────────────────┐
│         API 层 (FastAPI)             │
│  - 路由处理                          │
│  - 请求验证                          │
│  - 响应格式化                        │
└─────────────────────────────────────┘
                ↕
┌─────────────────────────────────────┐
│       服务层 (Business Logic)        │
│  - WorkflowInstanceService          │
│  - SchedulerService                 │
│  - AgentMatcherService              │
└─────────────────────────────────────┘
                ↕
┌─────────────────────────────────────┐
│      数据访问层 (SQLAlchemy ORM)     │
│  - WorkflowTemplate                 │
│  - WorkflowInstance                 │
│  - StepExecution                    │
└─────────────────────────────────────┘
                ↕
┌─────────────────────────────────────┐
│          数据库 (SQLite/PostgreSQL) │
└─────────────────────────────────────┘
```

### 2. 服务层设计 (修复问题 A2)

**位置**: `backend/app/services/workflow/`

**目的**: 分离业务逻辑，提高代码可测试性和可维护性

**核心服务**:

#### WorkflowInstanceService
- 职责: 工作流实例的生命周期管理
- 核心方法:
  - `create_instance()`: 创建工作流实例
  - `advance_workflow()`: 推进工作流执行
  - `get_next_step()`: 获取下一个可执行步骤

#### SchedulerService
- 职责: Agent 任务调度
- 核心方法:
  - `schedule_agent_task()`: 调度 Agent 执行任务
  - `cancel_agent_task()`: 取消任务

#### AgentMatcherService
- 职责: Agent 匹配和选择
- 核心方法:
  - `get_openclaw_agents()`: 获取可用 Agent 列表
  - `match_agent_for_step()`: 智能匹配 Agent

### 3. 认证系统 (修复问题 Q1)

**位置**: `backend/app/core/auth.py`

**实现**: JWT (JSON Web Token) 认证

**特性**:
- ✅ 基于角色的访问控制 (RBAC)
- ✅ 令牌过期机制
- ✅ 权限检查装饰器
- ✅ 开发模式支持

**使用示例**:
```python
from app.core.auth import get_current_user_id, require_permission

@router.post("/workflow-instances")
async def create_instance(
    request: WorkflowInstanceCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    # user_id 是从 JWT 令牌中提取的真实用户ID
    ...
```

### 4. 前端架构

#### 路由和参数处理 (修复问题 Q2)
```typescript
// 使用 useParams 获取路由参数
const { id } = useParams<{ id: string }>()
const { data, loading, error } = useWorkflowInstance(id || null)

// 错误边界处理
class ErrorBoundary extends React.Component {
  // 捕获渲染错误
}
```

#### DAG 可视化 (修复问题 A3)
```typescript
// 正确构建 DAG 数据（包含 edges）
const dagData = {
  steps: [...],
  edges: [...] // 从步骤依赖关系构建
}
```

## 数据流

### 1. 创建工作流实例
```
用户请求
  ↓
API 层 (instances.py)
  ↓
服务层 (WorkflowInstanceService.create_instance)
  ↓
数据层 (保存到数据库)
  ↓
返回实例信息
```

### 2. 工作流执行
```
启动实例
  ↓
推进工作流 (WorkflowInstanceService.advance_workflow)
  ↓
选择下一个步骤
  ↓
调度 Agent (SchedulerService.schedule_agent_task)
  ↓
Agent 执行任务
  ↓
更新步骤状态
  ↓
继续推进到下一步
```

## 关键设计决策

### 1. 为什么使用服务层？
- **问题**: 业务逻辑耦合在 API 层
- **解决**: 创建独立的服务层
- **好处**: 
  - 提高代码可测试性
  - 便于业务逻辑复用
  - 降低耦合度

### 2. 为什么使用 JWT 认证？
- **问题**: 硬编码用户 ID
- **解决**: 实现基于 JWT 的认证系统
- **好处**:
  - 无状态认证
  - 支持分布式部署
  - 易于集成第三方系统

### 3. 为什么需要错误边界？
- **问题**: 前端错误导致白屏
- **解决**: React 错误边界
- **好处**:
  - 提升用户体验
  - 便于错误追踪
  - 防止整个应用崩溃

## 部署架构

### 开发环境
```
Frontend (localhost:5173)
    ↓
Backend (localhost:8000)
    ↓
SQLite (本地文件)
```

### 生产环境
```
Nginx (反向代理)
    ↓
┌──────────────┬──────────────┐
│  Frontend    │   Backend    │
│  (静态文件)   │   (Uvicorn)  │
└──────────────┴──────────────┘
    ↓                ↓
┌──────────────────────────────┐
│   PostgreSQL (主数据库)       │
│   Redis (缓存/会话)          │
└──────────────────────────────┘
```

## 性能优化

### 1. 数据库查询优化
- 使用索引
- 避免 N+1 查询
- 合理使用 JOIN

### 2. 前端优化
- 代码分割
- 懒加载
- 虚拟滚动（步骤列表）

### 3. API 优化
- 分页查询
- 字段投影
- 响应缓存

## 监控和日志

### 日志级别
- **DEBUG**: 详细调试信息
- **INFO**: 关键操作日志
- **WARN**: 警告信息
- **ERROR**: 错误信息

### 监控指标
- API 响应时间
- 数据库查询性能
- 工作流执行成功率
- Agent 调度延迟

## 安全考虑

### 1. 认证和授权
- JWT 令牌验证
- 角色权限检查
- API 访问控制

### 2. 数据安全
- 输入验证
- SQL 注入防护
- XSS 防护

### 3. 敏感信息
- 环境变量管理
- 日志脱敏
- 密码加密

## 未来规划

### Phase 2 (下一轮)
- ✅ WebSocket 实时推送
- ✅ Agent 管理和监控
- ✅ 产出物(Artifacts)管理
- ✅ 单元测试和集成测试

### Phase 3 (长期)
- GraphQL API
- 微服务架构
- 云原生部署
- AI 辅助工作流优化

## 贡献指南

### 代码规范
- Python: PEP 8
- TypeScript: ESLint + Prettier
- 提交信息: Conventional Commits

### 测试要求
- 单元测试覆盖率 > 80%
- 集成测试覆盖核心流程
- E2E 测试覆盖用户场景

## 联系方式

- 研发负责人: rd-lead
- 架构师: rd-backend-arch
- 产品经理: rd-product-manager
