# 工作流管理系统 - 架构设计文档

> **版本**: v1.0
> **日期**: 2026-04-02
> **作者**: rd-commander
> **步骤**: Step 5 - 架构设计

---

## 1. 前端架构

### 1.1 技术栈

- **框架**: React 18+ with TypeScript 5+
- **路由**: React Router v6
- **状态管理**: Zustand (轻量级状态管理)
- **数据获取**: React Query (TanStack Query)
- **样式方案**: CSS Variables + CSS Modules
- **DAG可视化**: React Flow
- **UI组件库**: 自定义组件（基于设计规范）
- **HTTP客户端**: Axios
- **WebSocket**: native WebSocket API

### 1.2 目录结构

```
frontend/src/
├── api/                          # API客户端层
│   ├── client.ts                 # Axios实例配置
│   ├── templates.ts              # 模板API
│   ├── instances.ts              # 实例API
│   ├── steps.ts                  # 步骤API
│   ├── reviews.ts                # 审核API
│   ├── websocket.ts              # WebSocket客户端
│   └── types.ts                  # API类型定义
│
├── components/                   # 组件层
│   ├── common/                   # 通用组件
│   │   ├── PageHeader.tsx       # 页面头部（包含返回按钮）
│   │   ├── Button.tsx           # 按钮组件
│   │   ├── Card.tsx             # 卡片组件
│   │   ├── Modal.tsx            # 弹窗组件
│   │   ├── Table.tsx            # 表格组件
│   │   ├── SearchBar.tsx        # 搜索栏
│   │   ├── StatusBadge.tsx      # 状态徽章
│   │   └── LoadingSpinner.tsx   # 加载动画
│   │
│   └── workflow/                 # 工作流专用组件
│       ├── DAGEditor.tsx        # DAG编辑器
│       ├── DAGViewer.tsx        # DAG查看器
│       ├── StepCard.tsx         # 步骤卡片
│       ├── TemplateCard.tsx     # 模板卡片
│       ├── InstanceCard.tsx     # 实例卡片
│       ├── ReviewModal.tsx      # 审核弹窗
│       ├── ProgressRing.tsx     # 进度环
│       └── StatusTimeline.tsx   # 状态时间线
│
├── pages/                        # 页面层
│   └── workflows/
│       ├── Templates.tsx        # 模板列表页
│       ├── CreateTemplate.tsx   # 创建模板页
│       ├── TemplateDetail.tsx   # 模板详情页
│       ├── Instances.tsx        # 实例列表页
│       ├── InstanceDetail.tsx   # 实例详情页
│       └── Reviews.tsx          # 审核中心页
│
├── hooks/                        # 自定义Hooks
│   ├── useTemplates.ts          # 模板相关Hooks
│   ├── useInstances.ts          # 实例相关Hooks
│   ├── useWebSocket.ts          # WebSocket Hook
│   ├── usePolling.ts            # 轮询Hook
│   └── usePageHeader.ts         # 页面头部Hook（包含返回按钮逻辑）
│
├── stores/                       # Zustand状态管理
│   ├── templateStore.ts         # 模板状态
│   ├── instanceStore.ts         # 实例状态
│   └── uiStore.ts               # UI状态（loading, error等）
│
├── styles/                       # 全局样式
│   ├── variables.css            # CSS变量（主题色、间距等）
│   ├── global.css               # 全局样式
│   └── utilities.css            # 工具类
│
├── types/                        # TypeScript类型定义
│   ├── workflow.ts              # 工作流类型
│   ├── template.ts              # 模板类型
│   ├── instance.ts              # 实例类型
│   └── common.ts                # 通用类型
│
└── utils/                        # 工具函数
    ├── format.ts                # 格式化工具
    ├── validation.ts            # 验证工具
    └── constants.ts             # 常量定义
```

### 1.3 核心组件设计

#### 1.3.1 PageHeader 组件（关键）

**职责**：
- 显示页面标题
- **必须包含返回按钮**（除了列表页）
- 面包屑导航
- 操作按钮区

**Props**:
```typescript
interface PageHeaderProps {
  title: string
  showBackButton?: boolean  // 默认true
  backTo?: string           // 返回路径
  breadcrumbs?: Breadcrumb[]
  actions?: React.ReactNode
}
```

**使用示例**:
```tsx
// CreateTemplate.tsx
<PageHeader 
  title="创建工作流模板"
  showBackButton={true}
  backTo="/workflows/templates"
/>
```

#### 1.3.2 样式系统

**CSS变量定义** (`variables.css`):
```css
:root {
  /* 颜色规范 */
  --color-primary: #1890ff;
  --color-success: #52c41a;
  --color-warning: #faad14;
  --color-error: #ff4d4f;
  --color-bg: #f5f5f5;
  --color-text: #333333;
  --color-text-secondary: #666666;
  --color-border: #d9d9d9;
  
  /* 间距规范 */
  --spacing-page: 24px;
  --spacing-card: 16px;
  --spacing-element: 8px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* 按钮规范 */
  --button-height: 32px;
  --button-padding: 0 15px;
  --button-radius: 4px;
  
  /* 卡片规范 */
  --card-radius: 8px;
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  --card-padding: 16px;
  
  /* 字体规范 */
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  --font-size-xxl: 20px;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;
}
```

