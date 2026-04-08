# Step 5: 架构设计

**创建时间**：2026-04-02 18:50
**负责人**：rd-commander
**状态**：已完成

---

## 🏗️ 系统架构

### 1. 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     用户界面层                            │
│  React 18 + TypeScript + Ant Design 5                  │
└─────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST
┌─────────────────────────────────────────────────────────┐
│                      API 网关层                           │
│                   Nginx (反向代理)                        │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                      后端服务层                           │
│         FastAPI + SQLAlchemy + Pydantic                 │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                      数据存储层                           │
│              SQLite (开发) / PostgreSQL (生产)           │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 前端架构

### 技术栈
- **框架**：React 18.3
- **语言**：TypeScript 5.2
- **UI 库**：Ant Design 5.12
- **状态管理**：React Hooks (useState, useEffect, useCallback)
- **路由**：React Router 6.20
- **HTTP 客户端**：Fetch API
- **构建工具**：Vite 5.0

### 目录结构
```
frontend/
├── src/
│   ├── api/           # API 客户端
│   ├── components/    # 可复用组件
│   ├── hooks/         # 自定义 Hooks
│   ├── layouts/       # 布局组件
│   ├── pages/         # 页面组件
│   ├── types/         # TypeScript 类型定义
│   ├── utils/         # 工具函数
│   ├── App.tsx        # 根组件
│   └── main.tsx       # 入口文件
├── public/            # 静态资源
└── index.html         # HTML 模板
```

### 关键设计
1. **组件化**：每个页面独立，组件可复用
2. **类型安全**：TypeScript 提供完整类型定义
3. **状态管理**：使用 React Hooks，避免复杂状态管理库
4. **API 抽象**：统一的 API 客户端，便于维护

---

## 3. 后端架构

### 技术栈
- **框架**：FastAPI 0.104
- **语言**：Python 3.11
- **ORM**：SQLAlchemy 2.0
- **数据验证**：Pydantic 2.5
- **数据库**：SQLite 3 (开发) / PostgreSQL 15 (生产)
- **服务器**：Uvicorn 0.24

### 目录结构
```
backend/
├── app/
│   ├── api/           # API 路由
│   │   ├── workflow/  # 工作流相关 API
│   │   └── ...
│   ├── core/          # 核心配置
│   ├── models/        # 数据模型
│   ├── schemas/       # Pydantic 模型
│   ├── services/      # 业务逻辑
│   └── main.py        # 应用入口
├── alembic/           # 数据库迁移
└── tests/             # 测试代码
```

### 关键设计
1. **分层架构**：API 层 → Service 层 → Data 层
2. **依赖注入**：使用 FastAPI 的依赖注入机制
3. **数据验证**：Pydantic 提供请求/响应验证
4. **错误处理**：统一的异常处理机制

---

## 4. 数据流设计

### 4.1 创建工作流模板
```
用户输入 → 前端验证 → API 请求 → 后端验证 → 
数据库保存 → 返回结果 → 前端更新
```

### 4.2 启动工作流实例
```
选择模板 → 输入参数 → API 请求 → 创建实例 → 
初始化状态 → 触发执行 → 返回实例ID
```

### 4.3 审核流程
```
查看待审核 → 查看输出 → 填写意见 → 提交审核 → 
更新状态 → 继续执行 → 通知相关人员
```

---

## 5. 部署架构

### 5.1 开发环境
- 前端：Vite dev server (localhost:5173)
- 后端：Uvicorn (localhost:8000)
- 数据库：SQLite 文件

### 5.2 生产环境
- 前端：Nginx 静态文件服务 (/var/www/control-plane/)
- 后端：Uvicorn (127.0.0.1:8000)
- 数据库：SQLite 或 PostgreSQL
- 反向代理：Nginx (端口 92)

### 5.3 Nginx 配置
```nginx
server {
    listen 92;
    server_name 43.155.138.191;

    # 前端静态文件
    location / {
        root /var/www/control-plane;
        try_files $uri /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 6. 技术选型理由

### 前端
- **React 18**：成熟、生态丰富、性能优秀
- **TypeScript**：类型安全，提高代码质量
- **Ant Design**：企业级 UI，组件丰富
- **Vite**：构建速度快，开发体验好

### 后端
- **FastAPI**：高性能、类型安全、自动文档
- **SQLAlchemy**：成熟的 ORM，功能强大
- **SQLite/PostgreSQL**：开发简单，生产可靠

---

**状态**：✅ 架构设计完成
