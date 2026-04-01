# OpenClaw Control Plane — Phase 3: 对接 OpenClaw Gateway

> 创建时间：2026-03-31 | 目标：Control Plane 真正管控 OpenClaw Agent 任务

## 核心原则
- **不修改 OpenClaw 源码**，Control Plane 作为 Gateway 的 WebSocket 客户端
- 复用现有 UI（i18n、主题、侧边栏），只替换数据层
- 后端从独立 SQLite 切换为 Gateway WebSocket 代理

## Gateway WebSocket 协议

### 连接
```
ws://127.0.0.1:18789/
首帧: {type:"req", id:1, method:"connect", params:{auth:{token:"<gateway_token>"}, role:"client"}}
响应: {type:"res", id:1, ok:true, payload:{...snapshot}}
```

### RPC 调用格式
```
请求: {type:"req", id:N, method:"<method>", params:{...}}
响应: {type:"res", id:N, ok:true, payload:{...}} 或 {type:"res", id:N, ok:false, error:{message:"..."}}
```

### 事件推送
```
{type:"event", event:"<event_name>", payload:{...}}
```

### 可用方法

| 方法 | 功能 | 参数 |
|---|---|---|
| `sessions.list` | 列出会话 | `{limit?, kinds?, activeMinutes?, messageLimit?}` |
| `sessions.patch` | 修改会话配置 | `{sessionKey, model?, thinking?, verbose?}` |
| `sessions.history` | 会话历史 | `{sessionKey, limit?, includeTools?}` |
| `sessions.send` | 向其他会话发消息 | `{sessionKey, message}` |
| `cron.list` | 列出定时任务 | `{includeDisabled?}` |
| `cron.add` | 创建定时任务 | `{name, schedule, payload, delivery?, sessionTarget?}` |
| `cron.update` | 更新定时任务 | `{jobId, patch:{...}}` |
| `cron.remove` | 删除定时任务 | `{jobId}` |
| `cron.run` | 手动触发任务 | `{jobId}` |
| `cron.runs` | 任务执行历史 | `{jobId}` |
| `chat.send` | 发送消息给 agent | `{message, idempotencyKey}` |
| `chat.abort` | 中止 agent 运行 | `{runId?}` |
| `chat.history` | 聊天历史 | `{limit?}` |
| `status` | 系统状态 | `{}` |
| `health` | 健康检查 | `{}` |
| `config.get` | 读取配置 | `{path?}` |
| `config.set` | 修改配置 | `{key, value}` |
| `config.schema.lookup` | 查询配置 schema | `{path}` |
| `logs.tail` | 实时日志 | `{filter?}` |
| `node.list` | 节点列表 | `{}` |

### 可订阅事件
- `session` — 会话状态变更
- `agent` — agent 运行事件（tool call 输出等）
- `cron` — 定时任务执行事件
- `presence` — 在线状态
- `health` — 健康状态
- `chat` — 聊天消息

## 架构设计

```
┌─────────────────────────────────────────────┐
│  Control Plane 前端 (React)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Dashboard│ │ Sessions │ │ Cron Manager │ │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       │             │              │         │
│  ┌────┴─────────────┴──────────────┴───────┐ │
│  │  OpenClaw Gateway Client (WebSocket)    │ │
│  │  - 连接管理 / 断线重连 / 认证           │ │
│  │  - RPC 调用封装                          │ │
│  │  - 事件订阅 & 分发                       │ │
│  └────────────────────┬────────────────────┘ │
└───────────────────────┼──────────────────────┘
                        │ WebSocket (ws://127.0.0.1:18789)
                        │
┌───────────────────────┼──────────────────────┐
│  OpenClaw Gateway     │                       │
│  (不修改)             │                       │
└───────────────────────┘
```

## 前端改造（研发团队）

### Step 1: WebSocket 客户端模块
- 创建 `src/lib/gateway-client.ts`
- 连接管理：connect / disconnect / reconnect（指数退避）
- RPC 封装：`call(method, params)` 返回 Promise
- 事件订阅：`on(event, callback)` / `off(event, callback)`
- 连接状态：connected / connecting / disconnected / error

### Step 2: Gateway Token 配置
- 设置页面：输入 Gateway URL + Token
- localStorage 持久化
- 连接测试按钮
- 连接状态指示器（侧边栏底部）

### Step 3: 替换数据层
- 创建 `src/hooks/useGateway.ts` 系列 hooks
- `useSessions()` — 替换 projects/tasks API，订阅 session 事件
- `useCronJobs()` — 替换所有 cron 管理
- `useStatus()` — 实时系统状态
- `useChat()` — 聊天功能（直接在 Control Plane 里跟 agent 对话）

### Step 4: 重构页面
- **Dashboard** → Gateway 实时状态（session 数、agent 运行数、cron 数、模型信息）
- **Sessions** → 替换 Projects，展示 OpenClaw 会话列表（可筛选/搜索）
- **Session Detail** → 替换 Task Detail，展示会话历史、活跃 agent、可发送消息/中止运行
- **Cron Manager** → 新页面，定时任务 CRUD、执行历史、手动触发
- **Chat** → 新页面，直接跟 agent 对话（替代 webchat 的功能）
- **Agents** → 新页面，展示已注册 agent 列表 + 状态
- **Logs** → 新页面，实时日志流

### Step 5: 实时更新
- Session 状态变更 → 自动刷新列表
- Agent 运行输出 → 实时推送（类似 Control UI 的 tool call cards）
- Cron 执行 → 通知

### Step 6: 后端简化
- 保留后端仅作为静态文件服务器（如果需要 nginx 代理 WebSocket）
- 或者前端直连 Gateway（同机部署，无跨域问题）

## 约束
- 不修改 OpenClaw 任何源码
- Gateway Token 存在浏览器 localStorage（用户自行配置）
- 前端直连 Gateway WebSocket（同机部署，127.0.0.1）
- 保留现有 i18n（中英文）和主题切换功能
- 保持 5 套主题
- 所有新功能文案必须中英文

## 验收标准
1. ✅ Control Plane 能连接 Gateway 并展示真实 session 列表
2. ✅ Session 详情页展示真实聊天历史
3. ✅ 能在 Control Plane 里发消息给 agent 并收到回复
4. ✅ 能中止 agent 运行
5. ✅ Cron 任务管理（创建/编辑/删除/手动触发）
6. ✅ 实时状态更新（session 创建/销毁/状态变更）
7. ✅ Dashboard 展示 Gateway 真实指标
8. ✅ 保留中英文切换 + 5 套主题
9. ✅ 所有页面 i18n 覆盖 100%
10. ✅ `vite build` 通过，部署到 :92 可访问
