# Claude Code 能力集成方案 — 拓展 OpenClaw Control Plane

> 基于 [claude-code-sourcemap](https://github.com/ChinaSiro/claude-code-sourcemap) (v2.1.88) 源码分析
>
> 日期: 2026-04-02

---

## 一、背景与目标

### 1.1 当前 OpenClaw 能力概览

OpenClaw Control Plane 目前具备：

| 能力域        | 现状                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| 工作流引擎    | ✅ DAG 模板 + 实例化执行                                                        |
| Agent 调度    | ✅ `AgentMatcherService` + `SchedulerService`                                   |
| 状态机        | ✅ `planned → approved → dispatched → in_progress → review_pending → completed` |
| 人工审核      | ✅ ReviewGate 机制                                                              |
| 认证          | ✅ JWT + RBAC                                                                   |
| WebSocket     | ✅ 实时推送                                                                     |
| MCP 扩展      | ⚠️ 基础 extensions API，无动态工具发现                                          |
| 多 Agent 协作 | ⚠️ 单步调度，无协调器模式                                                       |
| 上下文管理    | ❌ 无 token 预算/自动压缩                                                       |
| 会话记忆      | ❌ 无自动记忆提取                                                               |
| 成本追踪      | ⚠️ 基础 usage API，无细粒度模型级追踪                                           |
| 技能系统      | ⚠️ 基础 skills API，无动态注册/执行                                             |
| 插件系统      | ❌ 无                                                                           |
| 代码智能      | ❌ 无 LSP 集成                                                                  |
| 计划模式      | ❌ 无结构化规划                                                                 |
| 验证 Agent    | ❌ 无独立验证环节                                                               |
| 工作树隔离    | ❌ 无                                                                           |

### 1.2 Claude Code 核心能力矩阵

通过源码分析，Claude Code 的核心能力可分为以下模块：

```
claude-code-sourcemap/src/
├── coordinator/     → 多 Agent 协调器模式
├── tools/           → 40+ 内置工具（Agent, Bash, FileEdit, Grep, WebFetch...）
├── skills/          → 技能注册与执行系统
├── services/mcp/    → MCP 完整客户端（连接管理、工具发现、资源读取）
├── services/SessionMemory/ → 会话记忆自动提取
├── services/compact/ → 上下文自动压缩
├── services/lsp/    → LSP 语言服务器集成
├── services/plugins/ → 插件安装与管理
├── services/analytics/ → 细粒度事件追踪
├── services/api/    → 流式 API 调用与重试
├── bridge/          → 远程会话管理
├── hooks/           → 85+ React Hooks（任务管理、权限、调度...）
├── tasks/           → 多类型任务（Shell, Agent, Remote, Dream, Workflow）
├── state/           → 集中式状态管理
├── plugins/         → 内置插件注册
├── query/           → 查询引擎（token 预算、停止钩子）
└── cost-tracker.ts  → 成本追踪
```

---

## 二、集成方案（按优先级排序）

### 🔴 P0 — 核心能力（立即集成）

#### 2.1 多 Agent 协调器模式 (Coordinator Mode)

**Claude Code 源码参考**: `src/coordinator/coordinatorMode.ts`

**当前 OpenClaw 差距**: OpenClaw 的 `SchedulerService` 只做单步调度，没有"协调器 → 多 Worker"的编排模式。

**集成方案**:

```
┌─────────────────────────────────────────────┐
│              Coordinator Agent               │
│  - 接收用户任务                               │
│  - 拆解为子任务                               │
│  - 分配给 Worker Agents                      │
│  - 汇总结果、处理失败重试                      │
│  - 通过 SendMessage 与 Worker 通信            │
└──────────┬──────────┬──────────┬────────────┘
           │          │          │
     ┌─────▼──┐  ┌───▼────┐  ┌─▼──────┐
     │Worker A│  │Worker B│  │Worker C│
     │(研究)   │  │(实现)   │  │(验证)   │
     └────────┘  └────────┘  └────────┘
```

**实现要点**:

- 新增 `backend/app/services/workflow/coordinator_service.py`
- 协调器通过 `SendMessage` 模式与 Worker 通信（非一次性调用）
- Worker 可被"继续"（continue）而非每次重新创建
- 参考 Claude Code 的"Continue vs Spawn Fresh"决策矩阵

**数据模型扩展**:

```python
# 在 workflow 模型中增加
class CoordinatorSession(Base):
    id: str                    # 协调器会话 ID
    template_id: str           # 关联的工作流模板
    status: str                # active/completed/failed
    worker_agents: list        # Worker Agent 列表
    scratchpad_dir: str        # 跨 Worker 共享知识目录

class WorkerAgent(Base):
    id: str                    # Worker ID
    coordinator_id: str        # 所属协调器
    agent_type: str            # worker/verification/explore/plan
    status: str                # pending/running/completed/failed
    context: dict              # Worker 上下文
```

**API 端点**:

```
POST   /api/workflow/coordinator/sessions        # 创建协调器会话
POST   /api/workflow/coordinator/{id}/spawn       # 生成 Worker
POST   /api/workflow/coordinator/{id}/send        # 向 Worker 发送消息
GET    /api/workflow/coordinator/{id}/status      # 获取协调器状态
DELETE /api/workflow/coordinator/{id}             # 终止协调器会话
```

---

#### 2.2 Agent Swarm / Team 系统

**Claude Code 源码参考**: `src/tools/TeamCreateTool/`, `src/tools/TeamDeleteTool/`, `src/tools/SendMessageTool/`, `src/hooks/useSwarmInitialization.ts`

**集成方案**:

Claude Code 的 Swarm 系统允许动态创建 Agent 团队，团队成员之间可以互相通信。这与 OpenClaw 的工作流系统天然互补。

```python
# backend/app/services/workflow/swarm_service.py

class SwarmService:
    def create_team(self, team_name: str, leader_agent_id: str) -> Team:
        """创建 Agent 团队"""

    def add_member(self, team_name: str, agent_id: str, role: str) -> TeamMember:
        """添加团队成员"""

    def send_message(self, from_agent: str, to_agent: str, message: str) -> None:
        """Agent 间消息传递"""

    def remove_team(self, team_name: str) -> None:
        """解散团队"""
```

**与工作流集成**:

- 工作流步骤可以指定"由 Team 执行"而非单个 Agent
- Team 内部的任务分配由 Team Leader（协调器）决定
- 支持 `isolation: "worktree"` 模式，每个 Worker 在独立 Git 分支工作

---

#### 2.3 会话记忆系统 (Session Memory)

**Claude Code 源码参考**: `src/services/SessionMemory/sessionMemory.ts`

**当前 OpenClaw 差距**: 无自动记忆提取，Agent 上下文在会话结束后丢失。

**集成方案**:

Claude Code 的 Session Memory 系统会定期在后台使用 forked subagent 提取对话中的关键信息，保存为 Markdown 文件。

```python
# backend/app/services/memory/session_memory_service.py

class SessionMemoryService:
    """
    自动维护会话记忆文件，定期在后台提取关键信息。

    特性:
    - 基于阈值触发（工具调用次数/消息数量）
    - 后台异步执行，不阻塞主流程
    - 输出为 Markdown 格式，可供后续会话引用
    """

    def extract_memory(self, session_id: str, messages: list) -> str:
        """从对话中提取关键信息"""

    def get_memory(self, session_id: str) -> str:
        """获取会话记忆"""

    def should_update(self, session_id: str) -> bool:
        """检查是否需要更新记忆（基于阈值）"""
```

**与 OpenClaw 集成点**:

- 工作流实例执行时自动维护记忆
- Agent 重新调度时加载历史记忆
- 跨工作流实例共享项目级记忆

---

#### 2.4 上下文窗口管理 (Context Window Management)

**Claude Code 源码参考**: `src/services/compact/`, `src/query/tokenBudget.ts`, `src/services/tokenEstimation.ts`

**当前 OpenClaw 差距**: 无 token 预算管理，无自动压缩。

**集成方案**:

```python
# backend/app/services/context/context_manager.py

class ContextWindowManager:
    """
    管理 Agent 的上下文窗口:
    1. Token 预算分配 - 为不同工具/消息分配 token 预算
    2. 自动压缩 - 当接近上下文窗口限制时自动压缩历史消息
    3. 微压缩 - 仅压缩最不重要的消息
    """

    def estimate_tokens(self, messages: list, model: str) -> int:
        """估算消息的 token 数"""

    def should_compact(self, messages: list, model: str) -> bool:
        """判断是否需要压缩"""

    def compact_messages(self, messages: list, strategy: str = "auto") -> list:
        """压缩消息列表"""

    def allocate_budget(self, total_budget: int, tools: list) -> dict:
        """为工具/消息分配 token 预算"""
```

**关键特性**:

- **Auto-compact**: 当 token 使用超过阈值（如 80%）自动触发
- **Micro-compact**: 仅压缩低价值消息（如工具调用的详细输出）
- **Time-based compaction**: 基于时间的压缩策略

---

### 🟡 P1 — 重要能力（短期集成）

#### 2.5 技能注册与执行系统 (Skills System)

**Claude Code 源码参考**: `src/skills/bundledSkills.ts`, `src/skills/loadSkillsDir.ts`, `src/tools/SkillTool/`

**集成方案**:

Claude Code 的技能系统支持：

- **Bundled Skills**: 内置技能（如 /commit, /review, /verify）
- **Custom Skills**: 用户自定义技能目录
- **MCP Skill Builders**: 从 MCP 工具自动构建技能

```python
# backend/app/services/skills/skill_registry.py

class SkillRegistry:
    """技能注册表"""

    def register_skill(self, skill: SkillDefinition) -> None:
        """注册技能"""

    def get_skill(self, name: str) -> SkillDefinition:
        """获取技能"""

    def list_skills(self, category: str = None) -> list[SkillDefinition]:
        """列出可用技能"""

    def execute_skill(self, name: str, args: str, context: dict) -> list:
        """执行技能，返回 prompt blocks"""

class SkillDefinition:
    name: str
    description: str
    aliases: list[str]
    when_to_use: str
    allowed_tools: list[str]
    model: str | None              # 可指定使用特定模型
    argument_hint: str | None
    hooks: dict | None             # 技能级钩子
    context: str = "inline"        # inline | fork
    agent: str | None              # 关联的 Agent 类型
    files: dict[str, str] | None   # 技能参考文件
```

**与 OpenClaw 集成**:

- 工作流步骤可绑定技能（而非仅绑定 Agent）
- 技能可以跨工作流复用
- 支持技能市场（类似 Claude Code 的 marketplace）

---

#### 2.6 MCP 动态工具发现与集成

**Claude Code 源码参考**: `src/services/mcp/MCPConnectionManager.tsx`, `src/services/mcp/client.ts`

**当前 OpenClaw 差距**: `extensions` API 是静态的，无动态工具发现。

**集成方案**:

```python
# backend/app/services/mcp/mcp_connection_manager.py

class MCPConnectionManager:
    """
    MCP 连接管理器:
    - 动态连接/断开 MCP 服务器
    - 自动发现 MCP 工具
    - 工具权限管理
    - 资源读取
    """

    async def connect_server(self, server_config: MCPServerConfig) -> MCPConnection:
        """连接 MCP 服务器"""

    async def disconnect_server(self, server_name: str) -> None:
        """断开 MCP 服务器"""

    async def discover_tools(self, server_name: str) -> list[ToolDefinition]:
        """发现 MCP 服务器提供的工具"""

    async def execute_tool(self, server_name: str, tool_name: str, params: dict) -> Any:
        """执行 MCP 工具"""

    async def list_resources(self, server_name: str) -> list[Resource]:
        """列出 MCP 资源"""
```

**API 端点**:

```
GET    /api/mcp/servers                    # 列出已连接的 MCP 服务器
POST   /api/mcp/servers                    # 连接新的 MCP 服务器
DELETE /api/mcp/servers/{name}             # 断开 MCP 服务器
GET    /api/mcp/servers/{name}/tools       # 获取服务器提供的工具
POST   /api/mcp/servers/{name}/tools/{id}  # 执行 MCP 工具
GET    /api/mcp/servers/{name}/resources   # 获取 MCP 资源
```

---

#### 2.7 细粒度成本追踪 (Cost Tracking)

**Claude Code 源码参考**: `src/cost-tracker.ts`

**当前 OpenClaw 差距**: `usage` API 只有基础统计，无模型级细粒度追踪。

**集成方案**:

```python
# backend/app/services/cost/cost_tracker.py

class CostTracker:
    """
    细粒度成本追踪:
    - 按模型追踪 token 使用
    - 计算 USD 成本
    - 追踪缓存命中/未命中
    - 追踪 API 调用耗时
    - 追踪代码行数变更
    """

    def track_usage(self, model: str, usage: ModelUsage) -> None:
        """追踪模型使用"""

    def get_session_cost(self, session_id: str) -> CostSummary:
        """获取会话成本"""

    def get_workflow_cost(self, workflow_id: str) -> CostSummary:
        """获取工作流成本"""

    def estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """预估成本"""

class ModelUsage:
    model: str
    input_tokens: int
    output_tokens: int
    cache_creation_tokens: int
    cache_read_tokens: int
    duration_ms: int
    web_search_requests: int = 0
```

---

#### 2.8 计划模式 (Plan Mode)

**Claude Code 源码参考**: `src/tools/EnterPlanModeTool/`, `src/tools/ExitPlanModeTool/`

**集成方案**:

在工作流执行前增加"计划阶段"，Agent 先分析任务、制定计划，用户确认后再执行。

```python
# backend/app/services/workflow/plan_mode.py

class PlanModeService:
    """
    计划模式:
    1. Agent 进入计划模式，只做分析不做修改
    2. 生成执行计划（步骤列表）
    3. 用户审核计划
    4. 确认后退出计划模式，开始执行
    """

    def enter_plan_mode(self, workflow_id: str) -> Plan:
        """进入计划模式"""

    def generate_plan(self, workflow_id: str, context: dict) -> Plan:
        """生成执行计划"""

    def approve_plan(self, plan_id: str) -> None:
        """批准计划"""

    def exit_plan_mode(self, workflow_id: str) -> None:
        """退出计划模式"""
```

**与工作流集成**:

- 在 DAG 模板中增加 `plan_required: true` 选项
- 计划结果作为工作流步骤的输入
- 支持计划的中途修改

---

### 🟢 P2 — 增强能力（中期集成）

#### 2.9 验证 Agent (Verification Agent)

**Claude Code 源码参考**: `src/tools/AgentTool/built-in/verificationAgent.ts`

**集成方案**:

在工作流的关键步骤后自动插入验证环节，由独立的验证 Agent 审查实现质量。

```python
class VerificationService:
    """
    独立验证服务:
    - 验证 Agent 与实现 Agent 完全隔离
    - 验证代码质量、测试覆盖率、边界情况
    - 输出验证报告
    """

    def verify_implementation(self, task_id: str, implementation: dict) -> VerificationReport:
        """验证实现"""

    def verify_tests(self, task_id: str) -> TestReport:
        """验证测试"""
```

---

#### 2.10 插件系统 (Plugin System)

**Claude Code 源码参考**: `src/plugins/builtinPlugins.ts`, `src/services/plugins/`

**集成方案**:

```python
class PluginManager:
    """
    插件管理器:
    - 注册/卸载插件
    - 插件可提供: skills, hooks, MCP servers
    - 内置插件 vs 市场插件
    - 插件启用/禁用
    """

    def register_plugin(self, plugin: PluginDefinition) -> None:
        """注册插件"""

    def install_plugin(self, plugin_id: str) -> None:
        """安装插件"""

    def get_plugin_skills(self, plugin_id: str) -> list[SkillDefinition]:
        """获取插件提供的技能"""
```

---

#### 2.11 LSP 集成 (Language Server Protocol)

**Claude Code 源码参考**: `src/services/lsp/`

**集成方案**:

```python
class LSPService:
    """
    LSP 服务:
    - 管理 LSP 服务器实例
    - 获取诊断信息（错误、警告）
    - 支持代码补全、跳转定义
    - 被动反馈（后台收集诊断）
    """

    async def start_server(self, language: str, project_path: str) -> None:
        """启动 LSP 服务器"""

    async def get_diagnostics(self, file_path: str) -> list[Diagnostic]:
        """获取文件诊断"""
```

---

#### 2.12 工作树隔离 (Worktree Isolation)

**Claude Code 源码参考**: `src/tools/EnterWorktreeTool/`, `src/utils/worktree.ts`

**集成方案**:

为 Agent 执行提供 Git Worktree 隔离，每个 Agent 在独立的代码副本中工作。

```python
class WorktreeService:
    """
    工作树隔离:
    - 为 Agent 创建独立的 Git Worktree
    - Agent 在隔离环境中修改代码
    - 完成后自动合并或清理
    """

    def create_worktree(self, agent_id: str, base_branch: str) -> str:
        """创建工作树"""

    def cleanup_worktree(self, agent_id: str, merge: bool = False) -> None:
        """清理工作树"""
```

---

#### 2.13 Fork Subagent 模式

**Claude Code 源码参考**: `src/tools/AgentTool/forkSubagent.ts`

**集成方案**:

允许 Agent "fork"自身，在共享上下文的情况下并行执行子任务。与完整的 Agent 调度不同，fork 共享父 Agent 的 prompt cache，成本更低。

```python
class ForkSubagentService:
    """
    Fork Subagent:
    - 共享父 Agent 的 prompt cache
    - 适合并行研究、独立实现
    - 完成后通知父 Agent
    - 不允许"偷看" fork 的中间结果
    """

    def fork(self, parent_agent_id: str, task: str, name: str = None) -> str:
        """Fork 子 Agent"""

    def get_fork_result(self, fork_id: str) -> ForkResult:
        """获取 fork 结果（完成后）"""
```

---

#### 2.14 Token 预算与估算

**Claude Code 源码参考**: `src/services/tokenEstimation.ts`, `src/query/tokenBudget.ts`

**集成方案**:

在发送 API 请求前预估 token 数量，避免超出上下文窗口限制。

```python
class TokenBudgetService:
    """
    Token 预算管理:
    - 预估消息 token 数
    - 为工具/系统提示/历史消息分配预算
    - 动态调整预算分配
    """

    def estimate_tokens(self, content: str, model: str) -> int:
        """估算 token 数"""

    def allocate_budget(self, total: int, components: dict) -> dict:
        """分配 token 预算"""
```

---

#### 2.15 定时任务与远程触发 (Cron & Remote Triggers)

**Claude Code 源码参考**: `src/tools/ScheduleCronTool/`, `src/tools/RemoteTriggerTool/`

**集成方案**:

```python
class CronService:
    """
    定时任务:
    - 创建/删除/列出定时任务
    - 支持 cron 表达式
    - 到期自动触发工作流
    """

    def create_cron(self, schedule: str, workflow_id: str, params: dict) -> str:
        """创建定时任务"""

    def delete_cron(self, cron_id: str) -> None:
        """删除定时任务"""

class RemoteTriggerService:
    """
    远程触发:
    - 通过 webhook URL 触发工作流
    - 支持 GitHub webhook、Slack 等
    """

    def create_trigger(self, workflow_id: str, trigger_type: str) -> str:
        """创建远程触发器"""
```

---

## 三、集成架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                    OpenClaw Control Plane v2                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    API Gateway Layer                         │ │
│  │  /api/workflow/*  /api/mcp/*  /api/skills/*  /api/cost/*    │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
│                            │                                      │
│  ┌─────────────────────────▼───────────────────────────────────┐ │
│  │                   Service Layer                              │ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │ │
│  │  │ Coordinator  │  │   Swarm      │  │  Plan Mode   │      │ │
│  │  │ Service      │  │   Service    │  │  Service     │      │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │ │
│  │         │                 │                  │               │ │
│  │  ┌──────▼─────────────────▼──────────────────▼───────┐      │ │
│  │  │              Agent Runtime                         │      │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │      │ │
│  │  │  │ Context  │ │ Session  │ │  Token   │          │      │ │
│  │  │  │ Manager  │ │ Memory   │ │  Budget  │          │      │ │
│  │  │  └──────────┘ └──────────┘ └──────────┘          │      │ │
│  │  └───────────────────────────────────────────────────┘      │ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │ │
│  │  │ MCP          │  │  Skill       │  │  Plugin      │      │ │
│  │  │ Connection   │  │  Registry    │  │  Manager     │      │ │
│  │  │ Manager      │  │              │  │              │      │ │
│  │  └──────┬───────┘  └──────────────┘  └──────────────┘      │ │
│  │         │                                                    │ │
│  │  ┌──────▼───────┐  ┌──────────────┐  ┌──────────────┐      │ │
│  │  │  Cost        │  │ Verification │  │  Cron/       │      │ │
│  │  │  Tracker     │  │ Agent        │  │  Trigger     │      │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                            │                                      │
│  ┌─────────────────────────▼───────────────────────────────────┐ │
│  │                   Data Layer                                 │ │
│  │  SQLite/PostgreSQL + Redis Cache                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 四、实施路线图

### Phase 1 — 基础增强（2-3 周）

| 任务                    | 对应 Claude Code 模块                       | 工作量 |
| ----------------------- | ------------------------------------------- | ------ |
| 2.1 多 Agent 协调器模式 | `coordinator/coordinatorMode.ts`            | 5 天   |
| 2.3 会话记忆系统        | `services/SessionMemory/`                   | 3 天   |
| 2.4 上下文窗口管理      | `services/compact/`, `query/tokenBudget.ts` | 4 天   |
| 2.7 细粒度成本追踪      | `cost-tracker.ts`                           | 2 天   |

### Phase 2 — 能力拓展（3-4 周）

| 任务                 | 对应 Claude Code 模块                                      | 工作量 |
| -------------------- | ---------------------------------------------------------- | ------ |
| 2.2 Agent Swarm/Team | `tools/TeamCreateTool/`, `hooks/useSwarmInitialization.ts` | 5 天   |
| 2.5 技能注册与执行   | `skills/bundledSkills.ts`                                  | 4 天   |
| 2.6 MCP 动态工具发现 | `services/mcp/`                                            | 5 天   |
| 2.8 计划模式         | `tools/EnterPlanModeTool/`                                 | 3 天   |

### Phase 3 — 生态完善（4-6 周）

| 任务                    | 对应 Claude Code 模块                           | 工作量 |
| ----------------------- | ----------------------------------------------- | ------ |
| 2.9 验证 Agent          | `tools/AgentTool/built-in/verificationAgent.ts` | 3 天   |
| 2.10 插件系统           | `plugins/builtinPlugins.ts`                     | 5 天   |
| 2.11 LSP 集成           | `services/lsp/`                                 | 5 天   |
| 2.12 工作树隔离         | `utils/worktree.ts`                             | 3 天   |
| 2.13 Fork Subagent      | `tools/AgentTool/forkSubagent.ts`               | 4 天   |
| 2.14 Token 预算估算     | `services/tokenEstimation.ts`                   | 3 天   |
| 2.15 定时任务与远程触发 | `tools/ScheduleCronTool/`                       | 3 天   |

---

## 五、关键设计原则

### 5.1 从 Claude Code 借鉴的核心设计模式

1. **Coordinator-Worker 模式**: 协调器不直接执行任务，只做任务拆解和结果汇总
2. **Fork vs Spawn 决策**: 高上下文重叠 → Continue；低上下文重叠 → Spawn Fresh
3. **Session Memory 自动提取**: 后台 forked subagent 提取，不阻塞主流程
4. **Auto-compact 策略**: 基于阈值自动触发，支持 micro-compact 和 full-compact
5. **Tool Pool Assembly**: 内置工具 + MCP 工具合并、去重、按权限过滤
6. **Plugin → Skill → Hook 三层扩展**: 插件提供技能，技能可注册钩子

### 5.2 OpenClaw 特有的适配

1. **Web UI 适配**: Claude Code 是 CLI 工具，OpenClaw 是 Web 平台，需要将 CLI 交互模式转换为 API 调用
2. **多用户支持**: Claude Code 是单用户，OpenClaw 需要支持多租户隔离
3. **持久化存储**: Claude Code 的文件系统存储需要转换为数据库存储
4. **工作流集成**: 所有新能力需要与现有的 DAG 工作流引擎无缝集成

---

## 六、风险与注意事项

1. **API 兼容性**: Claude Code 使用 Anthropic API，OpenClaw 可能使用不同的 LLM 后端，需要抽象 API 层
2. **Token 计数准确性**: 不同模型的 token 计数方式不同，估算需要适配
3. **并发控制**: 多 Agent 并发执行时的资源竞争和死锁预防
4. **成本控制**: 多 Agent 协调可能导致 token 消耗指数级增长，需要严格的预算控制
5. **安全性**: Agent 的文件系统访问权限、MCP 工具执行权限需要严格控制

---

## 七、总结

通过集成 Claude Code 的核心能力，OpenClaw Control Plane 将从一个"工作流管理系统"升级为**AI Agent 编排平台**：

| 维度       | 当前     | 集成后                     |
| ---------- | -------- | -------------------------- |
| Agent 协作 | 单步调度 | 协调器 + Swarm + Fork      |
| 上下文管理 | 无       | 自动压缩 + Token 预算      |
| 记忆       | 无       | 会话记忆 + 项目记忆        |
| 工具集成   | 静态     | MCP 动态发现 + 插件        |
| 成本控制   | 基础     | 模型级细粒度追踪           |
| 质量保证   | 人工审核 | 自动验证 Agent             |
| 扩展性     | API 扩展 | 技能 + 插件 + MCP 三层扩展 |
