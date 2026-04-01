# 工作流管理系统需求文档

> **项目**：openclaw-control-plane  
> **版本**：v1.0  
> **日期**：2026-04-01  
> **状态**：需求基线  
> **关联文档**：`rd-team-workflow.md`, `agent-workflow-v2.md`, `ux-review-lifecycle-taskflow.md`

---

## 目录

1. [项目概述](#1-项目概述)
2. [功能清单](#2-功能清单)
3. [非功能需求](#3-非功能需求)
4. [边界条件](#4-边界条件)
5. [异常流](#5-异常流)
6. [工作流模板示例](#6-工作流模板示例)
7. [与现有系统的关系](#7-与现有系统的关系)
8. [前后端接口概要](#8-前后端接口概要)

---

## 1. 项目概述

### 1.1 项目背景

OpenClaw Control Plane 是一个多 Agent 协同管理平台。当前已实现基础的 Agent 生命周期管理、任务分发和看板视图，但在**多 Agent 协同执行复杂研发流水线**方面存在以下痛点：

- **流程黑箱化**：用户无法看到任务在 Agent 之间的流转路径，不知道当前执行到哪一步
- **无法复用流程**：每次都需要手动创建任务，无法保存和复用标准流程
- **控制能力弱**：无法暂停、恢复、重试、跳过单个步骤或整个流程
- **进度不可见**：长时间运行的任务没有进度反馈，用户焦虑等待
- **缺乏审核机制**：关键步骤没有人工审核点，高风险操作无法拦截
- **历史难追溯**：每次执行的产出分散，难以回溯历史结果

### 1.2 目标用户

- **研发负责人**：需要规划和监控整体研发进度
- **产品经理**：需要定义需求→开发→测试→上线的标准流程
- **运维工程师**：需要批量执行部署、监控、巡检任务
- **数据分析师**：需要定期执行数据清洗→分析→报告生成流程

### 1.3 核心价值

| 价值点 | 描述 | 量化指标 |
|--------|------|----------|
| **流程透明化** | 实时可视化展示任务执行路径和状态 | 状态可见性 100% |
| **流程复用** | 一次定义，多次一键启动 | 启动时间减少 80% |
| **精准控制** | 支持暂停/恢复/重试/跳过单步或整体 | 控制粒度：步骤级 |
| **进度感知** | 每步显示进度条和预估剩余时间 | 进度更新频率：1次/秒 |
| **风险可控** | 关键步骤强制人工审核 | 审核覆盖率：100%（关键步骤） |
| **历史可追溯** | 每次执行的产出和日志永久保存 | 保留时长：≥ 90天 |

### 1.4 核心术语

| 术语 | 定义 |
|------|------|
| **工作流模板（Workflow Template）** | 预定义的任务链结构，包含步骤顺序、依赖关系、Agent分配、审核点等 |
| **工作流实例（Workflow Instance）** | 模板的一次具体执行，包含实际状态、进度、日志、产出 |
| **步骤（Step）** | 工作流中的单个任务节点，指定 Agent、输入、输出、验证条件 |
| **DAG（有向无环图）** | 用图形表示步骤之间的依赖关系和执行顺序 |
| **Agent 能力标签** | Agent 的技能标识，如 `backend`, `frontend`, `research`, `dba` |
| **人工审核点** | 执行到该步骤时暂停，等待人工 Approve/Reject/Request Changes |
| **状态机** | 定义步骤/工作流的生命周期状态和流转规则 |

---

## 2. 功能清单

### 2.1 工作流定义与模板管理

#### F01 — 创建工作流模板

- **用户角色**：研发负责人、产品经理
- **前置条件**：无
- **操作步骤**：
  1. 点击【新建工作流模板】
  2. 填写基本信息：名称、描述、适用场景
  3. 添加步骤：
     - 步骤名称
     - 指定 Agent（从 Agent 列表选择）或能力标签（自动匹配）
     - 输入参数（支持引用前序步骤的输出）
     - 预估时长（分钟）
     - 是否需要人工审核
     - 前置步骤（依赖关系）
  4. 配置全局参数：
     - 超时策略（单步超时、整体超时）
     - 重试策略（最大次数、退避算法）
     - 失败处理（终止流程 / 跳过继续 / 转人工）
  5. 保存模板
- **输出**：工作流模板 JSON，包含 DAG 结构
- **验证条件**：
  - DAG 无循环依赖
  - 至少有一个起始节点（无前置依赖）
  - 所有步骤都有 Agent 分配或能力标签
- **异常处理**：循环依赖检测 → 提示错误位置 → 阻止保存

#### F02 — 编辑工作流模板

- **前置条件**：模板存在且未被占用（无活跃实例）
- **操作**：修改模板内容，保存新版本
- **版本管理**：
  - 每次保存生成新版本号（v1.0, v1.1, v2.0）
  - 保留历史版本，支持回滚
  - 标记"已发布"版本，已发布版本不可修改（只能新建版本）

#### F03 — 删除工作流模板

- **前置条件**：模板无活跃实例
- **操作**：软删除（标记 `deleted_at`），保留历史数据
- **权限**：仅创建者或管理员可删除

#### F04 — 复制工作流模板

- **操作**：基于现有模板创建副本，自动命名为"原名称 (副本)"
- **场景**：快速创建类似流程

#### F05 — 导入/导出工作流模板

- **导入**：上传 JSON/YAML 文件，解析并创建模板
- **导出**：下载模板为 JSON/YAML 文件
- **场景**：跨环境迁移、团队共享

#### F06 — 模板搜索与筛选

- **搜索**：按名称、描述、创建者搜索
- **筛选**：按适用场景、标签、状态（已发布/草稿）筛选
- **排序**：按创建时间、使用次数、最后修改时间排序

#### F07 — 模板详情查看

- **内容**：
  - 基本信息面板
  - DAG 图形化展示（React Flow）
  - 步骤列表（表格视图）
  - 使用统计（执行次数、成功率、平均耗时）
  - 历史版本列表
- **操作**：从详情页启动新实例

---

### 2.2 工作流执行引擎

#### F08 — 启动工作流实例

- **前置条件**：模板状态为"已发布"
- **操作步骤**：
  1. 选择模板 → 点击【启动】
  2. 填写输入参数（根据模板定义）
  3. 选择执行模式：
     - **标准模式**：按 DAG 顺序执行
     - **调试模式**：每步暂停，手动确认后继续
  4. 确认启动
- **输出**：
  - 工作流实例 ID
  - 初始状态：`pending`
- **后台流程**：
  1. 创建实例记录
  2. 初始化步骤状态
  3. 触发 DAG 调度器
  4. 匹配 Agent（基于能力标签或指定分配）
  5. 启动第一批无依赖的步骤

#### F09 — DAG 调度器

- **功能**：
  - 解析 DAG 拓扑结构
  - 识别可执行步骤（前置步骤已完成）
  - 并行调度多个独立步骤
  - 处理条件分支（基于前序步骤输出）
- **调度算法**：
  - 拓扑排序 + 并行度控制
  - 最大并行度可配置（默认 5）
- **实时性**：步骤状态变更 → 立即触发调度

#### F10 — Agent 匹配与任务分发

- **匹配逻辑**：
  - 步骤指定 Agent ID → 直接分配
  - 步骤指定能力标签 → 匹配满足标签的 Agent → 按空闲度排序 → 选择最空闲
  - 无满足条件的 Agent → 步骤进入 `waiting_for_agent` 状态
- **负载均衡**：
  - 避免单个 Agent 过载
  - 支持手动干预（重新分配）
- **任务分发**：
  - 通过 OpenClaw Gateway API 调用 Agent
  - 传递步骤输入参数、上下文信息
  - 记录分发时间和 Agent 响应

#### F11 — 步骤执行状态机

- **状态定义**：

| 状态 | 含义 | 可转换状态 |
|------|------|-----------|
| `pending` | 等待前置步骤完成 | `ready` |
| `ready` | 前置完成，等待 Agent | `assigned` |
| `assigned` | Agent 已分配 | `running` |
| `running` | 正在执行 | `completed`, `failed`, `awaiting_review` |
| `awaiting_review` | 等待人工审核 | `approved`, `rejected` |
| `approved` | 审核通过 | `running`（继续下一步） |
| `rejected` | 审核拒绝 | `failed` 或 `retrying` |
| `retrying` | 重试中 | `running`, `failed` |
| `completed` | 执行成功 | — |
| `failed` | 执行失败 | `retrying`, `cancelled` |
| `cancelled` | 已取消 | — |
| `skipped` | 已跳过 | — |

- **状态变更事件**：每次变更记录时间戳、操作者、原因

#### F12 — 重试机制

- **触发条件**：步骤状态为 `failed` 且重试次数 < 最大重试次数
- **重试策略**：
  - **固定间隔**：每次重试间隔固定（如 30s）
  - **指数退避**：间隔按指数增长（1s, 2s, 4s, 8s...）
  - **自定义**：用户配置重试间隔数组
- **重试次数**：可配置（0-10次，默认 3 次）
- **达到最大重试**：标记为 `failed`，根据失败处理策略决定流程后续

#### F13 — 超时控制

- **单步超时**：
  - 每个步骤可配置超时时间（默认 30 分钟）
  - 超时后步骤状态变更为 `failed`
  - 支持动态调整（执行中延长超时）
- **整体超时**：
  - 工作流整体可配置超时时间（默认 24 小时）
  - 超时后所有运行中的步骤强制终止
- **超时通知**：
  - 超时前 5 分钟发送预警通知
  - 超时后发送告警通知

---

### 2.3 执行可视化

#### F14 — DAG 图形展示

- **技术栈**：React Flow
- **展示内容**：
  - 节点：每个步骤一个节点
  - 边：依赖关系（有向箭头）
  - 节点状态颜色：
    - 灰色：`pending`, `ready`
    - 蓝色：`assigned`
    - 绿色（动态）：`running`
    - 琥珀色：`awaiting_review`
    - 绿色（静态）：`completed`
    - 红色：`failed`, `rejected`
    - 灰色（半透明）：`skipped`, `cancelled`
- **交互**：
  - 点击节点：展开步骤详情抽屉
  - 悬停节点：显示简要信息（名称、状态、进度）
  - 缩放/拖拽：查看大型 DAG
  - 高亮路径：从起始到当前节点的路径高亮
- **实时更新**：WebSocket 推送状态变更 → 节点颜色实时变化

#### F15 — 进度条与时间估算

- **整体进度**：
  - 计算公式：`已完成步骤数 / 总步骤数 × 100%`
  - 显示：横向进度条 + 百分比
- **单步进度**：
  - Agent 定期上报进度（0-100%）
  - 显示：圆形进度环 + 百分比
- **时间估算**：
  - **剩余时间** = Σ(未完成步骤的预估时长 × (1 - 当前进度))
  - 显示格式："预计剩余 15 分钟"
  - 动态更新：根据实际执行速度调整预估

#### F16 — 时间线视图

- **展示内容**：
  - 垂直时间线，按时间顺序排列所有事件
  - 事件类型：状态变更、日志输出、审核操作、错误发生
- **交互**：
  - 点击事件：展开详细信息
  - 筛选：按事件类型、步骤、Agent 筛选
  - 时间范围选择：最近 1 小时 / 6 小时 / 24 小时 / 全部

#### F17 — 实时日志流

- **技术**：WebSocket SSE（Server-Sent Events）
- **展示**：
  - 滚动文本框，实时追加日志
  - 日志分级：INFO / WARN / ERROR（颜色区分）
  - 自动滚动到底部（可暂停）
- **操作**：
  - 搜索日志内容
  - 下载完整日志文件
  - 跳转到特定时间点

#### F18 — 思考链路展示

- **内容**：展示 Agent 的推理过程（Reasoning Chain）
- **格式**：折叠面板，可展开查看详细推理
- **场景**：调试 Agent 行为、理解决策过程

---

### 2.4 控制能力

#### F19 — 暂停工作流

- **操作**：点击【暂停】按钮
- **效果**：
  - 所有运行中的步骤完成当前操作后暂停
  - 未开始的步骤保持 `pending` 状态
  - 工作流状态变更为 `paused`
- **恢复**：点击【恢复】继续执行

#### F20 — 恢复工作流

- **前置条件**：工作流状态为 `paused`
- **操作**：点击【恢复】
- **效果**：
  - 恢复所有暂停的步骤
  - DAG 调度器继续调度
  - 工作流状态变更为 `running`

#### F21 — 终止工作流

- **操作**：点击【终止】（需二次确认）
- **效果**：
  - 所有运行中的步骤立即终止
  - 未开始的步骤标记为 `cancelled`
  - 工作流状态变更为 `terminated`
  - **不可恢复**

#### F22 — 重试单步

- **前置条件**：步骤状态为 `failed`
- **操作**：点击步骤详情中的【重试】
- **效果**：
  - 步骤状态变更为 `retrying` → `running`
  - 重置步骤开始时间
  - 保留之前的日志和产出

#### F23 — 跳过单步

- **前置条件**：步骤状态为 `failed` 且步骤标记为"可跳过"
- **操作**：点击【跳过】
- **效果**：
  - 步骤状态变更为 `skipped`
  - 后续依赖该步骤的步骤仍可执行（需配置跳过时的默认输出）

#### F24 — 强制完成单步

- **场景**：步骤卡住无法自动完成，但用户确认实际已完成
- **操作**：点击【强制完成】，填写完成原因
- **效果**：
  - 步骤状态变更为 `completed`
  - 记录强制完成原因和操作者

#### F25 — 重新分配 Agent

- **场景**：原 Agent 故障或负载过高
- **操作**：点击【重新分配】，选择新 Agent
- **效果**：
  - 步骤从原 Agent 迁移到新 Agent
  - 重新执行步骤

---

### 2.5 进度与时间估算

#### F26 — 步骤进度上报

- **机制**：Agent 通过 API 定期上报进度
- **频率**：建议每 5-10 秒上报一次
- **内容**：
  - 进度百分比（0-100）
  - 当前阶段描述（如"正在处理数据"）
  - 已处理数量 / 总数量（可选）
- **存储**：记录在步骤执行日志中

#### F27 — 时间估算模型

- **算法**：
  - **初始估算**：基于模板中的预估时长
  - **动态调整**：根据同模板历史执行的实际时长调整
  - **实时计算**：`剩余时间 = Σ(未完成步骤的调整后预估时长 × (1 - 当前进度))`
- **展示**：
  - 整体剩余时间（如"预计剩余 45 分钟"）
  - 单步预计完成时间（如"预计 10:35 完成"）

#### F28 — 超时预警

- **触发条件**：
  - 单步执行时间 > 预估时长的 80%
  - 整体执行时间 > 整体预估的 80%
- **通知方式**：
  - 页面顶部黄色预警条
  - WebSocket 推送给订阅者
  - （可选）邮件/IM 通知
- **操作**：点击预警条可查看详情并手动延长超时

---

### 2.6 人工审核点

#### F29 — 创建审核点

- **配置**：在步骤定义中设置 `human_review: true`
- **审核点类型**：
  - **强制审核**：必须审核通过才能继续
  - **可选审核**：默认自动通过，用户可手动介入审核
- **审核人**：
  - 指定用户（用户 ID）
  - 指定角色（如"产品经理"）
  - 工作流创建者

#### F30 — 审核界面

- **展示内容**：
  - 前序步骤的产出摘要
  - 当前步骤的关键决策点
  - Agent 的推理过程（可展开）
  - 输出预览（文件、数据、代码等）
- **操作按钮**：
  - **Approve**（通过）：继续执行后续步骤
  - **Reject**（拒绝）：终止流程或回退到指定步骤
  - **Request Changes**（要求修改）：暂停流程，Agent 根据反馈修改
- **评论**：审核人可添加评论，说明通过/拒绝的原因

#### F31 — 审核超时处理

- **超时阈值**：可配置（默认 24 小时）
- **超时动作**：
  - 自动拒绝（默认）
  - 自动通过（高风险，需明确配置）
  - 发送提醒邮件/IM 通知
  - 升级给上级审核人

#### F32 — 审核历史

- **记录**：每次审核的操作、时间、操作者、评论
- **查询**：在工作流详情页查看完整审核历史
- **导出**：支持导出审核报告

---

### 2.7 历史记录与追溯

#### F33 — 工作流实例列表

- **展示**：表格视图，包含：
  - 实例 ID
  - 模板名称
  - 状态
  - 创建时间
  - 完成时间
  - 创建者
  - 操作（查看详情、删除、归档）
- **筛选**：按状态、模板、创建者、时间范围筛选
- **搜索**：按实例 ID、名称搜索

#### F34 — 实例详情查看

- **内容**：
  - 基本信息：ID、模板、状态、时间、创建者
  - DAG 图形（只读，展示最终状态）
  - 步骤执行详情：
    - 每步的状态、开始时间、结束时间、耗时
    - Agent 信息
    - 输入参数
    - 输出产物（文件、数据、日志）
    - 审核记录（如有）
  - 完整日志
  - 时间线视图
- **操作**：
  - 下载产出文件
  - 导出完整报告（PDF/JSON）
  - 复制为新实例（重新执行）

#### F35 — 数据保留策略

- **保留时长**：
  - 运行中的实例：永久保留
  - 成功完成的实例：默认保留 90 天
  - 失败的实例：默认保留 180 天
- **归档**：超过保留时长的实例自动归档（压缩存储）
- **手动删除**：用户可手动删除历史实例

---

### 2.8 Agent 管理

#### F36 — Agent 注册与心跳

- **注册**：Agent 启动时向 Control Plane 注册，声明能力标签
- **心跳**：定期发送心跳（建议 10 秒一次）
- **状态判定**：
  - 最近 30 秒有心跳 → `online`
  - 30-60 秒无心跳 → `degraded`
  - 60 秒以上无心跳 → `offline`

#### F37 — Agent 列表与详情

- **列表**：
  - 显示所有注册的 Agent
  - 状态指示器（绿/黄/红）
  - 当前任务、资源占用
  - 快捷操作（停止、重启、查看日志）
- **详情**：
  - Tab 页：概览 / 任务 / 配置 / 日志 / 监控 / 技能矩阵
  - 概览：健康状态、运行时长、完成任务数
  - 任务：当前任务、历史任务列表
  - 配置：模型、温度、最大 token 等
  - 日志：实时日志流
  - 监控：CPU/内存/响应时间图表
  - 技能矩阵：已安装技能列表，可启用/禁用

#### F38 — Agent 同步

- **操作**：点击【同步】
- **效果**：从 OpenClaw Gateway 拉取最新 Agent 状态和任务信息

#### F39 — Agent 清理

- **操作**：点击【清理】
- **效果**：清理过期的会话和任务数据，释放资源

---

### 2.9 任务管理

#### F40 — 任务看板

- **视图**：看板（按状态分列） / 列表 / 时间线
- **列**：待审批 / 待分派 / 执行中 / 已完成 / 已取消
- **卡片内容**：
  - 任务名称
  - 优先级（🔴高 / 🟡中 / 🟢低）
  - 类型标签
  - 指派 Agent
  - 进度条（执行中任务）
  - 快捷操作按钮

#### F41 — 任务详情

- **抽屉式展开**：
  - 基本信息
  - 状态时间线
  - 执行信息（Agent、实时日志、进度）
  - 思考链路
  - 操作区（根据状态显示可用操作）

#### F42 — 任务状态流转

- **状态机**：planned → approved → dispatched → in_progress → completed / cancelled
- **操作**：
  - 审批通过 / 驳回
  - 分派给 Agent
  - 停止 / 恢复 / 取消
  - 查看结果 / 归档

---

## 3. 非功能需求

### 3.1 性能需求

| 指标 | 要求 | 测量方式 |
|------|------|----------|
| **DAG 渲染** | 100 节点以内 DAG 渲染时间 < 500ms | 首次加载时间 |
| **实时更新延迟** | 状态变更到前端展示延迟 < 1s | WebSocket 推送延迟 |
| **并发工作流** | 支持 100 个工作流并发执行 | 压力测试 |
| **并发步骤** | 单个工作流支持 50 个步骤并发执行 | 验证测试 |
| **日志吞吐** | 单 Agent 日志上报支持 100 条/秒 | 监控指标 |
| **API 响应** | 95% 的 API 请求响应时间 < 200ms | APM 监控 |
| **页面加载** | 首屏加载时间 < 2s（首次） / < 1s（后续） | Lighthouse |

### 3.2 并发需求

- **多用户并发**：支持 50 个用户同时在线操作
- **多工作流并发**：单用户可同时启动多个工作流
- **多 Agent 并发**：单个工作流内多个步骤可并行执行（最大并行度可配置）
- **乐观锁**：防止多人同时修改同一工作流模板或步骤导致冲突
- **悲观锁**：防止多人同时操作同一工作流实例（如暂停/恢复）

### 3.3 安全性需求

#### 认证与授权

- **认证**：复用 OpenClaw 现有认证机制（JWT Token）
- **授权**：
  - 基于角色的访问控制（RBAC）
  - 角色：管理员 / 编辑者 / 查看者
  - 权限矩阵：

| 操作 | 管理员 | 编辑者 | 查看者 |
|------|--------|--------|--------|
| 创建模板 | ✅ | ✅ | ❌ |
| 编辑模板 | ✅ | ✅（自己的） | ❌ |
| 删除模板 | ✅ | ❌ | ❌ |
| 启动工作流 | ✅ | ✅ | ❌ |
| 暂停/恢复/终止 | ✅ | ✅（自己的） | ❌ |
| 审核操作 | ✅ | ✅（指定审核人） | ❌ |
| 查看历史 | ✅ | ✅ | ✅ |

#### 数据安全

- **敏感数据加密**：工作流输入参数中的敏感字段（如密码、密钥）加密存储
- **日志脱敏**：日志输出时自动脱敏敏感信息（如手机号、身份证）
- **审计日志**：所有操作记录审计日志（谁、何时、做了什么）
- **数据备份**：每日自动备份，保留 7 天

#### 网络安全

- **HTTPS**：所有 API 和 WebSocket 强制使用 HTTPS
- **CORS**：配置允许的域名白名单
- **Rate Limiting**：API 限流（100 req/min per user）

### 3.4 兼容性需求

#### 浏览器兼容

- **支持浏览器**：
  - Chrome 90+
  - Firefox 88+
  - Safari 14+
  - Edge 90+
- **不支持**：IE 11 及以下

#### 移动端适配

- **响应式设计**：
  - 桌面端（≥ 1024px）：双栏布局（列表 + 详情面板）
  - 平板端（768-1023px）：单栏布局，抽屉式详情
  - 手机端（< 768px）：简化列表，全屏详情页
- **移动端功能**：
  - 查看：支持查看工作流状态、进度、日志
  - 审核：支持 Approve/Reject 操作
  - 控制：支持暂停/恢复/终止操作
  - 不支持：创建/编辑模板（引导到 PC）

#### 向后兼容

- **API 版本**：RESTful API 支持版本控制（如 `/api/v1/workflows`）
- **数据迁移**：提供旧版数据迁移脚本
- **WebSocket 协议**：保持与现有 OpenClaw Gateway WebSocket 协议兼容

### 3.5 可用性需求

- **SLA**：99.5%（每月停机时间 < 3.6 小时）
- **故障恢复**：单点故障（如 Agent 宕机）不影响其他 Agent 和工作流
- **降级策略**：
  - WebSocket 断开 → 自动降级为轮询（5 秒一次）
  - 图形渲染失败 → 降级为纯文本列表
  - Agent 不可用 → 步骤进入等待队列，不影响其他步骤

### 3.6 可扩展性需求

- **插件化**：支持自定义步骤类型（如调用外部 API、执行脚本）
- **自定义 Agent**：支持用户注册自定义 Agent（通过 API）
- **集成能力**：
  - 提供开放 API，支持第三方系统集成
  - Webhook 支持：工作流状态变更时触发 Webhook
  - 通知集成：支持邮件、企业微信、钉钉等通知渠道

---

## 4. 边界条件

### 4.1 超长工作流

**定义**：步骤数 > 100 或预估总时长 > 24 小时的工作流

**处理策略**：

| 场景 | 处理方式 |
|------|----------|
| **步骤数超限** | 拒绝创建，提示"步骤数超过限制（100），请拆分为多个工作流" |
| **预估时长超限** | 允许创建，但提示"预估时长超过 24 小时，建议设置检查点" |
| **实际执行超长** | 超过整体超时阈值（默认 24h）后强制终止，记录超时原因 |
| **DAG 渲染** | 超过 50 节点时默认折叠部分节点，提供"展开全部"按钮 |

**优化建议**：
- 支持嵌套工作流（子工作流）
- 支持检查点机制（定期保存状态，崩溃后可从检查点恢复）

### 4.2 并发执行

**场景**：同一用户同时启动多个工作流实例

**限制**：
- 单用户并发工作流数：≤ 20
- 全局并发工作流数：≤ 100（可配置）
- 单工作流并发步骤数：≤ 50

**超限处理**：
- 用户并发超限：提示"并发工作流数已达上限，请等待其他工作流完成"
- 全局并发超限：新工作流进入排队队列，等待其他工作流完成

### 4.3 Agent 不可用

**场景**：
- Agent 离线（心跳超时）
- Agent 负载满（无法接收新任务）
- Agent 执行中崩溃

**处理方式**：

| 场景 | 处理逻辑 |
|------|----------|
| **Agent 离线** | 步骤状态 → `waiting_for_agent`，等待 Agent 上线后自动分配 |
| **Agent 负载满** | 步骤进入等待队列，等待 Agent 空闲后分配 |
| **Agent 崩溃** | 步骤状态 → `failed`，触发重试机制 |
| **长时间无 Agent** | 超过 30 分钟无可用 Agent → 发送告警通知 |

**恢复机制**：
- Agent 恢复后自动接收等待中的任务
- 支持手动重新分配到其他 Agent

### 4.4 资源限制

**磁盘空间**：
- 监控磁盘使用率（df -h）
- 使用率 > 80% → 发送预警
- 使用率 > 90% → 自动清理旧日志和归档数据

**内存限制**：
- 单个工作流实例内存占用 < 100MB
- 总内存占用 < 系统可用内存的 50%
- 超限 → 拒绝新工作流启动

**数据库连接**：
- 最大连接数：100
- 连接池配置：最大 50，最小 10

### 4.5 网络异常

**WebSocket 断开**：
- 自动重连（指数退避：1s, 2s, 4s, 8s, 16s, 30s）
- 重连失败 → 降级为 HTTP 轮询（5 秒一次）
- 重新连接成功 → 自动切换回 WebSocket

**API 超时**：
- API 调用超时时间：10 秒
- 超时后重试 1 次
- 仍失败 → 返回错误，前端提示"网络异常，请稍后重试"

**离线模式**：
- 前端支持离线缓存（Service Worker）
- 离线时可查看已缓存的工作流详情
- 离线操作进入队列，上线后自动同步

### 4.6 数据一致性

**并发修改冲突**：
- 使用乐观锁（版本号机制）
- 检测到冲突 → 提示"数据已被他人修改，请刷新页面"
- 支持查看冲突详情和手动合并

**数据库事务**：
- 工作流状态变更、步骤状态变更使用数据库事务
- 保证 ACID 特性

**分布式锁**：
- 关键操作（如启动工作流、终止工作流）使用分布式锁
- 防止多节点并发执行导致数据不一致

---

## 5. 异常流

### 5.1 Agent 超时

**触发条件**：
- 单步执行时间 > 配置的单步超时时间
- Agent 心跳超时（60 秒无心跳）

**处理流程**：

```
检测到超时
    ↓
步骤状态 → failed
    ↓
记录超时原因和日志
    ↓
判断重试次数 < 最大重试次数？
    ├─ 是 → 步骤状态 → retrying → 重新分配 Agent → 执行
    └─ 否 → 根据失败处理策略：
        ├─ 终止流程 → 工作流状态 → terminated
        ├─ 跳过继续 → 步骤状态 → skipped → 调度后续步骤
        └─ 转人工 → 工作流状态 → paused → 发送通知
```

**用户可见信息**：
- 页面顶部红色告警条："步骤 XXX 执行超时"
- 步骤详情中显示超时时间和原因
- 提供"重试"、"跳过"、"终止流程"操作按钮

### 5.2 网络断开

**前端处理**：

```
WebSocket 连接断开
    ↓
显示"连接断开，正在重连..."
    ↓
尝试重连（指数退避）
    ├─ 成功 → 恢复实时更新
    └─ 失败 → 切换到HTTP轮询（5秒一次）
    ↓
轮询期间显示"离线模式（数据可能不是最新）"
    ↓
WebSocket 恢复 → 自动切换回实时模式
```

**后端处理**：
- Agent 与 Control Plane 连接断开 → Agent 状态 → `offline`
- 步骤执行中断 → 步骤状态 → `failed`（等待重连后恢复或重试）

**用户可见信息**：
- 页面顶部黄色提示条："网络连接不稳定，部分数据可能未及时更新"
- 提供手动刷新按钮

### 5.3 数据丢失

**场景**：
- 数据库故障导致数据丢失
- 存储介质故障
- 误删除

**处理流程**：

```
检测到数据丢失
    ↓
立即暂停所有运行中的工作流
    ↓
通知管理员（邮件/IM）
    ↓
从备份恢复数据（每日备份）
    ↓
验证数据完整性
    ├─ 成功 → 恢复工作流执行
    └─ 失败 → 标记受影响的工作流为 `data_lost` → 人工介入
```

**预防措施**：
- 每日自动备份（保留 7 天）
- 关键操作前快照备份
- 数据库主从复制
- 定期灾备演练

**用户可见信息**：
- 受影响工作流标记为"数据异常"
- 提供联系管理员入口

### 5.4 验证失败

**场景**：
- 步骤产出验证失败（如文件不存在、数据格式错误）
- 前置条件不满足（如依赖文件缺失）

**处理流程**：

```
验证失败
    ↓
步骤状态 → failed
    ↓
记录验证失败原因（具体哪个验证条件不满足）
    ↓
Agent 尝试修复（可配置）
    ├─ 修复成功 → 重新验证 → 通过则继续
    └─ 修复失败 → 等待人工介入
    ↓
人工操作：
    ├─ 手动上传缺失文件
    ├─ 修改验证条件
    ├─ 跳过验证（高风险，需管理员权限）
    └─ 终止工作流
```

**用户可见信息**：
- 步骤详情显示验证失败的具体原因
- 提供修复建议（如"文件 xxx 不存在，请上传"）
- 提供"跳过验证"按钮（仅管理员可见）

### 5.5 审核超时

**场景**：
- 审核人长时间未响应（超过配置的超时阈值，默认 24 小时）

**处理流程**：

```
审核超时
    ↓
发送超时提醒（邮件/IM）
    ↓
等待 2 小时
    ├─ 审核人响应 → 正常审核流程
    └─ 仍无响应 → 执行超时动作（可配置）：
        ├─ 自动拒绝（默认） → 工作流状态 → terminated
        ├─ 自动通过（需明确配置） → 继续执行
        ├─ 升级给上级审核人 → 等待新审核人审核
        └─ 转人工 → 工作流状态 → paused → 通知管理员
```

**预防措施**：
- 审核分配时同时通知多个审核人
- 审核超时前 2 小时发送预警
- 支持审核人设置代理人（休假期间自动转派）

**用户可见信息**：
- 审核界面显示倒计时（如"剩余 5 小时"）
- 超时后显示"审核超时，已自动拒绝"

### 5.6 系统错误

**场景**：
- 数据库连接失败
- 外部服务不可用（如 LLM API 故障）
- 程序 Bug 导致崩溃

**处理流程**：

```
检测到系统错误
    ↓
记录错误日志（包含堆栈信息）
    ↓
判断错误级别：
    ├─ 轻微错误（如单个API调用失败）
    │   └─ 重试 → 成功则继续，失败则转人工
    ├─ 严重错误（如数据库连接失败）
    │   └─ 暂停所有工作流 → 发送告警 → 等待修复
    └─ 致命错误（如数据损坏）
        └─ 停止服务 → 从备份恢复 → 人工介入
```

**预防措施**：
- 健康检查接口（每 30 秒检查一次）
- 自动重启机制（进程崩溃后自动重启）
- 熔断器模式（外部服务故障时快速失败）
- 降级开关（紧急情况下关闭非核心功能）

**用户可见信息**：
- 轻微错误：页面顶部提示"部分功能异常，正在修复"
- 严重错误：维护页面，显示"系统维护中，请稍后访问"
- 提供"查看系统状态"链接（跳转到状态页）

---

## 6. 工作流模板示例

### 6.1 研发流水线工作流（基于 20 步主线流程）

**模板名称**：研发流水线 - 需求新增（主线20步）

**适用场景**：标准研发流程，从需求分析到最终交付

**DAG 结构**：

```yaml
name: 研发流水线-需求新增
version: 1.0
description: 20步主线流程，包含需求、设计、开发、审核、测试、交付六个阶段

# 全局配置
config:
  timeout:
    single_step: 1800  # 单步超时30分钟
    workflow: 86400    # 整体超时24小时
  retry:
    max_retries: 3
    backoff: exponential
  failure_strategy: escalate_to_human

# 步骤定义
steps:
  # ===== 阶段一：需求 =====
  - id: step1_requirements
    name: 需求分析
    agent: rd-product-researcher
    estimated_duration: 60
    output: docs/requirements.md
    validation:
      - 四部分完整（功能清单/非功能/边界/异常）
    next: step2_req_validation

  - id: step2_req_validation
    name: 需求分析验证
    agent: rd-commander
    estimated_duration: 10
    input:
      requirements: ${step1_requirements.output}
    validation:
      - 四部分完整
      - 格式正确
    on_failure: return_to_step1

  - id: step3_prd_review
    name: PRD + 需求评审
    agent: rd-product-manager
    estimated_duration: 90
    parallel_agents:
      - rd-pm-checker  # 互审
    output: docs/prd.md
    human_review: true
    reviewers: [rd-commander, rd-lead]
    next: step4_freeze

  - id: step4_freeze
    name: 需求冻结
    agent: rd-commander
    estimated_duration: 15
    output: docs/frozen-requirements.md
    next: step5_design

  # ===== 阶段二：设计 =====
  - id: step5_design
    name: UI + 架构 + 数据库设计
    parallel:
      - id: ui_design
        agent: ui-designer
        checker: ui-checker
        output: docs/ui-design.md
      - id: arch_design
        agent: rd-backend-arch
        output: docs/architecture.md
      - id: db_design
        agent: rd-dba
        checker: dba-checker
        output: docs/schema.sql
    estimated_duration: 120
    depends_on: [step4_freeze]
    next: step6_design_validation

  - id: step6_design_validation
    name: 设计验证
    agent: rd-commander
    estimated_duration: 20
    validation:
      - SQL 可执行（CREATE TABLE + INSERT + SELECT）
      - 目录结构可创建（mkdir -p）
    on_failure: return_to_step5

  # ===== 阶段三：开发 =====
  - id: step7_dev
    name: 并行开发
    parallel:
      - id: backend_dev
        agent: rd-backend-dev
        parallel_with: [backend_dev_02, backend_dev_03]
        output: src/backend/
      - id: frontend_dev
        agent: rd-frontend-dev
        parallel_with: [frontend_dev_02, frontend_dev_03]
        output: src/frontend/
    estimated_duration: 240
    depends_on: [step6_design_validation]
    next: step8_code_validation

  - id: step8_code_validation
    name: 编码验证
    agent: rd-backend-arch
    estimated_duration: 15
    validation:
      - 语法检查（py_compile/lint）
      - 导入检查（import main）
      - 启动检查（健康检查）
    on_failure: return_to_step7

  - id: step9_aggregate
    name: 代码归集
    agent: rd-backend-dev
    estimated_duration: 10
    output: project/[项目名]/
    next: step10_aggregate_validation

  - id: step10_aggregate_validation
    name: 归集验证
    agent: rd-commander
    estimated_duration: 10
    validation:
      - 文件数量合理
      - 核心源码非空
      - 无残留未归集代码
    on_failure: return_to_step9

  # ===== 阶段四：审核 =====
  - id: step11_code_review
    name: 多轮 Code Review（2-4轮）
    agent: rd-commander
    reviewers: [rd-frontend-arch, rd-backend-arch, rd-lead]
    estimated_duration: 120
    min_rounds: 2
    max_rounds: 4
    validation:
      - 每轮覆盖：架构/代码质量/需求符合性
      - 每轮 ≥3 个具体问题
      - 引用文件+行号
    human_review: true
    depends_on: [step10_aggregate_validation]
    next: step12_walkthrough

  - id: step12_walkthrough
    name: 首次走查
    parallel:
      - id: product_walkthrough
        agents: [rd-product-manager, rd-pm-checker]
      - id: ui_walkthrough
        agents: [ui-designer, ui-checker]
    estimated_duration: 60
    validation:
      - 产品逐条核对PRD
      - UI 走查通过
    next: step13_integration

  # ===== 阶段五：联调与测试 =====
  - id: step13_integration
    name: 前后端联调验证
    agent: rd-backend-dev
    estimated_duration: 60
    validation:
      - 页面 ↔ 接口 ↔ 数据流打通
      - 列表加载、筛选、错误态、核心链路
    evidence:
      - 请求/响应记录
      - 页面行为记录
    next: step14_submit_test

  - id: step14_submit_test
    name: 送测 + 自动提交 GitHub
    agent: rd-backend-dev
    estimated_duration: 15
    actions:
      - git add .
      - git commit -m "feat: [项目名]送测版本"
      - git push
    validation:
      - git log 确认提交
      - git diff 确认内容
    next: step15_test_write

  - id: step15_test_write
    name: 测试编写
    parallel:
      - id: func_test
        agent: rd-tester-func
      - id: auto_test
        agent: rd-tester-auto
    estimated_duration: 120
    output: tests/
    validation:
      - import 路径与源码一致
      - 无 pass 占位
      - 每条用例完整（前置+步骤+预期）
    next: step16_test_validation

  - id: step16_test_validation
    name: 测试验证
    agent: rd-tester-auto
    estimated_duration: 30
    actions:
      - pytest --tb=short
    on_failure: return_to_dev_fix
    next: step17_test_loop

  - id: step17_test_loop
    name: 测试循环（3-6轮）
    agent: test-leader
    estimated_duration: 480  # 每轮约2小时
    min_rounds: 3
    max_rounds: 6
    validation:
      - 无 P0/P1 Bug
    loop_until: pass
    on_failure_round6: escalate_to_human

  # ===== 阶段六：交付 =====
  - id: step18_acceptance
    name: 联合验收
    agent: rd-commander
    estimated_duration: 60
    participants: [rd-team, doc-team]
    validation:
      - 产品验收表逐条核对
      - 所有功能通过
    human_review: true
    depends_on: [step17_test_loop]

  - id: step19_deploy
    name: 部署 + 部署验证
    agent: devops
    estimated_duration: 30
    actions:
      - 部署到生产环境
      - curl 健康检查
      - curl 核心接口
    validation:
      - 所有接口返回 200
    on_failure: redeploy

  - id: step20_delivery_check
    name: 交付完整性检查
    agent: rd-commander
    estimated_duration: 15
    checklist:
      - 源码完整
      - pytest 全部通过
      - 文档已归档飞书
      - 部署成功
      - GitHub 已推送
    output: 交付报告
    final: true
```

**预估总时长**：约 20 小时（不含人工审核等待时间）

**人工审核点**：
- Step 3：PRD + 需求评审
- Step 11：Code Review（每轮）
- Step 18：联合验收

---

## 7. 与现有系统的关系

### 7.1 与看板（Kanban）的关系

| 维度 | 看板（Kanban） | 工作流管理系统 | 关系 |
|------|---------------|---------------|------|
| **视角** | 任务视角（任务的状态流转） | 流程视角（步骤的执行过程） | 互补 |
| **粒度** | 粗粒度（一个任务） | 细粒度（一个步骤） | 工作流步骤可对应看板中的一个任务 |
| **状态** | 简单状态（待办/进行中/完成） | 复杂状态机（pending/running/reviewing/...） | 工作流步骤状态可映射到看板任务状态 |
| **可复用性** | 无（每次手动创建任务） | 高（模板一键启动） | 工作流模板可快速生成看板任务 |
| **可视化** | 看板视图（列） | DAG 图 + 进度条 | 工作流 DAG 可在看板中展示为任务卡片 |

**集成方案**：
1. **工作流实例 → 看板任务**：
   - 每个工作流实例在看板中显示为一个任务卡片
   - 卡片标题：`[工作流] 研发流水线-需求新增`
   - 卡片描述：包含工作流模板名称、启动时间、当前步骤
   - 卡片状态：映射工作流整体状态（pending → 待办，running → 进行中，completed → 完成）

2. **步骤状态 → 子任务**：
   - 工作流的每个步骤在看板中显示为子任务
   - 子任务状态同步步骤状态
   - 点击子任务可跳转到工作流详情页

3. **双向同步**：
   - 工作流状态变更 → 自动更新看板任务状态
   - 看板任务操作（如标记完成）→ 触发工作流状态检查

### 7.2 与任务（Tasks）的关系

| 维度 | 任务（Tasks） | 工作流管理系统 | 关系 |
|------|--------------|---------------|------|
| **定义** | 单个独立任务 | 多步骤流程 | 工作流步骤是任务的扩展 |
| **执行者** | 单个 Agent | 多个 Agent 协同 | 工作流协调多个任务 |
| **依赖关系** | 无或简单依赖 | 复杂 DAG 依赖 | 工作流定义任务间的依赖 |
| **产出** | 单个产出 | 多个产出（每步一个） | 工作流聚合多个任务的产出 |
| **复用** | 无 | 模板化 | 工作流模板封装多个任务 |

**集成方案**：
1. **任务 → 工作流步骤**：
   - 每个工作流步骤本质上是一个任务
   - 步骤执行时创建对应的任务记录
   - 任务完成后更新步骤状态

2. **任务详情 → 步骤详情**：
   - 点击工作流步骤 → 跳转到对应任务详情
   - 任务详情中显示所属工作流信息

3. **统一 Agent 分配**：
   - 任务分配 Agent → 工作流步骤复用相同的分配逻辑
   - Agent 负载均衡统一管理

### 7.3 与会话（Sessions）的关系

| 维度 | 会话（Sessions） | 工作流管理系统 | 关系 |
|------|-----------------|---------------|------|
| **生命周期** | 短期（一次性交互） | 长期（多步骤流程） | 工作流包含多个会话 |
| **上下文** | 会话内上下文 | 跨会话上下文（步骤间传递） | 工作流管理上下文传递 |
| **追溯** | 会话日志 | 工作流历史 + 所有会话日志 | 工作流聚合会话日志 |
| **用户交互** | 实时交互 | 人工审核点交互 | 工作流审核复用会话机制 |

**集成方案**：
1. **步骤执行 → 会话创建**：
   - 每个工作流步骤执行时创建一个新的 Agent 会话
   - 会话上下文包含：
     - 步骤输入参数
     - 前序步骤的输出（引用）
     - 工作流全局上下文

2. **会话日志 → 步骤日志**：
   - Agent 会话的日志自动记录到步骤执行日志
   - 工作流详情页可查看每个步骤的完整会话日志

3. **会话产物 → 步骤输出**：
   - Agent 会话的产出文件记录为步骤输出
   - 后续步骤通过引用访问前序步骤的产出

---

## 8. 前后端接口概要

### 8.1 RESTful API 端点列表

#### 工作流模板（Workflow Templates）

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/workflow-templates` | 获取工作流模板列表 | 查看 |
| GET | `/api/v1/workflow-templates/{id}` | 获取单个模板详情 | 查看 |
| POST | `/api/v1/workflow-templates` | 创建工作流模板 | 编辑 |
| PUT | `/api/v1/workflow-templates/{id}` | 更新工作流模板 | 编辑（自己的） |
| DELETE | `/api/v1/workflow-templates/{id}` | 删除工作流模板 | 管理 |
| POST | `/api/v1/workflow-templates/{id}/publish` | 发布模板（标记为已发布） | 编辑 |
| POST | `/api/v1/workflow-templates/{id}/duplicate` | 复制模板 | 编辑 |
| POST | `/api/v1/workflow-templates/import` | 导入模板（JSON/YAML） | 编辑 |
| GET | `/api/v1/workflow-templates/{id}/export` | 导出模板（JSON/YAML） | 查看 |

#### 工作流实例（Workflow Instances）

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/workflows` | 获取工作流实例列表 | 查看 |
| GET | `/api/v1/workflows/{id}` | 获取单个实例详情 | 查看 |
| POST | `/api/v1/workflows` | 启动新工作流实例 | 编辑 |
| POST | `/api/v1/workflows/{id}/pause` | 暂停工作流 | 编辑（自己的） |
| POST | `/api/v1/workflows/{id}/resume` | 恢复工作流 | 编辑（自己的） |
| POST | `/api/v1/workflows/{id}/terminate` | 终止工作流 | 编辑（自己的） |
| DELETE | `/api/v1/workflows/{id}` | 删除工作流实例 | 管理 |
| GET | `/api/v1/workflows/{id}/logs` | 获取工作流日志 | 查看 |
| GET | `/api/v1/workflows/{id}/export` | 导出工作流报告（PDF/JSON） | 查看 |

#### 步骤执行（Step Executions）

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/workflows/{workflow_id}/steps` | 获取工作流所有步骤 | 查看 |
| GET | `/api/v1/workflows/{workflow_id}/steps/{step_id}` | 获取单个步骤详情 | 查看 |
| POST | `/api/v1/workflows/{workflow_id}/steps/{step_id}/retry` | 重试步骤 | 编辑（自己的） |
| POST | `/api/v1/workflows/{workflow_id}/steps/{step_id}/skip` | 跳过步骤 | 编辑（自己的） |
| POST | `/api/v1/workflows/{workflow_id}/steps/{step_id}/force-complete` | 强制完成步骤 | 管理 |
| POST | `/api/v1/workflows/{workflow_id}/steps/{step_id}/reassign` | 重新分配 Agent | 编辑（自己的） |
| POST | `/api/v1/workflows/{workflow_id}/steps/{step_id}/progress` | Agent 上报进度 | Agent |
| GET | `/api/v1/workflows/{workflow_id}/steps/{step_id}/logs` | 获取步骤日志 | 查看 |
| GET | `/api/v1/workflows/{workflow_id}/steps/{step_id}/output` | 获取步骤输出 | 查看 |

#### 人工审核（Human Reviews）

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/reviews/pending` | 获取待审核列表（当前用户） | 审核 |
| GET | `/api/v1/reviews/{id}` | 获取审核详情 | 审核 |
| POST | `/api/v1/reviews/{id}/approve` | 通过审核 | 审核（指定审核人） |
| POST | `/api/v1/reviews/{id}/reject` | 拒绝审核 | 审核（指定审核人） |
| POST | `/api/v1/reviews/{id}/request-changes` | 要求修改 | 审核（指定审核人） |
| GET | `/api/v1/workflows/{workflow_id}/reviews` | 获取工作流所有审核记录 | 查看 |

#### Agent 管理

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/agents` | 获取 Agent 列表 | 查看 |
| GET | `/api/v1/agents/{id}` | 获取 Agent 详情 | 查看 |
| POST | `/api/v1/agents/{id}/sync` | 同步 Agent 状态 | 编辑 |
| POST | `/api/v1/agents/{id}/cleanup` | 清理 Agent 数据 | 编辑 |
| POST | `/api/v1/agents/{id}/stop` | 停止 Agent | 管理 |
| POST | `/api/v1/agents/{id}/restart` | 重启 Agent | 管理 |
| POST | `/api/v1/agents/batch-sync` | 批量同步 | 编辑 |
| POST | `/api/v1/agents/batch-cleanup` | 批量清理 | 编辑 |

#### 任务管理

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/tasks` | 获取任务列表 | 查看 |
| GET | `/api/v1/tasks/{id}` | 获取任务详情 | 查看 |
| POST | `/api/v1/tasks` | 创建任务 | 编辑 |
| POST | `/api/v1/tasks/{id}/approve` | 审批通过任务 | 审核 |
| POST | `/api/v1/tasks/{id}/reject` | 驳回任务 | 审核 |
| POST | `/api/v1/tasks/{id}/dispatch` | 分派任务给 Agent | 编辑 |
| POST | `/api/v1/tasks/{id}/stop` | 停止任务 | 编辑（自己的） |
| POST | `/api/v1/tasks/{id}/resume` | 恢复任务 | 编辑（自己的） |
| POST | `/api/v1/tasks/{id}/cancel` | 取消任务 | 编辑（自己的） |

#### 统计与监控

| 方法 | 端点 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/stats/workflows` | 工作流统计（总数、成功率、平均耗时） | 查看 |
| GET | `/api/v1/stats/agents` | Agent 统计（在线数、任务数、负载） | 查看 |
| GET | `/api/v1/stats/tasks` | 任务统计（待审批、进行中、完成） | 查看 |
| GET | `/api/v1/health` | 健康检查接口 | 公开 |

### 8.2 WebSocket 事件

#### 连接端点
```
ws://[host]/api/v1/ws
```

#### 认证
连接时在 URL 中携带 JWT Token：
```
ws://[host]/api/v1/ws?token=[jwt_token]
```

#### 订阅频道

| 频道 | 说明 | 事件类型 |
|------|------|----------|
| `workflows` | 所有工作流状态变更 | `workflow.created`, `workflow.updated`, `workflow.deleted` |
| `workflow.{id}` | 单个工作流状态变更 | `workflow.started`, `workflow.paused`, `workflow.resumed`, `workflow.completed`, `workflow.failed` |
| `workflow.{id}.steps` | 工作流步骤状态变更 | `step.started`, `step.progress`, `step.completed`, `step.failed`, `step.awaiting_review` |
| `agent.{id}` | Agent 状态变更 | `agent.online`, `agent.offline`, `agent.task_assigned`, `agent.task_completed` |
| `reviews` | 当前用户待审核任务 | `review.created`, `review.approved`, `review.rejected` |

#### 事件格式

```json
{
  "event": "step.progress",
  "timestamp": "2026-04-01T10:35:12Z",
  "data": {
    "workflow_id": "wf-12345",
    "step_id": "step-67890",
    "progress": 65,
    "message": "正在处理数据",
    "estimated_remaining": 300
  }
}
```

### 8.3 数据模型

#### WorkflowTemplate（工作流模板）

```typescript
interface WorkflowTemplate {
  id: string;                    // UUID
  name: string;                  // 模板名称
  description: string;           // 描述
  version: string;               // 版本号（如 v1.0）
  status: 'draft' | 'published' | 'archived';
  dag: DAGDefinition;            // DAG 结构
  config: WorkflowConfig;        // 全局配置
  created_at: Date;
  created_by: string;            // 用户 ID
  updated_at: Date;
  published_at?: Date;
  usage_count: number;           // 使用次数
  tags: string[];                // 标签
}

interface DAGDefinition {
  steps: StepDefinition[];
  edges: EdgeDefinition[];       // 依赖关系
}

interface StepDefinition {
  id: string;
  name: string;
  agent?: string;                // 指定 Agent ID
  capabilities?: string[];       // 能力标签（自动匹配）
  estimated_duration: number;    // 预估时长（分钟）
  input?: any;                   // 输入参数
  output?: string;               // 输出文件路径
  validation?: string[];         // 验证条件
  human_review?: boolean;        // 是否需要人工审核
  reviewers?: string[];          // 审核人列表
  retry_policy?: RetryPolicy;    // 重试策略
  timeout?: number;              // 单步超时（秒）
  depends_on?: string[];         // 前置步骤 ID
  parallel_with?: string[];      // 并行步骤 ID
}

interface WorkflowConfig {
  timeout: {
    single_step: number;         // 单步超时（秒）
    workflow: number;            // 整体超时（秒）
  };
  retry: {
    max_retries: number;
    backoff: 'fixed' | 'exponential';
  };
  failure_strategy: 'terminate' | 'skip' | 'escalate_to_human';
}
```

#### WorkflowInstance（工作流实例）

```typescript
interface WorkflowInstance {
  id: string;                    // UUID
  template_id: string;           // 模板 ID
  template_version: string;      // 使用的模板版本
  status: WorkflowStatus;
  input: any;                    // 输入参数
  output?: any;                  // 最终输出
  progress: number;              // 整体进度（0-100）
  estimated_remaining?: number;  // 预估剩余时间（秒）
  created_at: Date;
  created_by: string;
  started_at?: Date;
  completed_at?: Date;
  duration?: number;             // 实际耗时（秒）
  steps: StepExecution[];        // 步骤执行记录
}

type WorkflowStatus = 
  | 'pending' 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'terminated';

interface StepExecution {
  id: string;
  step_id: string;               // 对应模板中的步骤 ID
  name: string;
  status: StepStatus;
  agent_id?: string;             // 执行的 Agent ID
  input?: any;
  output?: any;
  progress: number;              // 步骤进度（0-100）
  started_at?: Date;
  completed_at?: Date;
  duration?: number;
  retry_count: number;
  logs: LogEntry[];
  review?: ReviewRecord;
}

type StepStatus =
  | 'pending'
  | 'ready'
  | 'assigned'
  | 'running'
  | 'awaiting_review'
  | 'approved'
  | 'rejected'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

interface LogEntry {
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  metadata?: any;
}

interface ReviewRecord {
  id: string;
  reviewer: string;
  action: 'approved' | 'rejected' | 'request_changes';
  comment?: string;
  timestamp: Date;
}
```

---

## 附录

### A. 术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| 工作流模板 | Workflow Template | 预定义的任务链结构 |
| 工作流实例 | Workflow Instance | 模板的一次具体执行 |
| 步骤 | Step | 工作流中的单个任务节点 |
| DAG | Directed Acyclic Graph | 有向无环图，表示步骤依赖关系 |
| 人工审核点 | Human Review Point | 需要人工确认的步骤 |
| Agent 能力标签 | Agent Capability Tag | Agent 的技能标识 |
| 状态机 | State Machine | 定义状态和流转规则 |
| 拓扑排序 | Topological Sort | DAG 的执行顺序算法 |
| 乐观锁 | Optimistic Lock | 基于版本号的并发控制 |
| 悲观锁 | Pessimistic Lock | 基于锁定的并发控制 |
| 熔断器 | Circuit Breaker | 故障快速失败机制 |
| 降级 | Degradation | 功能降级以保证核心功能 |

### B. 参考资料

1. **已有文档**：
   - `/root/.openclaw/workspace/docs/rd-team-workflow.md` — 20 步研发流水线定义
   - `/root/.openclaw/workspace/project/openclaw-control-plane/docs/requirements/agent-workflow-v2.md` — v2 技术需求草稿
   - `/root/.openclaw/workspace/project/openclaw-control-plane/docs/design/ux-review-lifecycle-taskflow.md` — UX 设计评审

2. **竞品参考**：
   - LangGraph Studio：DAG 可视化和调试
   - n8n：工作流自动化平台
   - GitHub Actions：CI/CD 流水线可视化
   - Jira：看板和任务管理
   - Linear：简洁的任务管理

3. **技术文档**：
   - React Flow：https://reactflow.dev/
   - FastAPI：https://fastapi.tiangolo.com/
   - SQLAlchemy：https://www.sqlalchemy.org/
   - WebSocket：https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

---

**文档版本历史**：

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-04-01 | rd-product-researcher | 初始版本 |

---

_需求文档完成_