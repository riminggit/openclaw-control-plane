# Agent 编排系统对比报告

> 调研时间：2026-04-01 | 版本：v1.0

## 1. 概述

本报告对比 6 个主流 Agent 编排系统，为 openclaw-control-plane 的 Agent 任务自动流转系统设计提供参考。

## 2. 系统总览

| 系统 | 语言 | 定位 | Stars (GitHub) | 许可证 |
|------|------|------|------|--------|
| LangGraph | Python/JS | 图状态机编排 | 12k+ | MIT |
| CrewAI | Python | 角色协作编排 | 30k+ | Apache-2.0 |
| AutoGen | Python | 对话式多 Agent | 40k+ | MIT |
| Google ADK | Python/TS | Google 生态 Agent | 8k+ | Apache-2.0 |
| Mastra | TypeScript | TS-first Agent 全栈框架 | 6k+ | Apache-2.0 |
| Ralph TUI | TypeScript | 终端 UI Agent 循环调度 | 2k+ | MIT |

## 3. 对比维度

### 3.1 任务定义方式

| 系统 | 定义方式 | 说明 |
|------|----------|------|
| **LangGraph** | 图结构定义 (StateGraph) | 节点=处理函数，边=转移条件，支持条件分支、循环、并行 |
| **CrewAI** | Agent + Task 声明式 | 定义 Agent 角色和 Task 对象，通过 `process` 属性控制顺序（sequential/hierarchical） |
| **AutoGen** | 对话消息驱动 | Agent 通过消息传递协作，无显式任务图，靠 Agent 自主决定下一步 |
| **Google ADK** | 声明式 Agent 定义 | Agent 类继承 + tools 列表 + runner 抽象，支持 multi-agent 编排 |
| **Mastra** | Workflow DAG + Agent | Workflow 定义步骤图，Agent 封装 LLM + tools + memory |
| **Ralph TUI** | 任务列表 + TUI 选择 | 从 GitHub/GitLab Issues 读取任务，按优先级自动选择执行 |

### 3.2 流转机制

| 系统 | 流转模式 | 并行 | 条件分支 | 动态路由 |
|------|----------|------|----------|----------|
| **LangGraph** | 图边转移函数 | ✅ Send API | ✅ 条件边 | ✅ 路由函数 |
| **CrewAI** | Task 顺序/hierarchy | ❌ 顺序为主 | ✅ 条件 Task | ❌ 固定流程 |
| **AutoGen** | 消息广播/定向 | ✅ Group Chat | ✅ Agent 自主判断 | ✅ 对话驱动 |
| **Google ADK** | Runner + Session | ✅ 内置 | ✅ 条件工具调用 | ✅ Agent 决策 |
| **Mastra** | Workflow step | ✅ parallel() | ✅ condition() | ✅ 动态 step |
| **Ralph TUI** | 优先级排序队列 | ❌ 串行 | ❌ | ❌ 固定优先级 |

### 3.3 状态管理

| 系统 | 状态方式 | 持久化 | 检查点 |
|------|----------|--------|--------|
| **LangGraph** | TypedDict/Pydantic State | ✅ 内置 Checkpointer | ✅ SQLite/Postgres |
| **CrewAI** | Task 输出 → 下一个 Task 输入 | ❌ 仅内存 | ❌ |
| **AutoGen** | 消息历史 + Agent 内存 | ✅ 可选持久化 | ❌ |
| **Google ADK** | Session State | ✅ 内置 Session 管理 | ✅ |
| **Mastra** | Workflow Step 生成 State | ✅ 数据库持久化 | ✅ |
| **Ralph TUI** | 文件持久化 (JSON) | ✅ 本地文件 | ✅ 自动保存 |

### 3.4 人工介入 (Human-in-the-Loop)

| 系统 | 方式 | 说明 |
|------|------|------|
| **LangGraph** | `interrupt_before`/`interrupt_after` | 在指定节点暂停，等待用户输入后恢复 |
| **CrewAI** | `human_input=True` | Task 级别配置，简单但粒度粗 |
| **AutoGen** | HumanProxy Agent | 引入人类 Agent 参与对话，灵活但需手动管理 |
| **Google ADK** | Human-in-the-loop callback | 内置回调机制 |
| **Mastra** | Workflow step 暂停 | 支持 step 级暂停和恢复 |
| **Ralph TUI** | 手动审批模式 | 支持 auto/approve/reject 三种模式 |

### 3.5 错误恢复

| 系统 | 重试 | 回退 | 转人工 |
|------|------|------|--------|
| **LangGraph** | 自定义节点逻辑 | ✅ 条件边重路由 | ✅ interrupt |
| **CrewAI** | 基础重试 | ❌ | ⚠️ 需自定义 |
| **AutoGen** | Agent 自主重试 | ⚠️ 有限 | ✅ HumanProxy |
| **Google ADK** | Runner 内置 | ✅ | ✅ 回调 |
| **Mastra** | Step 级重试 | ✅ | ✅ 暂停等待 |
| **Ralph TUI** | 失败标记+跳过 | ✅ 跳过下一个 | ✅ 手动模式 |

## 4. 核心洞察

### 4.1 最佳实践模式

1. **图结构是最成熟的编排范式** — LangGraph 的 StateGraph 模型已成为事实标准，提供最细粒度的控制
2. **角色抽象降低使用门槛** — CrewAI 证明 "Agent = 角色 + 能力" 的模型对非技术用户更友好
3. **检查点必不可少** — 所有生产级系统都需要状态持久化和恢复能力
4. **Human-in-the-loop 是刚需** — 关键决策点需要人工审批，这是安全合规的底线

### 4.2 对 openclaw-control-plane 的启示

| 启示 | 来源 | 优先级 |
|------|------|--------|
| 采用 DAG 图作为核心编排模型 | LangGraph/Mastra | P0 |
| 内置检查点和状态持久化 | LangGraph/ADK | P0 |
| 任务级人工审批节点 | LangGraph interrupt | P0 |
| 角色/能力标签匹配自动分发 | CrewAI Agent 匹配 | P1 |
| 并行任务执行 | LangGraph Send API | P1 |
| 失败自动重试 + 转人工 | 全部系统共性 | P1 |
| 优先级队列调度 | Ralph TUI | P2 |

### 4.3 OpenClaw 特有优势

OpenClaw 本身已具备 subagent spawn/capability 系统，控制面板需要做的是：
- **可视化层**：让 subagent 的 spawn → execute → report 全流程可见
- **编排层**：支持定义任务 DAG，自动调度 subagent
- **管控层**：审批节点、成本控制、异常告警