### 1.4 路由设计

```typescript
const routes = [
  {
    path: '/workflows/templates',
    element: <Templates />,
    meta: { title: '模板库', showBackButton: false }
  },
  {
    path: '/workflows/templates/create',
    element: <CreateTemplate />,
    meta: { title: '创建模板', showBackButton: true, backTo: '/workflows/templates' }
  },
  {
    path: '/workflows/templates/:id',
    element: <TemplateDetail />,
    meta: { title: '模板详情', showBackButton: true, backTo: '/workflows/templates' }
  },
  {
    path: '/workflows/templates/:id/edit',
    element: <CreateTemplate />,
    meta: { title: '编辑模板', showBackButton: true, backTo: '/workflows/templates' }
  },
  {
    path: '/workflows/instances',
    element: <Instances />,
    meta: { title: '实例管理', showBackButton: false }
  },
  {
    path: '/workflows/instances/:id',
    element: <InstanceDetail />,
    meta: { title: '实例详情', showBackButton: true, backTo: '/workflows/instances' }
  },
  {
    path: '/workflows/reviews',
    element: <Reviews />,
    meta: { title: '审核中心', showBackButton: false }
  }
]
```

### 1.5 状态管理设计

#### 1.5.1 Zustand Store结构

```typescript
// templateStore.ts
interface TemplateStore {
  templates: Template[]
  currentTemplate: Template | null
  loading: boolean
  error: string | null
  
  // Actions
  fetchTemplates: (params?: QueryParams) => Promise<void>
  fetchTemplate: (id: string) => Promise<void>
  createTemplate: (data: CreateTemplateDTO) => Promise<Template>
  updateTemplate: (id: string, data: UpdateTemplateDTO) => Promise<Template>
  deleteTemplate: (id: string) => Promise<void>
}
```

#### 1.5.2 React Query使用

```typescript
// useTemplates.ts
export function useTemplates(params?: QueryParams) {
  return useQuery({
    queryKey: ['templates', params],
    queryFn: () => templatesApi.list(params),
    staleTime: 30000, // 30秒
    refetchOnWindowFocus: true
  })
}

export function useCreateTemplate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: templatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    }
  })
}
```

### 1.6 数据流设计

#### 1.6.1 用户操作流程

```
用户访问模板列表页
  ↓
点击"创建模板"按钮
  ↓
跳转到 /workflows/templates/create
  ↓
页面显示PageHeader（包含返回按钮）
  ↓
用户填写表单、编辑DAG
  ↓
点击"保存"按钮
  ↓
调用API创建模板
  ↓
成功后跳转回列表页（或点击返回按钮）
```

#### 1.6.2 实时更新流程

```
WebSocket连接建立
  ↓
订阅 workflow.{id}.steps 频道
  ↓
接收 step.progress 事件
  ↓
更新UI（进度条、状态徽章）
  ↓
用户可查看实时进度
```

---

## 2. 后端架构

### 2.1 技术栈

- **框架**: FastAPI (Python 3.10+)
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **ORM**: SQLAlchemy 2.0
- **数据验证**: Pydantic v2
- **异步任务**: Celery
- **缓存**: Redis
- **WebSocket**: FastAPI原生支持

### 2.2 目录结构

```
backend/app/
├── api/                          # API层
│   ├── workflow/
│   │   ├── templates.py         # 模板API
│   │   ├── instances.py         # 实例API
│   │   ├── steps.py             # 步骤API
│   │   ├── reviews.py           # 审核API
│   │   └── agents.py            # Agent API
│   ├── websocket.py             # WebSocket端点
│   └── deps.py                  # 依赖注入
│
├── services/                     # 服务层
│   ├── workflow/
│   │   ├── template_service.py  # 模板服务
│   │   ├── instance_service.py  # 实例服务
│   │   ├── step_service.py      # 步骤服务
│   │   ├── scheduler_service.py # DAG调度器
│   │   └── review_service.py    # 审核服务
│   ├── gateway/
│   │   ├── gateway_client.py    # Gateway客户端
│   │   └── agent_dispatcher.py  # Agent分发器
│   └── notification/
│       ├── notification_service.py
│       └── websocket_manager.py
│
├── models/                       # 数据模型层
│   └── workflow.py              # 工作流模型
│
├── schemas/                      # Pydantic schemas
│   └── workflow.py
│
├── tasks/                        # Celery任务
│   ├── scheduler_task.py
│   └── timeout_task.py
│
└── utils/                        # 工具函数
    ├── dag_validator.py
    └── agent_matcher.py
```

### 2.3 API层设计

#### 2.3.1 路由注册

```python
# api/__init__.py
from fastapi import APIRouter
from .workflow import templates, instances, steps, reviews, agents

api_router = APIRouter()

api_router.include_router(
    templates.router,
    prefix="/workflow-templates",
    tags=["templates"]
)

api_router.include_router(
    instances.router,
    prefix="/workflows",
    tags=["workflows"]
)

api_router.include_router(
    steps.router,
    prefix="/workflows/{workflow_id}/steps",
    tags=["steps"]
)

api_router.include_router(
    reviews.router,
    prefix="/reviews",
    tags=["reviews"]
)

api_router.include_router(
    agents.router,
    prefix="/agents",
    tags=["agents"]
)
```

