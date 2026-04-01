# 需求文档：Agent 任务自动流转系统 + 高价值功能补全

> 项目：openclaw-control-plane | 版本：v2.0 | 日期：2026-04-01
> 状态：草稿 | 关联调研：agent-orchestration-comparison.md, dashboard-features-benchmark.md

---

## 一、Agent 任务自动流转系统

### 1.1 任务定义

**模型**：Task 实体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | UUID | ✅ | 任务唯一标识 |
| title | string | ✅ | 任务标题 |
| description | string | ✅ | 详细描述（支持 Markdown） |
| priority | enum | ✅ | P0/P1/P2/P3 |
| capabilities | string[] | ✅ | 所需 Agent 能力标签（如 `backend`, `frontend`, `research`） |
| estimated_duration | number | ❌ | 预计耗时（分钟） |
| dependencies | UUID[] | ❌ | 前置任务 ID |
| execution_mode | enum | ✅ | `sequential` / `parallel` / `conditional` |
| human_review | boolean | ✅ | 是否需要人工审核 |
| retry_policy | object | ❌ | 重试策略（max_retries, backoff） |
| created_at | timestamp | ✅ | 创建时间 |
| created_by | string | ✅ | 创建者 |

### 1.2 Agent 匹配

**机制**：基于能力标签 + 负载状态的自动匹配

```
输入：Task.capabilities → 匹配 → Agent（按空闲度排序）
```

- 每个 Agent 注册时声明其能力标签集
- 匹配算法：Jaccard 相似度 × 空闲权重
- 优先匹配空闲 Agent，满载时排队等待
- 支持手动指定 Agent 覆盖自动匹配

### 1.3 任务分发

**执行模式**：

| 模式 | 说明 | 可视化 |
|------|------|--------|
| Sequential | 串行执行，前一个完成后启动下一个 | 线性链 |
| Parallel | 并行执行，全部同时启动 | 扇出 |
| Conditional | 根据前序结果条件分支 | DAG 分叉 |

**DAG 定义格式**：
```yaml
workflow:
  name: "功能开发流水线"
  steps:
    - id: research
      agent: researcher
      capabilities: [research]
    - id: design
      agent: architect
      capabilities: [architecture]
      depends_on: [research]
    - id: dev-backend
      agent: backend-dev
      capabilities: [backend]
      depends_on: [design]
      parallel_with: [dev-frontend]
    - id: dev-frontend
      agent: frontend-dev
      capabilities: [frontend]
      depends_on: [design]
    - id: review
      human_review: true
      depends_on: [dev-backend, dev-frontend]
```

### 1.4 状态追踪

**状态机**：

```
pending → assigned → running → (completed | failed | cancelled)
                              ↓
                           retrying → running | failed
                              ↓
                           awaiting_review → approved → running
                                            → rejected → failed
```

每个状态变更记录事件日志（timestamp, actor, reason）。

### 1.5 人工审核节点

- 任务定义 `human_review: true` 时，执行到该节点自动暂停
- 审核界面展示：上游任务产出摘要 + 关键决策点
- 审核操作：Approve（继续）/ Reject（终止）/ Request Changes（回退）
- 审核超时提醒（可配置，默认 24h）
- 审核记录永久保存

### 1.6 错误恢复

**策略**：

| 失败类型 | 处理方式 |
|----------|----------|
| LLM 超时/API 错误 | 自动重试（指数退避，最多 3 次） |
| 工具调用失败 | 重试 1 次，仍失败则标记 + 跳过或转人工 |
| Agent 无响应 | 5 分钟超时 → 标记失败 → 重试或转人工 |
| 人工审核超时 | 发送提醒 → 超时阈值后自动拒绝 |
| 全局错误 | 暂停工作流 → 通知管理员 |

**配置**：
```yaml
retry_policy:
  max_retries: 3
  backoff: exponential  # 1s, 2s, 4s
  on_final_failure: escalate_to_human
```

### 1.7 进度可视化

- **DAG 图**：展示任务依赖关系和当前执行状态（React Flow / D3）
- **节点状态颜色**：gray=pending, blue=assigned, green=running, amber=awaiting_review, green=completed, red=failed
- **实时进度条**：整体完成百分比 + 各阶段进度
- **时间线视图**：按时间顺序展示所有事件

---

## 二、高价值功能补全

### P0 — MVP 必做

| # | 功能 | 用户价值 | 复杂度 | 参考产品 | 说明 |
|---|------|----------|--------|----------|------|
| F01 | 执行链路追踪 | ⭐⭐⭐⭐⭐ | 高 | LangSmith/Langfuse | 每个 subagent 调用的完整 trace |
| F02 | 实时监控仪表盘 | ⭐⭐⭐⭐⭐ | 中 | Langfuse | 请求量、延迟、错误率时间序列 |
| F03 | Token/成本追踪 | ⭐⭐⭐⭐⭐ | 中 | OpenRouter | 按 agent/model 分组的 token 用量和成本 |
| F04 | 任务 DAG 可视化 | ⭐⭐⭐⭐⭐ | 高 | LangGraph Studio | 交互式 DAG 图，点击查看详情 |

### P1 — v1.1 重要功能

| # | 功能 | 用户价值 | 复杂度 | 参考产品 | 说明 |
|---|------|----------|--------|----------|------|
| F05 | 模型性能 A/B 对比 | ⭐⭐⭐⭐ | 中 | Weave/Braintrust | 不同模型的速度、质量、成本对比 |
| F06 | 智能告警系统 | ⭐⭐⭐⭐ | 中 | Braintrust | 错误率、延迟、成本阈值告警 |
| F07 | 预算管理 | ⭐⭐⭐⭐ | 低 | OpenRouter | 日/周/月预算设置 + 超支告警 |
| F08 | Prompt 模板管理 | ⭐⭐⭐⭐ | 中 | 全部竞品 | Agent system prompt 版本管理 |
| F09 | 任务日志搜索 | ⭐⭐⭐⭐ | 中 | LangSmith | 全文搜索历史执行记录 |

### P2 — v1.2+ 增强功能

| # | 功能 | 用户价值 | 复杂度 | 参考产品 | 说明 |
|---|------|----------|--------|----------|------|
| F10 | Agent Memory 管理 | ⭐⭐⭐⭐⭐ | 高 | **无竞品（差异化）** | 可视化查看/编辑/删除 agent 记忆 |
| F11 | 评估自动化 | ⭐⭐⭐ | 高 | Braintrust | 自动评估 agent 输出质量 |
| F12 | 多用户协作 | ⭐⭐⭐ | 高 | LangSmith Team | 团队共享 dashboard 和审核 |
| F13 | 回归检测 | ⭐⭐⭐ | 中 | Braintrust | prompt 变更后的质量对比 |
| F14 | Agent 技能市场 | ⭐⭐⭐ | 高 | ClawHub | 浏览/安装/管理 agent skills |

---

## 三、技术约束

- 前端：React + TypeScript + Vite
- 图可视化：React Flow（DAG）+ Recharts（时间序列）
- 数据存储：复用现有 PostgreSQL
- 实时通信：WebSocket（SSE 降级）
- 与 OpenClaw Gateway API 集成（subagent 管理、session 监控）
