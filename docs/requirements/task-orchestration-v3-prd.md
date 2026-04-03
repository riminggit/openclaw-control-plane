# 任务编排增强 v3 — 需求规格与落地方案（PRD）

> **项目**：openclaw-control-plane  
> **版本**：v3.0-draft  
> **日期**：2026-04-02  
> **状态**：待评审  
> **优先级声明**：本文以**任务编排增强**为第一目标；允许对控制面、数据模型与 Gateway 契约进行**大规模重构**。  
> **关联文档**：`agent-workflow-v2.md`、`research/agent-orchestration-comparison.md`、`design/workflow-api-design.md`、`ARCHITECTURE.md`

---

## 一、背景与目标

### 1.1 问题陈述

当前系统已具备 **DAG 工作流模板 / 实例、步骤执行、Agent 匹配、人工审核** 等能力，但在「任务编排」维度仍存在典型缺口：

- **静态 DAG 为主**：难以表达「运行时生成的子任务树」「Planner 输出结构化计划再执行」等模式。
- **状态与检查点**：长时运行、失败恢复、重放（replay）语义未与业界 durable execution 对齐。
- **执行面与控制面边界**：Gateway 已承载会话与工具调用，但**工作流步骤**与 **Agent 会话/工具/MCP** 之间缺少统一编排契约。
- **可观测性**：多 Agent、并行分支、条件边的运行时视图与审计链路不完整。

### 1.2 目标（Goals）

| ID | 目标 | 验收口径 |
|----|------|----------|
| G1 | **双轨编排模型**：静态 DAG + 动态计划（Plan/Subtask）并存且可组合 | 同一实例可同时存在「模板边」与「运行时展开子图」 |
| G2 | **持久化执行语义**：步骤级 memo、重试、暂停/恢复、人工卡点与审计 | 对齐 Temporal/Inngest 等「durability」核心语义（见第三节） |
| G3 | **与 Claude 式运行时对齐**：会话、工具、命令、协调模式可通过**契约**接入，而非硬编码 | Gateway/Runner 实现可替换；控制面只依赖协议 |
| G4 | **可横向扩展**：未来可嵌入 LangGraph 子图执行或外部编排器，而不推翻数据模型 | 定义清晰的 `OrchestrationBackend` 抽象 |
| G5 | **后续 OpenClaw 版本可演进**：升级控制面/执行面时，老客户端与历史实例行为可预测 | 见 **§3.5** 分层契约、版本字段与弃用节奏 |

### 1.3 非目标（Non-Goals）

- **不**将任何第三方「还原源码仓库」作为依赖直接打进发布产物（版权与维护风险）；**可**借鉴其**模块边界与协议设计**。
- **不**在 v3 首轮一次性替换所有现有 API；采用**双写/适配层**与**特性开关**迁移。
- **不**承诺与某一商业产品 100% 行为一致；以 OpenClaw 场景可验证为准。

---

## 二、业界方案调研与横向对比

以下为 **全网公开资料** 归纳（含框架文档与行业对比文章），用于指导选型组合，而非单一依赖。

### 2.1 对比总表