#### 2.3.2 依赖注入

```python
# api/deps.py
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.workflow.template_service import TemplateService

def get_template_service(
    db: Session = Depends(get_db)
) -> TemplateService:
    return TemplateService(db)

def get_current_user():
    # JWT验证逻辑
    pass
```

### 2.4 服务层设计

#### 2.4.1 模板服务

```python
class TemplateService:
    def __init__(self, db: Session):
        self.db = db
    
    async def create_template(
        self, 
        template_data: CreateTemplateDTO,
        user_id: str
    ) -> Template:
        """创建模板"""
        # 1. 验证DAG
        self._validate_dag(template_data.dag)
        
        # 2. 创建模板记录
        template = Template(
            name=template_data.name,
            description=template_data.description,
            dag=template_data.dag.dict(),
            config=template_data.config.dict(),
            tags=template_data.tags,
            created_by=user_id,
            status=TemplateStatus.DRAFT
        )
        
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        
        return template
    
    def _validate_dag(self, dag: DAG):
        """验证DAG有效性"""
        # 检查循环依赖
        # 检查起始节点
        # 检查节点连接
        pass
```

### 2.5 数据库设计

已在 `docs/design/workflow-schema.sql` 中定义，包括：
- workflow_templates
- workflow_instances
- step_executions
- human_reviews
- workflow_artifacts
- workflow_logs
- agents

---

## 3. 实时通信设计

### 3.1 WebSocket架构

```
前端 WebSocket Client
  ↓
FastAPI WebSocket Endpoint
  ↓
WebSocketManager (连接管理)
  ↓
订阅/发布模式
  ↓
实时事件推送
```

### 3.2 事件流设计

```
工作流状态变更
  ↓
WebSocketManager.publish()
  ↓
推送事件到所有订阅者
  ↓
前端接收并更新UI
```

---

## 4. Gateway集成设计

### 4.1 架构图

```
Control Plane Backend
  ↓
GatewayClient (HTTP客户端)
  ↓
OpenClaw Gateway API
  ↓
Agent集群
```

### 4.2 任务分发流程

```
1. DAG调度器识别可执行步骤
2. Agent匹配器选择合适的Agent
3. 调用AgentDispatcher.dispatch_step_to_agent()
4. Gateway创建Agent会话并分发任务
5. Agent开始执行，通过WebSocket上报进度
6. 执行完成后，Gateway回调Control Plane
7. Control Plane更新步骤状态，触发DAG调度器继续
```

---

## 5. 性能优化设计

### 5.1 前端优化

1. **代码分割**: React.lazy + Suspense
2. **列表虚拟化**: react-window
3. **图片懒加载**: Intersection Observer
4. **缓存策略**: React Query缓存
5. **WebSocket压缩**: 启用压缩

### 5.2 后端优化

1. **数据库索引**: 已在Schema中定义
2. **连接池**: SQLAlchemy连接池
3. **缓存**: Redis缓存常用数据
4. **异步IO**: async/await
5. **批量操作**: 批量插入/更新

---

## 6. 安全设计

### 6.1 认证与授权

- JWT Bearer Token认证
- 基于角色的权限控制（RBAC）
- 资源级权限控制

### 6.2 数据安全

- 输入验证（Pydantic）
- SQL注入防护（ORM）
- XSS防护（React自动转义）
- CSRF防护（Token验证）

---

## 7. 监控与日志

### 7.1 应用监控

- API响应时间
- 错误率统计
- WebSocket连接数
- 数据库查询性能

### 7.2 业务监控

- 工作流成功率
- 审核超时率
- Agent可用率
- 任务队列长度

---

## 8. 部署架构

### 8.1 开发环境

```
Frontend (Vite Dev Server) :3000
  ↓
Backend (FastAPI + Uvicorn) :8000
  ↓
SQLite + Redis
```

### 8.2 生产环境

```
Nginx (反向代理)
  ↓
Frontend (静态文件)
Backend (FastAPI + Uvicorn)
  ↓
PostgreSQL + Redis
  ↓
Celery Workers
```

---

## 9. 技术债务与改进方向

### 9.1 当前限制

1. SQLite在开发环境使用，生产环境需要切换到PostgreSQL
2. WebSocket断线重连需要优化
3. DAG可视化性能需要优化（大型DAG）

### 9.2 改进方向

1. 增加GraphQL支持（可选）
2. 增加Service Worker离线支持
3. 增加DAG版本对比功能
4. 增加工作流模板市场

---

## 10. 总结

本架构设计遵循以下原则：

1. **模块化**: 前后端分层清晰，职责明确
2. **可扩展**: 易于添加新功能
3. **高性能**: 使用缓存、异步、索引等优化手段
4. **安全性**: JWT认证 + RBAC授权
5. **可维护**: TypeScript类型安全 + Python类型提示

**下一步**: 进入 Step 6 - UI/UX设计