| 方案 | 类型 | 核心抽象 | 持久化/恢复 | 并行/分支 | HITL | 与 OpenClaw 契合度 | 备注 |
|------|------|----------|-------------|-----------|------|---------------------|------|
| **[LangGraph](https://www.langchain.com/langgraph/)** | Agent 图编排 | StateGraph、节点、边、共享 State | Checkpointer（SQLite/Postgres 等） | 条件边、Send 并行 | `interrupt_before/after` | **极高**（理念与现有 DAG+审核一致） | 适合作为**执行子引擎**或**语义参考** |
| **[Temporal](https://temporal.io/)** | 通用 durable workflow | Workflow + Activity | 事件溯源、确定性重放 | 子工作流、并行 | Signal/Query + 人工任务模式 | **高**（可靠性标杆） | 运维与基础设施成本高；适合**核心执行层**若长期要金融级可靠性 |
| **[Inngest](https://www.inngest.com/)** | 事件驱动 + 持久步骤 | `step.run` / `invoke` / `waitForEvent` | 步骤 memo、独立重试 | 并行 step | `waitForEvent` 等人机等待 | **中高** | TS 生态友好；适合 **Gateway 侧**若与 Node 运行时同栈 |
| **[Kestra](https://kestra.io/)** | 声明式编排平台 | Flow YAML、Subflow、触发器 | 执行历史与日志 | ForEach/并行/条件 | 可接人工审批任务 | **中** | 偏 ETL/运维自动化；**可借鉴 UI/YAML 分层**，不必整体引入 |
| **[Prefect](https://www.prefect.io/)** | Python 数据/任务流 | Flow/Task | 重试、状态 | 支持 | 自定义 | **中** | 与 AI Agent 耦合弱，作**调度/观测**参考 |
| **[Mastra](https://mastra.ai/)** | TS Agent + Workflow | Workflow DAG + Step | 持久化 step | `parallel`/`condition` | step 暂停 | **高** | 与「控制面 TS + 执行 TS」路线一致时的**前端/类型层**参考 |
| **CrewAI / AutoGen** | 多 Agent | 角色/消息 | 各异 | 各异 | 有 | **中** | 偏应用层；**能力标签与角色**可映射到 Agent 画像 |

### 2.2 洞察（用于定案）

1. **图 + 共享状态 + 检查点** 已成为 Agent 编排的**事实范式**（LangGraph 等公开文档普遍强调）。
2. **步骤级 durable memo**（Inngest `step.run`、Temporal Activity 完成记录）是长任务可靠性的关键，与「LLM 调用昂贵、不可随意重跑」强相关。
3. **声明式 Flow（Kestra）** 解决的是「可版本化、可审、可生成」——与控制面 **模板版本** 目标一致。
4. **单一选型不足以覆盖**：控制面（产品/UI/API）+ 执行运行时（Gateway/Worker）分层后，应 **组合**「图语义 + 持久步骤 + 现有会话工具链」。

### 2.3 与 Claude Code 公开架构的**概念对齐**（非源码拷贝）

[claude-code-sourcemap](https://github.com/ChinaSiro/claude-code-sourcemap) 等公开材料描述的目录能力，建议映射为 OpenClaw **协议与模块**，而非复制实现：

| 概念模块 | 对任务编排的含义 | OpenClaw 落点 |
|----------|------------------|---------------|
| `coordinator/` | 多 Agent 协调、委派、汇合 | **编排引擎**：并行网关、动态路由、子 Agent 委派边 |
| `tools/` | 工具清单、权限、执行 | **步骤类型 `tool_call`**：`allowlist`、审计、与 Gateway 会话对齐 |
| `commands/` | 命令元数据与积压 | **步骤类型 `command`**：RPC 到 Gateway；积压 = **Outbox + 幂等键** |
| `skills/` | 可复用能力包 | **模板片段 + SkillRef**：注入到步骤上下文 |
| `remote/` | 远程会话 | **实例绑定 session_key**；WebSocket 事件驱动步骤推进 |
| `services/`（API/MCP） | 外部集成 | **MCP 注册表** + 步骤级绑定 |

> **版权声明**：Anthropic 对原始软件享有版权；本 PRD 仅借鉴**公开的架构思想**，实现须为自有代码或通过官方 SDK/许可协议允许的方式集成。

---

## 三、需求规格

### 3.1 编排模型

#### FR-O1：静态 DAG（保留并增强）

- 保留现有 **模板 — 步骤定义 — 依赖边**。
- 增强：**节点类型**（见 FR-O3）、**并行网关**显式节点（fork/join）、**条件边**（表达式或 JSONLogic 子集）。

#### FR-O2：动态计划（新增）

- 引入 **`ExecutionPlan`**（一次运行内有效），可由：
  - 人工在 UI 提交；或
  - **Planner 步骤**（Agent 输出结构化 JSON，经 schema 校验后落库）。
- **`Subtask`** 作为 Plan 的子节点，支持：
  - 依赖（DAG）；
  - 状态机与父实例联动；
  - 映射到 **同一套 StepExecutor**，避免两套执行路径。

#### FR-O3：步骤类型（StepKind）

| StepKind | 说明 | 执行面 |
|----------|------|--------|
| `agent_session` | 绑定 Gateway 会话，发送提示/任务 | Gateway |
| `tool_only` | 仅工具调用（无对话回合） | Gateway / Tool Runner |
| `command` | 调用注册命令（RPC），参数校验 JSON Schema | Gateway |
| `planner` | 产出 `ExecutionPlan` 草案 | LLM + 校验器 |
| `human_gate` | 人工审核（已有能力增强为统一节点） | Control Plane |
| `subworkflow` | 嵌套子模板或子 Plan | Orchestrator |
| `wait_event` | 等待外部事件（Webhook/消息） | 事件总线 |

#### FR-O4：检查点与重放

- 每一 **可重试步骤** 持久化：`input_hash`、输出摘要、`status`、`attempt`、`idempotency_key`。
- **策略**：失败后从最近一致检查点恢复；**禁止**默认全量重跑已完成 LLM 步骤（除非显式 `force_rerun`）。

#### FR-O5：并行与同步

- **Fork**：多后继同时就绪；**Join**：all / any / n-of-m（可配置）。
- 与 Agent 能力标签、资源配额结合，防止无界并行。

### 3.2 与 Gateway / Claude 式运行时的契约

#### FR-G1：会话绑定

- `WorkflowInstance` 可选 `primary_session_key`；步骤可覆盖 `session_key`。
- 步骤完成条件：`session` 返回 `terminal` 事件或显式 `complete_signal`（与现有 `sessions.*` RPC 对齐并文档化）。

#### FR-G2：工具与权限上下文

- 每步骤携带 **`ToolContext`**：`tenant_id`、`workflow_id`、`step_id`、`actor`、`allowlist`、`denylist`。
- Gateway 执行前校验；控制面展示**有效工具集快照**（版本化）。

#### FR-G3：命令与积压

- **CommandRegistry**：`name` → JSON Schema + 处理器路由。
- **积压**：使用 **Outbox 表** + 异步 worker，保证与步骤状态机一致；禁止「仅内存队列」。

### 3.3 控制面与 UI

#### FR-U1：双视图

- **设计视图**：静态模板 DAG（增强网关与条件边）。
- **运行视图**：实例上叠加 **Plan/Subtask**、实时状态、关键路径高亮。

#### FR-U2：时间线与审计

- 统一 **Event Log**：步骤状态变更、工具调用引用、审核记录、Gateway 回执 ID。

### 3.4 非功能需求（NFR）

| ID | 类别 | 要求 |
|----|------|------|
| NFR-1 | 可用性 | 编排器无单点：worker 可多副本（至少设计目标） |
| NFR-2 | 性能 | 单实例 500+ Subtask 时列表与图仍可用（分页/懒加载） |
| NFR-3 | 安全 | 工具与命令权限默认拒绝，显式允许；审计不可篡改（追加日志） |
| NFR-4 | 可迁移 | 新旧模板版本共存；实例锁定创建时版本 |
| NFR-5 | **向前兼容** | 破坏性 HTTP 变更走新 API 主版本（如 `/api/v2`），旧版并存至少一个完整 minor 周期 |
| NFR-6 | **契约稳定** | Gateway/执行面 RPC 采用 **payload 可选字段优先**；引入 `runtime_contract_version`（见 §3.5） |
| NFR-7 | **可验证** | 控制面 OpenAPI 与 Gateway 固定用例具备 **Contract Test**（CI 阻断破坏性 JSON 变更） |
| NFR-8 | **数据演进** | Schema 迁移以 **additive 为主**；删列/改语义须多阶段（双写 → 切读 → 清理） |

### 3.5 后续版本兼容与演进策略

> 目的：在引入动态 Plan、外部编排器、Claude 式会话/工具链时，**不因一次大改而锁死未来升级路径**；与 §1.3「双轨/特性开关」一致。

#### （1）分层兼容契约

| 层 | 原则 | 操作要点 |
|----|------|----------|
| **对外 HTTP API** | URL 带主版本（如现有 `/api/v1`）；破坏性变更走 **`/api/v2`** 并文档化 | 旧版本仅修安全与严重缺陷；新能力优先在 v2 或 v1 下 **additive 字段** |
| **Gateway / 执行面 RPC** | 方法名稳定；**请求/响应以可选字段扩展** | 旧客户端忽略未知字段；新能力带显式 capability 协商 |
| **工作流定义** | **模板版本化**（`WorkflowTemplateVersion`）；**实例锁定创建时的 definition 快照** | 编辑模板产生新版本；**运行中实例不随「当前最新模板」自动漂移** |
| **数据库** | 优先 **只增列/只增表** | 破坏性变更走迁移脚本 + 多阶段；与 Phase 回滚策略一致 |

#### （2）编排与运行时版本字段

为避免「同一数据库里多种语义混用却无法区分」：

| 字段（建议落在实例或模板快照上） | 含义 |
|----------------------------------|------|
| **`orchestration_profile`** | 调度语义标签，例如 `static-dag-v1`、`plan-subtask-v2`。新编排能力通过 **新 profile** 引入，调度器按 profile 分支，老实例保持旧 profile。 |
| **`runtime_contract_version`**（或与 Gateway 握手配置等价） | 控制面与 Gateway/Runner 之间的**集成契约版本**（Session、ToolContext、Command RPC 等）。执行面可独立升级，只要实现同一契约或并行兼容版本。 |

二者与 **模板版本 / 实例锁定** 配合：升级 OpenClaw 发行版时，**历史实例**仍携带创建时的 profile + contract，行为可复现。

#### （3）特性开关与渐进发布

- 全局或按租户：`ORCHESTRATION_V3_ENABLED` 等；默认关闭，验证后开启。
- **双执行路径**：新路径成熟前保留旧路径；开关关闭即回滚到旧语义（与 §七 Phase 一致）。
- 新路径稳定后，旧路径标记 **deprecated**，再经至少一个 **minor** 周期移除（见下）。

#### （4）契约测试与 CI

- **控制面**：OpenAPI 或 JSON Schema 作为真相来源；CI 中对比 **破坏性 diff**（或 openapi-diff 类工具）。
- **Gateway**：对 `sessions.*`、`cron.*` 等核心 RPC 维护 **固定请求/响应样例**，与实现仓库同 CI。
- **发布门禁**：契约测试通过后方可发版，避免「暗碎」兼容层。

#### （5）弃用、CHANGELOG 与文档

- 弃用 API/字段：文档标注 `@deprecated` + **CHANGELOG** 条目 + 替代方案。
- 本 PRD、`design/workflow-api-design.md` 在 **数据模型或契约变更**时同步修订 **「兼容性影响」** 一小节。

---

## 四、目标架构（逻辑）

```
                    ┌─────────────────────────────────────┐
                    │     OpenClaw Control Plane          │
                    │  API · RBAC · 模板 · 实例 · 审核     │
                    │  Orchestration Service (新增/强化)   │
                    │  - 静态 DAG 调度                     │
                    │  - ExecutionPlan / Subtask 展开      │
                    │  - Checkpoint · Outbox · 事件        │
                    └───────────────┬─────────────────────┘
                                    │ 契约：步骤指令、上下文、回调
                    ┌───────────────▼─────────────────────┐
                    │  Gateway（及可选 Worker 层）          │
                    │  sessions · tools · commands · MCP    │
                    │  （可与 LangGraph/Temporal 等作为     │
                    │    「执行适配器」并存）               │
                    └─────────────────────────────────────┘
```

**可选执行适配器（实现阶段选型，不在 PRD 强行定栈）：**

- **Adapter-A**：现有 Gateway RPC 为主（最小改动路径）。
- **Adapter-B**：关键路径步骤委托 **Temporal Workflow**（强持久化）。
- **Adapter-C**：Planner/子图用 **LangGraph** 进程服务（Python），经 HTTP 与控制面交互。

---

## 五、数据模型演进（概要）

> 以下为逻辑实体；物理表名可在实现时调整。

| 实体 | 职责 |
|------|------|
| `WorkflowTemplate` / `StepDefinition` | 延续；`StepDefinition` 增加 `kind`、`config_json`、`condition` |
| `WorkflowInstance` | 增加 `plan_id`（可选）、`orchestration_state`；建议增加 **`orchestration_profile`**、**`runtime_contract_version`**（与 §3.5 一致，实现阶段可落库或嵌入快照 JSON） |
| `ExecutionPlan` | 某次运行的动态计划：来源、版本、状态 |
| `Subtask` | Plan 内节点；可映射到执行记录 |
| `StepExecution` | 延续；与 `Subtask` 可 1:1 或合并建模（二选一，实现阶段定） |
| `OrchestrationCheckpoint` | 步骤级快照（输入哈希、输出引用、尝试次数） |
| `CommandDefinition` / `ToolSnapshot` | 注册与版本 |
| `OutboxMessage` | 命令/事件积压 |

**迁移原则**：老实例仅使用静态 DAG；新字段默认可空；**特性开关**控制新编排路径；**实例级 profile/contract** 保证后续 OpenClaw 版本升级时可追溯语义。

---

## 六、API 与事件（概要）

- **REST/JSON**：`ExecutionPlan` CRUD（受权限约束）、`subtasks` 查询、实例 `advance`、`signal`（人工/外部）；新端点优先落在 **`/api/v1`** 下 **additive**，若破坏性变更则规划 **`/api/v2`**（见 §3.5）。
- **WebSocket**：实例级订阅：步骤变更、Plan 更新、Gateway 回执；事件 payload 带 **`schema_version`** 或等价字段，便于前端渐进升级。
- **Webhook（可选）**：`wait_event` 类型步骤完成条件。
- **兼容性**：响应中**未知字段**客户端应忽略；请求中新字段均为可选，除非新 API 主版本另有约定。

（详细路径与 Schema 在 `design/workflow-api-design.md` 后续修订中展开。）

---

## 七、落地方案（分阶段）

### Phase 0：契约与开关（2–3 周）

- 定义 **StepKind**、**ToolContext**、**Idempotency** 规范文档；明确 **`orchestration_profile`**、**`runtime_contract_version`** 的取值集与默认值。
- Gateway 与控制面就 `sessions` / 工具 / 命令 对齐最小闭环。
- 引入 **特性开关**：`ORCHESTRATION_V3_ENABLED`。
- 建立 **Contract Test** 骨架（控制面 OpenAPI 快照 + Gateway 核心 RPC 样例），纳入 CI。

### Phase 1：静态 DAG 增强 + 检查点 MVP（4–6 周）

- 模板侧：并行网关、条件边、步骤类型中的 `agent_session` / `human_gate`。
- 数据：`OrchestrationCheckpoint`；步骤重试策略与 memo 语义。
- UI：运行视图增强（网关、条件边显示）。

### Phase 2：ExecutionPlan + Subtask（6–10 周）

- Planner 步骤 + JSON Schema 校验；Subtask 与调度器集成。
- UI：Plan 树 + 与 DAG 叠加展示。

### Phase 3：命令注册表 + Outbox + wait_event（4–6 周）

- `CommandRegistry`、积压、幂等；外部事件接入。

### Phase 4（可选）：外部编排器适配

- 评估 **Temporal** 或 **LangGraph 微服务** 接入最重路径；**Adapter** 插件化。

每阶段结束需满足：**回滚策略**（开关关闭即回旧路径）、**迁移脚本**、**集成测试清单**。

---

## 八、风险与缓解

| 风险 | 缓解 |
|------|------|
| 范围爆炸 | 严格分阶段；Plan 与静态 DAG 分里程碑交付 |
| 与 Gateway 不同步 | 契约优先；`runtime_contract_version`；Contract Test；版本化 RPC |
| 长期兼容失控 | 严格执行 §3.5；禁止实例依赖「未快照的当前模板」；弃用 API 须经 minor 周期 |
| 第三方代码许可 | 不依赖非官方还原仓库；仅用公开 API/自研 |
| 团队学习曲线 | 先统一术语（Plan/Checkpoint/Outbox）；内部培训一页纸 |

---

## 九、成功指标（KPI）

- 新实例可使用 **至少一种** 动态计划流程且全程可审计。
- 失败步骤 **可恢复** 且不重复计费关键 LLM 调用（在 memo 策略下可验证）。
- P95 编排调度延迟（控制面）< 500ms（不含 LLM）。
- **兼容性**：升级一个 minor 版本后，**仅使用 v1 API 与旧 profile 的实例**在无特性开关变更下行为与升级前一致（回归用例覆盖）。

---

## 十、附录：参考链接

- LangGraph：[https://www.langchain.com/langgraph/](https://www.langchain.com/langgraph/)
- Temporal：[https://temporal.io/](https://temporal.io/)
- Inngest Durable Workflows：[https://www.inngest.com/docs](https://www.inngest.com/docs)
- Kestra Flows：[https://kestra.io/docs/workflow-components/flow](https://kestra.io/docs/workflow-components/flow)
- 既有对比：`docs/research/agent-orchestration-comparison.md`
- Claude Code 非官方结构说明（研究参考）：[https://github.com/ChinaSiro/claude-code-sourcemap](https://github.com/ChinaSiro/claude-code-sourcemap)

---

**文档维护**：评审通过后更新版本号与 `状态`；实现过程中 API/表结构变更需同步 `design/workflow-api-design.md` 与本文件「数据模型」章节；**任何影响 §3.5 的契约变更**须在 CHANGELOG 与 API 文档中显式说明。
