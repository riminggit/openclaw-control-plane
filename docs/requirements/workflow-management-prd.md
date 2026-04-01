# OpenClaw Control Plane — 工作流管理系统 PRD

> **项目**：openclaw-control-plane  
> **模块**：工作流管理系统（Workflow Management System）  
> **版本**：v1.0  
> **日期**：2026-04-01  
> **作者**：rd-product-manager  
> **状态**：产品需求文档  

---

## 目录

1. [产品定位与用户画像](#1-产品定位与用户画像)
2. [信息架构](#2-信息架构)
3. [页面原型描述](#3-页面原型描述)
4. [核心交互流程](#4-核心交互流程)
5. [DAG 可视化规范](#5-dag-可视化规范)
6. [审核节点交互](#6-审核节点交互)
7. [数据模型概要](#7-数据模型概要)
8. [API 端点清单](#8-api-端点清单)
9. [优先级排序](#9-优先级排序)
10. [与现有页面的集成点](#10-与现有页面的集成点)

---

## 1. 产品定位与用户画像

### 1.1 产品定位

**OpenClaw Control Plane 工作流管理系统** 是面向研发团队的**流程编排与执行监控平台**，解决多 Agent 协同执行复杂研发流水线的痛点，实现：

- **流程透明化**：实时可视化展示任务执行路径和状态
- **流程复用**：一次定义，多次一键启动
- **精准控制**：支持暂停/恢复/重试/跳过单步或整体
- **风险可控**：关键步骤强制人工审核
- **历史可追溯**：每次执行的产出和日志永久保存

### 1.2 用户画像

#### 画像一：研发负责人（rd-commander）

| 维度 | 描述 |
|------|------|
| **角色** | 研发团队总指挥，负责统筹项目进度 |
| **目标** | 监控整体研发进度，把控关键节点质量 |
| **痛点** | 无法看到任务在 Agent 之间的流转路径；无法复用标准流程 |
| **核心场景** | 创建工作流模板 → 启动工作流 → 监控执行 → 处理异常 → 审核关键节点 |
| **使用频率** | 每日 3-5 次 |

#### 画像二：产品经理（rd-product-manager）

| 维度 | 描述 |
|------|------|
| **角色** | 负责定义产品需求和验收标准 |
| **目标** | 确保需求到交付的流程标准化、可追溯 |
| **痛点** | 每次手动创建任务，无法保存和复用标准流程 |
| **核心场景** | 定义需求→开发→测试→上线的标准流程模板 → 启动实例 → 需求评审节点审核 |
| **使用频率** | 每周 5-10 次 |

#### 画像三：运维工程师（devops）

| 维度 | 描述 |
|------|------|
| **角色** | 负责环境搭建、部署、监控巡检 |
| **目标** | 批量执行部署、监控、巡检任务 |
| **痛点** | 长时间运行的任务没有进度反馈；缺乏自动化巡检流程 |
| **核心场景** | 创建部署工作流 → 监控执行进度 → 处理部署异常 |
| **使用频率** | 每周 2-3 次 |

#### 画像四：测试工程师（rd-tester-func）

| 维度 | 描述 |
|------|------|
| **角色** | 负责功能测试和 Bug 验证 |
| **目标** | 跟踪测试循环进度，验证 Bug 修复 |
| **痛点** | 测试轮次多，进度难以追踪；与开发协作信息不透明 |
| **核心场景** | 查看工作流执行状态 → 验证测试节点产出 → 提交审核 |
| **使用频率** | 每日 5-10 次 |

### 1.3 核心价值主张

| 价值点 | 描述 | 量化指标 |
|--------|------|----------|
| **流程透明化** | 实时可视化展示任务执行路径和状态 | 状态可见性 100% |
| **流程复用** | 一次定义，多次一键启动 | 启动时间减少 80% |
| **精准控制** | 支持暂停/恢复/重试/跳过单步或整体 | 控制粒度：步骤级 |
| **进度感知** | 每步显示进度条和预估剩余时间 | 进度更新频率：1次/秒 |
| **风险可控** | 关键步骤强制人工审核 | 审核覆盖率：100%（关键步骤） |
| **历史可追溯** | 每次执行的产出和日志永久保存 | 保留时长：≥ 90天 |

---

## 2. 信息架构

### 2.1 新增页面

工作流管理系统作为独立模块，在现有导航中新增一级菜单：

```
OpenClaw Control Plane
├── Dashboard（现有）
├── Projects（现有）
├── Tasks（现有）
├── Kanban（现有）
├── Sessions（现有）
├── Cron（现有）
├── Analytics（现有）
├── Agents（现有）
├── Workflows（🆕 新增）
│   ├── 模板管理（Workflow Templates）
│   ├── 实例列表（Workflow Instances）
│   └── 审核中心（Review Center）
├── Settings（现有）
└── Help（现有）
```

### 2.2 页面结构

#### 2.2.1 模板管理页面（Workflow Templates）

```
/ workflows / templates
├── 顶部操作栏
│   ├── 搜索框（按名称/描述搜索）
│   ├── 筛选器（状态：草稿/已发布/已归档 | 标签 | 创建者）
│   └── 【+ 新建模板】按钮
├── 模板列表（卡片视图 / 列表视图切换）
│   ├── 模板卡片
│   │   ├── 模板名称 + 版本号
│   │   ├── 描述
│   │   ├── 状态徽章（草稿/已发布/已归档）
│   │   ├── 使用统计（执行次数 / 成功率 / 平均耗时）
│   │   └── 操作按钮（查看 / 编辑 / 复制 / 删除）
│   └── ...
└── 分页控件
```

#### 2.2.2 模板详情页（Template Detail）

```
/ workflows / templates / :id
├── 页头
│   ├── 模板名称 + 版本号
│   ├── 状态徽章
│   └── 操作按钮（编辑 / 发布 / 复制 / 导出 / 删除）
├── Tab 导航
│   ├── 概览（Overview）
│   ├── DAG 图（DAG View）
│   ├── 步骤列表（Steps）
│   ├── 配置（Config）
│   └── 历史版本（Versions）
└── 内容区（根据 Tab 切换）
```

#### 2.2.3 实例列表页（Workflow Instances）

```
/ workflows / instances
├── 顶部操作栏
│   ├── 搜索框（按实例 ID / 模板名称搜索）
│   ├── 筛选器（状态 | 模板 | 创建者 | 时间范围）
│   └── 视图切换（列表 / 卡片）
├── 实例列表
│   ├── 实例行
│   │   ├── 实例 ID
│   │   ├── 模板名称
│   │   ├── 状态徽章
│   │   ├── 进度条
│   │   ├── 创建时间
│   │   ├── 预估剩余时间
│   │   └── 操作按钮（查看详情 / 暂停 / 恢复 / 终止）
│   └── ...
└── 分页控件
```

#### 2.2.4 实例详情页（Instance Detail）

```
/ workflows / instances / :id
├── 页头
│   ├── 实例 ID + 模板名称
│   ├── 状态徽章
│   ├── 整体进度条 + 预估剩余时间
│   └── 操作按钮（暂停 / 恢复 / 终止 / 导出报告）
├── Tab 导航
│   ├── DAG 图（实时状态）
│   ├── 步骤列表（Steps）
│   ├── 时间线（Timeline）
│   ├── 日志（Logs）
│   └── 产出（Outputs）
└── 内容区（根据 Tab 切换）
```

#### 2.2.5 审核中心页（Review Center）

```
/ workflows / reviews
├── 顶部统计
│   ├── 待审核数量
│   ├── 今日已审核
│   └── 超时预警
├── Tab 导航
│   ├── 待我审核（Pending）
│   ├── 已审核（Completed）
│   └── 全部审核（All）
└── 审核列表
    ├── 审核卡片
    │   ├── 工作流名称
    │   ├── 步骤名称
    │   ├── 请求时间
    │   ├── 剩余时间（超时倒计时）
    │   └── 操作按钮（查看 / 审核）
    └── ...
```

#### 2.2.6 审核详情弹窗（Review Detail Modal）

```
[弹窗]
├── 头部
│   ├── 步骤名称
│   └── 关闭按钮
├── 内容区
│   ├── Tab 1：产出摘要
│   │   ├── 前序步骤产出列表
│   │   └── 关键决策点摘要
│   ├── Tab 2：推理过程
│   │   └── Agent 思考链路（可折叠）
│   └── Tab 3：输出预览
│       ├── 文件列表（可下载）
│       └── 数据预览（表格/JSON）
├── 评论输入框
└── 底部操作栏
    ├── 【Approve】按钮（绿色）
    ├── 【Reject】按钮（红色）
    └── 【Request Changes】按钮（黄色）
```

### 2.3 修改页面

#### 2.3.1 Dashboard 页面增强

在现有 Dashboard 增加工作流相关卡片：

```
Dashboard
├── 现有卡片（Projects / Tasks / Sessions 等）
├── 🆕 工作流卡片
│   ├── 运行中的工作流数量
│   ├── 待审核数量
│   └── 快捷入口（查看工作流 / 待审核）
└── 🆕 最近工作流活动（Recent Workflow Activity）
    └── 列表：最近 5 个工作流实例的状态变更
```

#### 2.3.2 Kanban 页面增强

在现有看板中增加工作流任务视图：

```
Kanban
├── 现有任务卡片
├── 🆕 工作流任务卡片（特殊样式）
│   ├── 标题：[工作流] 研发流水线-需求新增
│   ├── 状态徽章
│   ├── 整体进度条
│   ├── 当前步骤指示
│   └── 点击跳转到工作流详情
└── 🆕 筛选器：显示/隐藏工作流任务
```

---

## 3. 页面原型描述

### 3.1 模板管理页面

#### 3.1.1 页面布局

**整体布局**：顶部操作栏 + 主内容区（卡片网格 / 列表）

**顶部操作栏**（高度 64px）：
- 左侧：页面标题"工作流模板"（24px 字号）
- 中间：搜索框（宽度 300px）+ 状态筛选下拉框 + 标签筛选多选框
- 右侧：【+ 新建模板】主按钮（蓝色）+ 视图切换图标（卡片/列表）

**主内容区**（卡片视图）：
- 3 列网格布局（间距 24px）
- 每个卡片固定高度 280px，包含：
  - 顶部：状态徽章（右上角）+ 模板名称（左上角，18px 加粗）
  - 中部：描述（2 行截断，灰色）
  - 中下部：标签列表（Tag 组件，最多显示 3 个）
  - 底部：使用统计（图标 + 数字：执行次数 / 成功率 / 平均耗时）
  - 悬停显示：操作按钮（查看 / 编辑 / 复制 / 删除）

#### 3.1.2 交互流程

**新建模板流程**：

```
点击【+ 新建模板】
    ↓
打开模板编辑器页面（全屏）
    ↓
填写基本信息（名称 / 描述 / 标签）
    ↓
添加步骤（点击【+ 添加步骤】）
    ↓
配置步骤属性（名称 / Agent / 输入 / 输出 / 审核 / 依赖）
    ↓
保存步骤 → 步骤出现在左侧步骤列表
    ↓
在右侧 DAG 画布中拖拽连线建立依赖
    ↓
配置全局参数（超时 / 重试 / 失败策略）
    ↓
点击【保存草稿】→ 返回模板列表
```

**查看模板详情流程**：

```
点击模板卡片或【查看】按钮
    ↓
进入模板详情页（默认 Tab：概览）
    ↓
切换 Tab 查看 DAG 图 / 步骤列表 / 配置 / 历史版本
    ↓
点击【启动工作流】按钮
    ↓
打开参数填写弹窗 → 确认启动
```

### 3.2 模板详情页 - DAG 编辑器

#### 3.2.1 页面布局

**整体布局**：左侧步骤面板 + 中间 DAG 画布 + 右侧属性面板

**左侧步骤面板**（宽度 280px）：
- 顶部：搜索框 + 【+ 添加步骤】按钮
- 中部：步骤列表（可折叠分组）
  - 每个步骤项：步骤名称 + 状态图标 + 拖拽手柄
- 底部：步骤统计（总数 / 已配置 / 未配置）

**中间 DAG 画布**（自适应宽度）：
- 顶部工具栏：缩放控制（放大/缩小/适应屏幕）+ 对齐工具 + 撤销/重做
- 画布区域：React Flow 渲染 DAG 图
  - 节点可拖拽移动
  - 节点间可拖拽连线
  - 点击节点选中，显示选中边框
- 右键菜单：删除节点 / 复制节点 / 编辑节点 / 添加依赖

**右侧属性面板**（宽度 320px，默认隐藏，选中节点时显示）：
- 顶部：步骤名称（可编辑）+ 删除按钮
- Tab 导航：基本信息 / 输入输出 / 审核配置 / 高级配置
- 内容区：根据 Tab 显示对应配置表单

#### 3.2.2 交互细节

**添加步骤**：
- 输入：点击【+ 添加步骤】
- 处理：打开步骤配置弹窗（名称 / Agent 选择 / 输入参数 / 依赖关系）
- 输出：步骤节点出现在 DAG 画布 + 左侧步骤列表
- 异常：步骤名称重复 → 提示"步骤名称已存在，请修改"

**建立依赖**：
- 输入：从节点 A 的输出端口拖拽到节点 B 的输入端口
- 处理：检测是否形成循环依赖 → 无循环则创建边 → 有循环则拒绝并提示
- 输出：有向边连接两个节点，箭头指向 B
- 异常：循环依赖 → 弹窗提示"检测到循环依赖：A → B → C → A，请调整"

**删除节点**：
- 输入：选中节点 → 按 Delete 键或右键选择【删除】
- 处理：确认弹窗（"删除步骤将同时删除相关依赖连线，是否继续？"）
- 输出：节点和关联边从画布消失
- 异常：无（删除操作可撤销）

### 3.3 实例列表页

#### 3.3.1 页面布局

**整体布局**：顶部操作栏 + 筛选栏 + 实例表格

**顶部操作栏**：
- 左侧：页面标题"工作流实例"
- 右侧：视图切换（列表/卡片）+ 刷新按钮

**筛选栏**（高度 48px）：
- 状态筛选：下拉多选（pending / running / paused / completed / failed / terminated）
- 模板筛选：下拉单选（所有模板 / 具体模板名）
- 创建者筛选：下拉单选（所有人 / 我 / 具体用户）
- 时间范围：日期范围选择器
- 重置筛选按钮

**实例表格**（列定义）：
- 列 1：实例 ID（可点击跳转详情）
- 列 2：模板名称
- 列 3：状态（徽章样式）
- 列 4：进度（进度条 + 百分比）
- 列 5：当前步骤（显示当前执行的步骤名称）
- 列 6：创建时间
- 列 7：预估剩余时间（"--" 表示未开始或已结束）
- 列 8：操作（查看详情 / 暂停 / 恢复 / 终止 / 删除）

#### 3.3.2 交互细节

**启动新工作流**：
- 输入：从模板详情页点击【启动工作流】或在实例列表页点击【+ 启动工作流】
- 处理：弹出参数填写弹窗（根据模板定义的参数动态生成表单）
- 输出：创建工作流实例，跳转到实例详情页
- 异常：参数校验失败 → 弹窗提示具体字段错误

**暂停工作流**：
- 输入：点击【暂停】按钮
- 处理：二次确认弹窗（"确认暂停工作流？运行中的步骤将完成当前操作后暂停"）
- 输出：工作流状态变为 `paused`，所有运行中步骤完成当前操作后暂停
- 异常：工作流已暂停 → 按钮置灰不可点击

**终止工作流**：
- 输入：点击【终止】按钮
- 处理：二次确认弹窗（"⚠️ 终止后不可恢复，确认终止？"）+ 输入终止原因（必填）
- 输出：工作流状态变为 `terminated`，所有步骤立即终止
- 异常：无（终止操作不可逆，确认前需谨慎）

### 3.4 实例详情页 - DAG 实时视图

#### 3.4.1 页面布局

**整体布局**：页头 + Tab 导航 + 内容区

**页头**（高度 80px）：
- 左侧：实例 ID（小字灰色）+ 模板名称（大字加粗）
- 中部：状态徽章 + 整体进度条（宽度 200px）+ 预估剩余时间
- 右侧：操作按钮组（暂停 / 恢复 / 终止 / 导出报告）

**Tab 导航**（高度 48px）：
- Tab 1：DAG 图（默认激活）
- Tab 2：步骤列表
- Tab 3：时间线
- Tab 4：日志
- Tab 5：产出

**内容区 - DAG 图 Tab**：
- 全屏 React Flow 画布
- 节点状态实时更新（WebSocket 推送）
- 点击节点打开右侧抽屉（步骤详情）
- 支持缩放/拖拽/适应屏幕

**内容区 - 步骤列表 Tab**：
- 表格视图，列：步骤名称 / 状态 / Agent / 开始时间 / 结束时间 / 耗时 / 操作
- 支持按状态筛选（pending / running / completed / failed）
- 点击行展开详细日志

**内容区 - 时间线 Tab**：
- 垂直时间线（类似 Git 提交历史）
- 每个事件：时间戳 + 事件类型图标 + 事件描述
- 支持按事件类型筛选

**内容区 - 日志 Tab**：
- 滚动文本框，实时追加日志（WebSocket）
- 日志分级颜色：INFO（黑色）/ WARN（橙色）/ ERROR（红色）
- 顶部工具栏：搜索框 + 下载按钮 + 自动滚动开关

**内容区 - 产出 Tab**：
- 文件列表（支持下载）
- 每个文件：文件名 + 大小 + 生成时间 + 预览按钮
- 支持按步骤筛选

#### 3.4.2 交互细节

**步骤详情抽屉**：
- 输入：点击 DAG 图中的节点
- 处理：从右侧滑出抽屉（宽度 400px）
- 输出：显示步骤详细信息
  - 基本信息：名称 / 状态 / Agent / 开始时间 / 预计完成时间
  - 进度环：当前进度百分比
  - 输入参数：JSON 格式显示
  - 输出预览：文件列表或数据表格
  - 操作按钮（根据状态）：重试 / 跳过 / 强制完成 / 重新分配 Agent
- 异常：无

**实时进度更新**：
- 输入：WebSocket 推送 `step.progress` 事件
- 处理：更新节点上的进度环 + 整体进度条
- 输出：节点颜色/进度实时变化
- 异常：WebSocket 断开 → 显示"离线模式，数据可能不是最新" + 手动刷新按钮

### 3.5 审核中心页

#### 3.5.1 页面布局

**整体布局**：顶部统计卡片 + Tab 导航 + 审核列表

**顶部统计卡片**（3 列等宽）：
- 卡片 1：待我审核（数字大字 + "项"）
- 卡片 2：今日已审核（数字大字 + "项"）
- 卡片 3：超时预警（数字大字 + "项"，红色高亮）

**Tab 导航**：
- Tab 1：待我审核（默认激活，显示数字徽章）
- Tab 2：已审核
- Tab 3：全部审核（管理员可见）

**审核列表**（卡片视图）：
- 每个卡片固定高度 120px，包含：
  - 左侧：工作流图标 + 步骤名称（可点击）
  - 中部：工作流名称 + 请求时间 + 剩余时间（超时倒计时）
  - 右侧：【立即审核】按钮（主按钮样式）
  - 底部：摘要信息（Agent 名称 + 关键产出）

#### 3.5.2 交互细节

**进入审核**：
- 输入：点击【立即审核】按钮
- 处理：打开审核详情弹窗（全屏模态框）
- 输出：显示审核内容
  - Tab 1：产出摘要（前序步骤产出 + 当前步骤关键决策点）
  - Tab 2：推理过程（Agent 思考链路）
  - Tab 3：输出预览（文件 / 数据）
- 异常：审核已被其他人处理 → 提示"该审核已被处理"

**提交审核**：
- 输入：点击【Approve】/【Reject】/【Request Changes】
- 处理：
  - Approve：步骤状态变为 `approved`，工作流继续执行
  - Reject：步骤状态变为 `rejected`，工作流终止或回退
  - Request Changes：工作流暂停，Agent 根据反馈修改
- 输出：弹窗关闭，审核列表更新，显示成功提示
- 异常：必填评论未填写 → 提示"请填写审核意见"

---

## 4. 核心交互流程

### 4.1 创建工作流模板流程

```
[用户：研发负责人]
    ↓
进入"模板管理"页面
    ↓
点击【+ 新建模板】
    ↓
[系统]打开模板编辑器页面
    ↓
填写基本信息：名称"研发流水线-需求新增" + 描述 + 标签
    ↓
添加步骤 Step 1：需求分析
  - Agent：rd-product-researcher
  - 预估时长：60 分钟
  - 输出：docs/requirements.md
    ↓
添加步骤 Step 2：需求验证
  - Agent：rd-commander
  - 依赖：Step 1
  - 验证条件：四部分完整
    ↓
[系统]DAG 画布自动创建节点并连线
    ↓
继续添加 Step 3-20...（参考 rd-team-workflow.md）
    ↓
配置全局参数：
  - 单步超时：30 分钟
  - 整体超时：24 小时
  - 最大重试：3 次
  - 失败策略：转人工
    ↓
点击【保存草稿】
    ↓
[系统]验证 DAG 无循环依赖 → 保存成功
    ↓
返回模板列表，模板状态为"草稿"
    ↓
点击【发布】→ 模板状态变为"已发布"，可用于启动实例
```

**异常分支**：

| 异常场景 | 输入 | 处理 | 输出 |
|---------|------|------|------|
| 循环依赖 | 用户尝试创建 A→B→C→A 的依赖 | DAG 拒绝创建最后一条边 | 弹窗提示"检测到循环依赖，请调整" |
| 步骤无 Agent | 保存时检测到某步骤未分配 Agent | 阻止保存 | 提示"步骤 XXX 未分配 Agent，请配置" |
| 起始节点缺失 | 所有步骤都有前置依赖 | 阻止保存 | 提示"DAG 缺少起始节点（无前置依赖的步骤）" |

### 4.2 启动工作流实例流程

```
[用户：产品经理]
    ↓
进入模板详情页
    ↓
点击【启动工作流】
    ↓
[系统]弹出参数填写弹窗
    ↓
填写输入参数：
  - 项目名称：OpenClaw Control Plane — 工作流管理系统
  - 需求文档路径：/path/to/requirements.md
    ↓
选择执行模式：标准模式
    ↓
点击【确认启动】
    ↓
[系统]
  1. 创建工作流实例（状态：pending）
  2. 初始化所有步骤状态为 pending
  3. 启动 DAG 调度器
  4. 识别无依赖的步骤（Step 1）→ 状态变为 ready
  5. 匹配 Agent（rd-product-researcher）→ 状态变为 assigned
  6. 分发任务到 Agent → 状态变为 running
    ↓
跳转到实例详情页
    ↓
[WebSocket 推送] Step 1 进度更新：0% → 10% → 20% ...
    ↓
DAG 图中 Step 1 节点颜色变化：灰色 → 蓝色 → 绿色（动态）
```

**异常分支**：

| 异常场景 | 输入 | 处理 | 输出 |
|---------|------|------|------|
| Agent 离线 | 启动时匹配 Agent，所有候选 Agent 都离线 | 步骤状态变为 `waiting_for_agent` | 页面提示"等待可用 Agent..." |
| 参数校验失败 | 必填参数未填写 | 阻止启动 | 弹窗提示"请填写项目名称" |
| 模板未发布 | 尝试启动草稿模板 | 阻止启动 | 提示"模板未发布，请先发布后再启动" |

### 4.3 工作流执行监控流程

```
[用户：研发负责人]
    ↓
进入实例详情页
    ↓
查看 DAG 图实时状态
    ↓
[WebSocket 推送事件流]
  - Step 1 completed → Step 2 ready → Step 2 assigned → Step 2 running
  - Step 3 awaiting_review（人工审核节点）
    ↓
DAG 图中 Step 3 节点变为琥珀色，显示"等待审核"标识
    ↓
顶部进度条暂停，显示"等待审核：Step 3 PRD + 需求评审"
    ↓
[审核人收到通知]
    ↓
进入"审核中心" → 点击【立即审核】
    ↓
审核详情弹窗显示：
  - 前序产出：需求文档（Step 1）+ 验证通过记录（Step 2）
  - 当前产出：PRD 文档
  - 推理过程：Agent 思考链路
    ↓
审核人查看 PRD → 填写评论"整体清晰，但缺少异常处理部分"
    ↓
点击【Request Changes】
    ↓
[系统]
  - 记录审核操作（时间 / 操作者 / 评论）
  - 工作流保持 paused 状态
  - 通知 Agent 修改
    ↓
Agent 修改 PRD → 重新提交审核
    ↓
审核人再次审核 → 点击【Approve】
    ↓
[系统]
  - Step 3 状态变为 approved
  - DAG 调度器触发 Step 4 执行
    ↓
工作流继续执行...
```

### 4.4 异常处理流程

#### 4.4.1 步骤失败与重试

```
[场景：Step 8 编码验证失败]
    ↓
[Agent 上报] Step 8 执行失败，原因：语法错误
    ↓
[系统]
  - Step 8 状态变为 failed
  - 记录失败原因和日志
  - 判断重试次数（0 < 3）→ 触发重试
    ↓
Step 8 状态变为 retrying → running
    ↓
Agent 重新执行 Step 8
    ↓
[用户] 在实例详情页看到 Step 8 节点先变红（失败）再变蓝（重试中）
    ↓
若重试成功 → Step 8 状态变为 completed，继续执行 Step 9
若重试 3 次仍失败 → 根据失败策略处理：
  - 终止流程 → 工作流状态变为 terminated
  - 跳过继续 → Step 8 状态变为 skipped，Step 9 使用默认输出继续
  - 转人工 → 工作流状态变为 paused，发送通知给管理员
```

#### 4.4.2 手动干预

```
[场景：步骤卡住，用户手动强制完成]
    ↓
[用户] 在实例详情页点击 Step 10 节点
    ↓
右侧抽屉显示步骤详情
    ↓
点击【强制完成】
    ↓
[系统] 弹出确认框："请输入强制完成原因"（必填）
    ↓
[用户] 填写原因："外部依赖已手动确认完成"
    ↓
点击【确认】
    ↓
[系统]
  - Step 10 状态变为 completed
  - 记录强制完成原因和操作者
  - 触发 DAG 调度器继续执行
    ↓
DAG 图中 Step 10 节点变为绿色，显示"强制完成"标识
```

### 4.5 完整生命周期流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        工作流生命周期                                  │
└─────────────────────────────────────────────────────────────────────┘

创建模板
    │
    ▼
发布模板 ────┐
    │        │
    ▼        │ (修改模板)
启动实例      │
    │        │
    ▼        ▼
初始化 ──→ pending
    │
    ▼
调度 ──→ running ←──────┐
    │                   │
    ├──→ 步骤执行       │
    │      │            │
    │      ├──→ 成功 → 下一步
    │      │            │
    │      ├──→ 失败 → 重试 ──┐
    │      │                   │
    │      └──→ 审核节点        │
    │             │            │
    │             ├──→ Approve → 继续
    │             │            │
    │             ├──→ Reject → 终止/回退
    │             │            │
    │             └──→ Request Changes → 暂停 → Agent 修改 → 重新审核
    │                          │
    │                          ▼
    ├──→ 用户暂停 ──→ paused ──┤
    │                   │      │
    │                   └──→ 用户恢复 ──┘
    │
    ├──→ 用户终止 ──→ terminated (不可恢复)
    │
    └──→ 全部完成 ──→ completed
                          │
                          ▼
                    历史归档 (保留 90-180 天)
```

---

## 5. DAG 可视化规范

### 5.1 节点设计规范

#### 5.1.1 节点形状

| 节点类型 | 形状 | 尺寸 | 说明 |
|---------|------|------|------|
| 普通步骤 | 圆角矩形 | 180×80 px | 默认步骤类型 |
| 人工审核点 | 圆角矩形 + 右上角人形图标 | 180×80 px | `human_review: true` |
| 并行步骤组 | 虚线边框包裹多个节点 | 自适应 | 并行执行的步骤 |
| 起始节点 | 圆形 | 40×40 px | 无前置依赖的步骤 |
| 结束节点 | 双层圆形 | 40×40 px | 无后续依赖的步骤 |

#### 5.1.2 节点颜色

| 状态 | 背景色 | 边框色 | 文字色 | 图标/标识 |
|------|--------|--------|--------|----------|
| `pending` | #F5F5F5 (灰) | #D9D9D9 | #8C8C8C | — |
| `ready` | #F5F5F5 (灰) | #1890FF | #595959 | — |
| `assigned` | #E6F7FF (浅蓝) | #1890FF | #262626 | — |
| `running` | #E6F7FF (浅蓝) | #52C41A (动态) | #262626 | 🔄 旋转动画 |
| `awaiting_review` | #FFF7E6 (琥珀) | #FA8C16 | #262626 | ⏳ 倒计时 |
| `approved` | #F6FFED (浅绿) | #52C41A | #262626 | ✅ |
| `rejected` | #FFF1F0 (浅红) | #FF4D4F | #262626 | ❌ |
| `retrying` | #E6F7FF (浅蓝) | #1890FF (闪烁) | #262626 | 🔄 重试次数 (1/3) |
| `completed` | #F6FFED (浅绿) | #52C41A | #262626 | ✅ |
| `failed` | #FFF1F0 (浅红) | #FF4D4F | #262626 | ❌ 错误数 |
| `cancelled` | #F5F5F5 (灰) | #D9D9D9 | #8C8C8C | ⊗ |
| `skipped` | #F5F5F5 (灰，半透明) | #D9D9D9 | #8C8C8C | ⊗ |

#### 5.1.3 节点内容

**节点布局（从上到下）**：

```
┌────────────────────────────────────┐
│ [状态图标] 步骤名称                 │ ← 标题区
├────────────────────────────────────┤
│ Agent: rd-backend-dev              │ ← Agent 信息
│ 预计: 60 分钟 | 实际: 45 分钟       │ ← 时间信息
├────────────────────────────────────┤
│ ████████░░ 80%                     │ ← 进度条（running 时显示）
└────────────────────────────────────┘
```

**交互状态**：

| 状态 | 节点表现 |
|------|----------|
| 默认 | 静态显示 |
| 悬停 | 显示 tooltip（步骤详情摘要） |
| 选中 | 边框加粗 + 阴影 + 右侧抽屉展开 |
| 运行中 | 边框颜色动态渐变 + 进度环动画 |
| 失败 | 节点抖动动画 + 边框闪烁 |

### 5.2 连线设计规范

#### 5.2.1 连线样式

| 连线类型 | 样式 | 颜色 | 说明 |
|---------|------|------|------|
| 普通依赖 | 实线 + 箭头 | #D9D9D9 | 默认依赖关系 |
| 条件分支 | 虚线 + 箭头 | #1890FF | 根据条件判断的分支 |
| 并行执行 | 实线 + 箭头 | #52C41A | 同时执行的步骤 |
| 回退线 | 点线 + 箭头 | #FF4D4F | 失败后回退到前序步骤 |

#### 5.2.2 连线动画

| 状态 | 动画效果 |
|------|----------|
| 数据流动 | 流动点从源节点流向目标节点（1s 周期） |
| 执行路径高亮 | 已执行路径的连线加粗 + 变色（蓝色） |
| 错误路径 | 失败路径的连线变红色 + 闪烁 |

#### 5.2.3 连线标签

在连线中点显示依赖条件（如有）：

```
Step 1 ────[validation: 四部分完整]────→ Step 2
```

### 5.3 布局算法

#### 5.3.1 自动布局

使用 **Dagre** 布局算法（层次布局）：

- 方向：从上到下（TB）
- 节点间距：水平 100px，垂直 80px
- 层级对齐：居中对齐
- 边的正交化：减少边的交叉

#### 5.3.2 手动调整

支持用户手动拖拽节点调整位置：

- 拖拽时显示网格辅助线
- 吸附到网格（20px 网格）
- 位置保存到本地存储（localStorage）

### 5.4 缩放与导航

#### 5.4.1 缩放控制

| 操作 | 方式 |
|------|------|
| 放大 | 点击工具栏【+】按钮 / 鼠标滚轮向上 / 双指捏合（触摸板） |
| 缩小 | 点击工具栏【-】按钮 / 鼠标滚轮向下 / 双指展开（触摸板） |
| 适应屏幕 | 点击工具栏【适应屏幕】按钮 |
| 缩放比例 | 25% - 200%，默认 100% |

#### 5.4.2 平移与拖拽

- 按住空白区域拖拽：平移画布
- 按住节点拖拽：移动节点位置
- 小地图导航（Mini Map）：右下角显示缩略图，点击快速定位

### 5.5 性能优化

| 场景 | 优化策略 |
|------|----------|
| 大型 DAG（>50 节点） | 虚拟化渲染，只渲染可视区域内的节点 |
| 频繁更新 | 使用 React.memo + 虚拟 DOM diff 最小化重渲染 |
| WebSocket 推送 | 节流（throttle）100ms，批量更新状态 |
| 图形渲染 | 使用 Canvas 渲染连线，DOM 渲染节点（React Flow 默认） |

---

## 6. 审核节点交互

### 6.1 审核触发条件

审核节点在工作流执行到该步骤时自动触发：

```
步骤执行完成
    ↓
判断 step.human_review === true ?
    ├─ 否 → 直接标记为 completed，继续下一步
    └─ 是 → 步骤状态变为 awaiting_review
        ↓
    创建审核记录（Review Record）
        ↓
    通知审核人（WebSocket + 邮件/IM）
        ↓
    等待审核人操作
```

### 6.2 审核界面设计

#### 6.2.1 审核弹窗布局

```
┌─────────────────────────────────────────────────────────────────┐
│ [X] 审核步骤：Step 3 PRD + 需求评审                              │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [产出摘要] [推理过程] [输出预览]                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Tab 1 内容区：                                               │ │
│ │                                                              │ │
│ │ 前序步骤产出：                                               │ │
│ │ ├─ Step 1: 需求分析                                         │ │
│ │ │   产出：docs/requirements.md [预览] [下载]                │ │
│ │ │   摘要：42 个功能点，包含功能/非功能/边界/异常             │ │
│ │ │                                                            │ │
│ │ ├─ Step 2: 需求验证                                         │ │
│ │ │   结果：✅ 通过（四部分完整）                              │ │
│ │ │                                                            │ │
│ │ 当前步骤关键决策点：                                         │ │
│ │ ├─ 功能格式：每个功能附 输入→处理→输出→异常                 │ │
│ │ ├─ 优先级：P0 MVP / P1 v1.1 / P2 v1.2                       │ │
│ │ └─ 审核重点：API 端点完整性                                  │ │
│ │                                                              │ │
│ │ 当前产出：                                                   │ │
│ │ └─ docs/prd.md [预览] [下载]                                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 审核意见：                                                   │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ 请输入审核意见...                                        │ │
│ │ │                                                          │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │        [Request Changes]  [Reject]  [Approve]               │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2.2 Tab 页内容

**Tab 1：产出摘要**
- 显示前序步骤的产出列表
- 每个产出：步骤名称 + 产出文件名 + 摘要 + [预览] [下载] 按钮
- 当前步骤的关键决策点（Agent 标注）
- 当前步骤的产出文件列表

**Tab 2：推理过程**
- Agent 的完整思考链路（Reasoning Chain）
- 折叠面板，可逐层展开查看详细推理
- 语法高亮（Markdown / JSON）
- 支持搜索关键词

**Tab 3：输出预览**
- 文件类型自动识别：
  - Markdown：渲染为 HTML 预览
  - JSON：格式化显示
  - 图片：直接显示
  - 其他：显示文件信息 + 下载按钮
- 支持全屏查看

### 6.3 审核操作

#### 6.3.1 Approve（通过）

| 项目 | 说明 |
|------|------|
| **按钮样式** | 绿色主按钮 |
| **点击后** | 弹出确认框："确认通过审核？" |
| **必填项** | 无（评论可选） |
| **处理后** | 步骤状态 → `approved`，工作流继续执行 |
| **通知** | 通知工作流创建者："Step 3 已通过审核" |

#### 6.3.2 Reject（拒绝）

| 项目 | 说明 |
|------|------|
| **按钮样式** | 红色危险按钮 |
| **点击后** | 弹出确认框："⚠️ 拒绝后工作流将终止，确认拒绝？" |
| **必填项** | 评论（必填，至少 10 字） |
| **处理后** | 步骤状态 → `rejected`，工作流状态 → `terminated` |
| **通知** | 通知工作流创建者和 Agent："Step 3 被拒绝，工作流已终止" |

#### 6.3.3 Request Changes（要求修改）

| 项目 | 说明 |
|------|------|
| **按钮样式** | 黄色警告按钮 |
| **点击后** | 弹出确认框："确认要求修改？" |
| **必填项** | 评论（必填，至少 20 字，具体说明需要修改的内容） |
| **处理后** | 步骤状态保持 `awaiting_review`，工作流状态 → `paused` |
| **后续** | Agent 根据反馈修改 → 重新提交审核 → 审核人再次审核 |

### 6.4 审核超时处理

#### 6.4.1 超时配置

| 配置项 | 默认值 | 说明 |
|-------|--------|------|
| 超时阈值 | 24 小时 | 从步骤进入 `awaiting_review` 开始计时 |
| 预警时间 | 2 小时 | 超时前 2 小时发送提醒 |
| 超时动作 | auto_reject | 超时后的自动处理动作 |

#### 6.4.2 超时动作选项

| 选项 | 说明 | 风险等级 |
|------|------|----------|
| `auto_reject` | 自动拒绝，工作流终止 | 低风险（默认） |
| `auto_approve` | 自动通过，继续执行 | 高风险（需明确配置） |
| `escalate` | 升级给上级审核人 | 中风险 |
| `notify_only` | 仅发送通知，不做自动处理 | 低风险 |

#### 6.4.3 超时提醒

```
审核创建时
    ↓
设置超时定时器（24 小时）
    ↓
超时前 2 小时
    ↓
发送提醒通知（邮件/IM）
    ↓
超时时刻
    ↓
执行超时动作（默认：auto_reject）
    ↓
记录超时原因："审核超时，自动拒绝"
    ↓
通知相关人员
```

### 6.5 审核历史

#### 6.5.1 历史记录内容

每次审核操作记录以下信息：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 审核记录 ID |
| workflow_instance_id | UUID | 工作流实例 ID |
| step_id | UUID | 步骤 ID |
| reviewer_id | UUID | 审核人 ID |
| action | enum | approve / reject / request_changes |
| comment | text | 审核意见 |
| created_at | timestamp | 审核时间 |
| duration | number | 审核耗时（秒） |

#### 6.5.2 历史查询

- 在工作流详情页的"审核记录" Tab 查看完整审核历史
- 在审核中心的"已审核" Tab 查看当前用户的历史审核
- 支持导出审核报告（PDF / CSV）

### 6.6 审核权限

| 角色 | 权限 |
|------|------|
| **指定审核人** | 可审核被指定的审核节点 |
| **工作流创建者** | 可审核自己创建的工作流中的审核节点（如无指定审核人） |
| **管理员** | 可审核所有审核节点（紧急情况下介入） |
| **其他用户** | 不可审核，仅可查看（只读） |

---

## 7. 数据模型概要

### 7.1 核心实体关系图

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│ WorkflowTemplate │──1:N──│ WorkflowInstance │──1:N──│ StepExecution  │
└─────────────────┘       └──────────────────┘       └─────────────────┘
        │                          │                          │
        │ 1:N                      │ 1:N                      │ 1:N
        ▼                          ▼                          ▼
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  StepDefinition │       │   ReviewRecord   │       │    LogEntry     │
└─────────────────┘       └──────────────────┘       └─────────────────┘
        │
        │ N:M
        ▼
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│      Agent      │──N:M──│   Capability     │       │      User       │
└─────────────────┘       └──────────────────┘       └─────────────────┘
                                                              │
                                                              │ 1:N
                                                              ▼
                                                      ┌─────────────────┐
                                                      │  AuditLog       │
                                                      └─────────────────┘
```

### 7.2 核心实体定义

#### 7.2.1 WorkflowTemplate（工作流模板）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | UUID | ✅ | 模板唯一标识 |
| name | VARCHAR(255) | ✅ | 模板名称 |
| description | TEXT | ❌ | 模板描述 |
| version | VARCHAR(20) | ✅ | 版本号（如 v1.0） |
| status | ENUM | ✅ | draft / published / archived |
| dag | JSONB | ✅ | DAG 定义（步骤 + 边） |
| config | JSONB | ✅ | 全局配置（超时/重试/失败策略） |
| created_at | TIMESTAMP | ✅ | 创建时间 |
| created_by | UUID | ✅ | 创建者 ID（关联 User） |
| updated_at | TIMESTAMP | ✅ | 更新时间 |
| published_at | TIMESTAMP | ❌ | 发布时间 |
| usage_count | INTEGER | ✅ | 使用次数（默认 0） |
| tags | VARCHAR(100)[] | ❌ | 标签数组 |

**DAG JSONB 结构**：

```json
{
  "steps": [
    {
      "id": "step1",
      "name": "需求分析",
      "agent": "rd-product-researcher",
      "capabilities": ["research"],
      "estimated_duration": 60,
      "input": {},
      "output": "docs/requirements.md",
      "validation": ["四部分完整"],
      "human_review": false,
      "depends_on": []
    }
  ],
  "edges": [
    {
      "source": "step1",
      "target": "step2",
      "condition": null
    }
  ]
}
```

#### 7.2.2 WorkflowInstance（工作流实例）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | UUID | ✅ | 实例唯一标识 |
| template_id | UUID | ✅ | 模板 ID（关联 WorkflowTemplate） |
| template_version | VARCHAR(20) | ✅ | 使用的模板版本 |
| status | ENUM | ✅ | pending / running / paused / completed / failed / terminated |
| input | JSONB | ✅ | 输入参数 |
| output | JSONB | ❌ | 最终输出 |
| progress | INTEGER | ✅ | 整体进度（0-100） |
| estimated_remaining | INTEGER | ❌ | 预估剩余时间（秒） |
| created_at | TIMESTAMP | ✅ | 创建时间 |
| created_by | UUID | ✅ | 创建者 ID |
| started_at | TIMESTAMP | ❌ | 开始时间 |
| completed_at | TIMESTAMP | ❌ | 完成时间 |
| duration | INTEGER | ❌ | 实际耗时（秒） |

#### 7.2.3 StepExecution（步骤执行）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | UUID | ✅ | 执行记录 ID |
| workflow_instance_id | UUID | ✅ | 工作流实例 ID |
| step_id | VARCHAR(50) | ✅ | 对应模板中的步骤 ID |
| name | VARCHAR(255) | ✅ | 步骤名称 |
| status | ENUM | ✅ | pending / ready / assigned / running / awaiting_review / approved / rejected / retrying / completed / failed / cancelled / skipped |
| agent_id | UUID | ❌ | 执行的 Agent ID |
| input | JSONB | ❌ | 步骤输入 |
| output | JSONB | ❌ | 步骤输出 |
| progress | INTEGER | ✅ | 步骤进度（0-100） |
| started_at | TIMESTAMP | ❌ | 开始时间 |
| completed_at | TIMESTAMP | ❌ | 完成时间 |
| duration | INTEGER | ❌ | 实际耗时（秒） |
| retry_count | INTEGER | ✅ | 重试次数（默认 0） |
| error_message | TEXT | ❌ | 错误信息 |
| force_completed | BOOLEAN | ✅ | 是否强制完成（默认 false） |
| force_completed_by | UUID | ❌ | 强制完成操作者 ID |
| force_completed_reason | TEXT | ❌ | 强制完成原因 |

#### 7.2.4 ReviewRecord（审核记录）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | UUID | ✅ | 审核记录 ID |
| workflow_instance_id | UUID | ✅ | 工作流实例 ID |
| step_execution_id | UUID | ✅ | 步骤执行 ID |
| reviewer_id | UUID | ✅ | 审核人 ID |
| action | ENUM | ✅ | approve / reject / request_changes |
| comment | TEXT | ❌ | 审核意见 |
| created_at | TIMESTAMP | ✅ | 审核时间 |
| timeout_at | TIMESTAMP | ❌ | 超时时间 |
| timeout_action | ENUM | ❌ | auto_reject / auto_approve / escalate / notify_only |

#### 7.2.5 Agent

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | UUID | ✅ | Agent 唯一标识 |
| name | VARCHAR(255) | ✅ | Agent 名称 |
| capabilities | VARCHAR(100)[] | ✅ | 能力标签数组 |
| status | ENUM | ✅ | online / degraded / offline |
| current_task_id | UUID | ❌ | 当前任务 ID |
| last_heartbeat | TIMESTAMP | ❌ | 最后心跳时间 |
| config | JSONB | ❌ | Agent 配置（模型/温度等） |
| created_at | TIMESTAMP | ✅ | 注册时间 |

#### 7.2.6 LogEntry（日志条目）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | UUID | ✅ | 日志 ID |
| step_execution_id | UUID | ✅ | 步骤执行 ID |
| timestamp | TIMESTAMP | ✅ | 日志时间 |
| level | ENUM | ✅ | INFO / WARN / ERROR |
| message | TEXT | ✅ | 日志内容 |
| metadata | JSONB | ❌ | 元数据 |

#### 7.2.7 User（用户）

复用 OpenClaw 现有用户体系，关键字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | UUID | ✅ | 用户唯一标识 |
| username | VARCHAR(100) | ✅ | 用户名 |
| email | VARCHAR(255) | ✅ | 邮箱 |
| role | ENUM | ✅ | admin / editor / viewer |

### 7.3 索引设计

| 表 | 索引字段 | 索引类型 | 说明 |
|-----|---------|---------|------|
| workflow_templates | created_by | B-Tree | 按创建者查询 |
| workflow_templates | status | B-Tree | 按状态筛选 |
| workflow_templates | name | GIN（全文索引） | 名称搜索 |
| workflow_instances | template_id | B-Tree | 按模板查询实例 |
| workflow_instances | status | B-Tree | 按状态筛选 |
| workflow_instances | created_by | B-Tree | 按创建者查询 |
| workflow_instances | created_at | B-Tree | 按时间排序 |
| step_executions | workflow_instance_id | B-Tree | 查询工作流的所有步骤 |
| step_executions | status | B-Tree | 按状态筛选 |
| step_executions | agent_id | B-Tree | 按 Agent 查询 |
| review_records | reviewer_id | B-Tree | 查询用户的审核任务 |
| review_records | workflow_instance_id | B-Tree | 查询工作流的审核记录 |
| log_entries | step_execution_id | B-Tree | 查询步骤的日志 |
| log_entries | timestamp | B-Tree | 按时间查询日志 |

---

## 8. API 端点清单

### 8.1 工作流模板（Workflow Templates）

| Method | Path | 描述 | 权限 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/v1/workflow-templates` | 获取模板列表 | viewer | Query: page, page_size, status, search | `{ data: Template[], total: number }` |
| GET | `/api/v1/workflow-templates/:id` | 获取模板详情 | viewer | — | `Template` |
| POST | `/api/v1/workflow-templates` | 创建模板 | editor | `CreateTemplateRequest` | `Template` |
| PUT | `/api/v1/workflow-templates/:id` | 更新模板 | editor | `UpdateTemplateRequest` | `Template` |
| DELETE | `/api/v1/workflow-templates/:id` | 删除模板 | admin | — | `{ success: true }` |
| POST | `/api/v1/workflow-templates/:id/publish` | 发布模板 | editor | — | `Template` |
| POST | `/api/v1/workflow-templates/:id/duplicate` | 复制模板 | editor | — | `Template` |
| POST | `/api/v1/workflow-templates/import` | 导入模板 | editor | `FormData: file` | `Template` |
| GET | `/api/v1/workflow-templates/:id/export` | 导出模板 | viewer | Query: format (json/yaml) | `File` |

**请求/响应示例**：

```typescript
// CreateTemplateRequest
interface CreateTemplateRequest {
  name: string;
  description?: string;
  dag: DAGDefinition;
  config: WorkflowConfig;
  tags?: string[];
}

// Template Response
interface Template {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  dag: DAGDefinition;
  config: WorkflowConfig;
  created_at: string;
  created_by: string;
  updated_at: string;
  published_at?: string;
  usage_count: number;
  tags: string[];
}
```

### 8.2 工作流实例（Workflow Instances）

| Method | Path | 描述 | 权限 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/v1/workflows` | 获取实例列表 | viewer | Query: page, page_size, status, template_id | `{ data: Workflow[], total: number }` |
| GET | `/api/v1/workflows/:id` | 获取实例详情 | viewer | — | `Workflow` |
| POST | `/api/v1/workflows` | 启动新实例 | editor | `CreateWorkflowRequest` | `Workflow` |
| POST | `/api/v1/workflows/:id/pause` | 暂停工作流 | editor | — | `Workflow` |
| POST | `/api/v1/workflows/:id/resume` | 恢复工作流 | editor | — | `Workflow` |
| POST | `/api/v1/workflows/:id/terminate` | 终止工作流 | editor | `{ reason: string }` | `Workflow` |
| DELETE | `/api/v1/workflows/:id` | 删除实例 | admin | — | `{ success: true }` |
| GET | `/api/v1/workflows/:id/logs` | 获取日志 | viewer | Query: level, start_time, end_time | `LogEntry[]` |
| GET | `/api/v1/workflows/:id/export` | 导出报告 | viewer | Query: format (pdf/json) | `File` |

**请求/响应示例**：

```typescript
// CreateWorkflowRequest
interface CreateWorkflowRequest {
  template_id: string;
  input: Record<string, any>;
  execution_mode?: 'standard' | 'debug';
}

// Workflow Response
interface Workflow {
  id: string;
  template_id: string;
  template_name: string;
  template_version: string;
  status: WorkflowStatus;
  input: Record<string, any>;
  output?: Record<string, any>;
  progress: number;
  estimated_remaining?: number;
  created_at: string;
  created_by: string;
  started_at?: string;
  completed_at?: string;
  duration?: number;
  steps: StepExecution[];
}
```

### 8.3 步骤执行（Step Executions）

| Method | Path | 描述 | 权限 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/v1/workflows/:workflow_id/steps` | 获取所有步骤 | viewer | — | `StepExecution[]` |
| GET | `/api/v1/workflows/:workflow_id/steps/:step_id` | 获取步骤详情 | viewer | — | `StepExecution` |
| POST | `/api/v1/workflows/:workflow_id/steps/:step_id/retry` | 重试步骤 | editor | — | `StepExecution` |
| POST | `/api/v1/workflows/:workflow_id/steps/:step_id/skip` | 跳过步骤 | editor | `{ reason: string }` | `StepExecution` |
| POST | `/api/v1/workflows/:workflow_id/steps/:step_id/force-complete` | 强制完成 | admin | `{ reason: string }` | `StepExecution` |
| POST | `/api/v1/workflows/:workflow_id/steps/:step_id/reassign` | 重新分配 Agent | editor | `{ agent_id: string }` | `StepExecution` |
| POST | `/api/v1/workflows/:workflow_id/steps/:step_id/progress` | Agent 上报进度 | agent | `{ progress: number, message: string }` | `{ success: true }` |
| GET | `/api/v1/workflows/:workflow_id/steps/:step_id/logs` | 获取步骤日志 | viewer | Query: level | `LogEntry[]` |
| GET | `/api/v1/workflows/:workflow_id/steps/:step_id/output` | 获取步骤输出 | viewer | — | `File[]` |

**请求/响应示例**：

```typescript
// StepExecution Response
interface StepExecution {
  id: string;
  step_id: string;
  name: string;
  status: StepStatus;
  agent_id?: string;
  agent_name?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  progress: number;
  started_at?: string;
  completed_at?: string;
  duration?: number;
  retry_count: number;
  error_message?: string;
  logs?: LogEntry[];
  review?: ReviewRecord;
}
```

### 8.4 人工审核（Human Reviews）

| Method | Path | 描述 | 权限 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/v1/reviews/pending` | 获取待审核列表 | reviewer | Query: page, page_size | `{ data: Review[], total: number }` |
| GET | `/api/v1/reviews/:id` | 获取审核详情 | reviewer | — | `Review` |
| POST | `/api/v1/reviews/:id/approve` | 通过审核 | reviewer | `{ comment?: string }` | `Review` |
| POST | `/api/v1/reviews/:id/reject` | 拒绝审核 | reviewer | `{ comment: string }` | `Review` |
| POST | `/api/v1/reviews/:id/request-changes` | 要求修改 | reviewer | `{ comment: string }` | `Review` |
| GET | `/api/v1/workflows/:workflow_id/reviews` | 获取工作流审核记录 | viewer | — | `Review[]` |

**请求/响应示例**：

```typescript
// Review Response
interface Review {
  id: string;
  workflow_instance_id: string;
  workflow_name: string;
  step_execution_id: string;
  step_name: string;
  reviewer_id: string;
  reviewer_name: string;
  action?: 'approve' | 'reject' | 'request_changes';
  comment?: string;
  created_at: string;
  timeout_at: string;
  remaining_time: number; // 秒
  status: 'pending' | 'completed';
  outputs?: {
    files: File[];
    summary: string;
    reasoning: string;
  };
}
```

### 8.5 Agent 管理

| Method | Path | 描述 | 权限 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/v1/agents` | 获取 Agent 列表 | viewer | Query: status | `{ data: Agent[], total: number }` |
| GET | `/api/v1/agents/:id` | 获取 Agent 详情 | viewer | — | `Agent` |
| POST | `/api/v1/agents/:id/sync` | 同步 Agent 状态 | editor | — | `Agent` |
| POST | `/api/v1/agents/:id/cleanup` | 清理 Agent 数据 | editor | — | `{ success: true }` |
| POST | `/api/v1/agents/:id/stop` | 停止 Agent | admin | — | `Agent` |
| POST | `/api/v1/agents/:id/restart` | 重启 Agent | admin | — | `Agent` |
| POST | `/api/v1/agents/batch-sync` | 批量同步 | editor | — | `{ success: true }` |
| POST | `/api/v1/agents/batch-cleanup` | 批量清理 | editor | — | `{ success: true }` |

### 8.6 统计与监控

| Method | Path | 描述 | 权限 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| GET | `/api/v1/stats/workflows` | 工作流统计 | viewer | Query: start_date, end_date | `WorkflowStats` |
| GET | `/api/v1/stats/agents` | Agent 统计 | viewer | — | `AgentStats` |
| GET | `/api/v1/stats/tasks` | 任务统计 | viewer | — | `TaskStats` |
| GET | `/api/v1/health` | 健康检查 | public | — | `{ status: 'ok' }` |

**响应示例**：

```typescript
// WorkflowStats
interface WorkflowStats {
  total: number;
  by_status: {
    pending: number;
    running: number;
    paused: number;
    completed: number;
    failed: number;
    terminated: number;
  };
  success_rate: number; // 百分比
  avg_duration: number; // 秒
  by_template: {
    template_id: string;
    template_name: string;
    count: number;
    success_rate: number;
  }[];
}
```

### 8.7 WebSocket 事件

**连接端点**：
```
wss://[host]/api/v1/ws?token=[jwt_token]
```

**订阅频道**：

| 频道 | 订阅方式 | 事件类型 |
|------|----------|----------|
| `workflows` | `{ "action": "subscribe", "channel": "workflows" }` | `workflow.created`, `workflow.updated`, `workflow.deleted` |
| `workflow.{id}` | `{ "action": "subscribe", "channel": "workflow.123" }` | `workflow.started`, `workflow.paused`, `workflow.resumed`, `workflow.completed`, `workflow.failed` |
| `workflow.{id}.steps` | `{ "action": "subscribe", "channel": "workflow.123.steps" }` | `step.started`, `step.progress`, `step.completed`, `step.failed`, `step.awaiting_review` |
| `agent.{id}` | `{ "action": "subscribe", "channel": "agent.456" }` | `agent.online`, `agent.offline`, `agent.task_assigned`, `agent.task_completed` |
| `reviews` | `{ "action": "subscribe", "channel": "reviews" }` | `review.created`, `review.approved`, `review.rejected` |

**事件格式**：

```json
{
  "event": "step.progress",
  "timestamp": "2026-04-01T10:35:12Z",
  "data": {
    "workflow_id": "wf-12345",
    "step_id": "step-67890",
    "step_name": "需求分析",
    "progress": 65,
    "message": "正在处理数据",
    "estimated_remaining": 300
  }
}
```

---

## 9. 优先级排序

### 9.1 P0 — MVP 必做（v1.0）

**目标**：实现核心工作流编排和执行能力，支持基本的流程可视化

| # | 功能模块 | 功能点 | 用户价值 | 工作量（人天） | 依赖 |
|---|---------|--------|----------|--------------|------|
| P0-01 | 模板管理 | 创建/编辑/删除模板 | ⭐⭐⭐⭐⭐ | 5 | 无 |
| P0-02 | 模板管理 | 模板列表/搜索/筛选 | ⭐⭐⭐⭐ | 2 | P0-01 |
| P0-03 | 模板管理 | DAG 编辑器（可视化） | ⭐⭐⭐⭐⭐ | 8 | P0-01 |
| P0-04 | 模板管理 | 模板发布/版本管理 | ⭐⭐⭐⭐ | 3 | P0-01 |
| P0-05 | 实例管理 | 启动工作流实例 | ⭐⭐⭐⭐⭐ | 5 | P0-04 |
| P0-06 | 实例管理 | 实例列表/状态查看 | ⭐⭐⭐⭐⭐ | 3 | P0-05 |
| P0-07 | 执行引擎 | DAG 调度器 | ⭐⭐⭐⭐⭐ | 8 | P0-05 |
| P0-08 | 执行引擎 | Agent 匹配与任务分发 | ⭐⭐⭐⭐⭐ | 5 | P0-07 |
| P0-09 | 执行引擎 | 步骤状态机 | ⭐⭐⭐⭐⭐ | 5 | P0-07 |
| P0-10 | 执行引擎 | 重试机制 | ⭐⭐⭐⭐ | 3 | P0-09 |
| P0-11 | 执行引擎 | 超时控制 | ⭐⭐⭐⭐ | 3 | P0-09 |
| P0-12 | 可视化 | DAG 图实时展示 | ⭐⭐⭐⭐⭐ | 8 | P0-07 |
| P0-13 | 可视化 | 进度条与时间估算 | ⭐⭐⭐⭐⭐ | 3 | P0-09 |
| P0-14 | 控制能力 | 暂停/恢复/终止工作流 | ⭐⭐⭐⭐⭐ | 5 | P0-07 |
| P0-15 | 控制能力 | 重试/跳过单步 | ⭐⭐⭐⭐ | 3 | P0-09 |
| P0-16 | 数据模型 | 核心表设计与迁移 | ⭐⭐⭐⭐⭐ | 5 | 无 |
| P0-17 | API | 核心接口开发 | ⭐⭐⭐⭐⭐ | 8 | P0-16 |
| P0-18 | WebSocket | 实时状态推送 | ⭐⭐⭐⭐⭐ | 5 | P0-17 |
| **合计** | | | | **87 人天** | |

**MVP 功能范围**：
- ✅ 创建/编辑/发布工作流模板
- ✅ 启动工作流实例
- ✅ DAG 实时可视化（状态颜色、进度）
- ✅ 暂停/恢复/终止工作流
- ✅ 重试/跳过单步
- ✅ 基本的人工审核（Approve/Reject）
- ✅ 实时进度更新

**不包含（推到 P1/P2）**：
- ❌ 审核中心页面
- ❌ 审核超时处理
- ❌ Request Changes 机制
- ❌ 时间线视图
- ❌ 实时日志流
- ❌ 强制完成/重新分配 Agent
- ❌ 历史版本回滚
- ❌ 模板导入/导出

### 9.2 P1 — v1.1 重要功能

**目标**：增强审核能力、历史追溯、日志系统

| # | 功能模块 | 功能点 | 用户价值 | 工作量（人天） | 依赖 |
|---|---------|--------|----------|--------------|------|
| P1-01 | 审核中心 | 审核中心页面 | ⭐⭐⭐⭐⭐ | 5 | P0-15 |
| P1-02 | 审核中心 | Request Changes 机制 | ⭐⭐⭐⭐⭐ | 5 | P1-01 |
| P1-03 | 审核中心 | 审核超时处理 | ⭐⭐⭐⭐ | 3 | P1-01 |
| P1-04 | 审核中心 | 审核历史查询 | ⭐⭐⭐⭐ | 2 | P1-01 |
| P1-05 | 历史记录 | 实例详情页（完整） | ⭐⭐⭐⭐⭐ | 5 | P0-12 |
| P1-06 | 历史记录 | 时间线视图 | ⭐⭐⭐⭐ | 3 | P1-05 |
| P1-07 | 历史记录 | 实时日志流 | ⭐⭐⭐⭐⭐ | 5 | P0-18 |
| P1-08 | 历史记录 | 导出报告（PDF/JSON） | ⭐⭐⭐ | 3 | P1-05 |
| P1-09 | 控制能力 | 强制完成单步 | ⭐⭐⭐⭐ | 2 | P0-15 |
| P1-10 | 控制能力 | 重新分配 Agent | ⭐⭐⭐⭐ | 3 | P0-08 |
| P1-11 | 模板管理 | 模板复制 | ⭐⭐⭐ | 2 | P0-01 |
| P1-12 | 模板管理 | 模板导入/导出 | ⭐⭐⭐ | 3 | P0-01 |
| P1-13 | 模板管理 | 历史版本回滚 | ⭐⭐⭐ | 3 | P0-04 |
| P1-14 | 思考链路 | Agent 推理过程展示 | ⭐⭐⭐⭐ | 5 | P1-07 |
| **合计** | | | | **49 人天** | |

### 9.3 P2 — v1.2 增强功能

**目标**：高级控制能力、统计分析、移动端适配

| # | 功能模块 | 功能点 | 用户价值 | 工作量（人天） | 依赖 |
|---|---------|--------|----------|--------------|------|
| P2-01 | 统计分析 | 工作流统计 Dashboard | ⭐⭐⭐⭐ | 5 | P0-17 |
| P2-02 | 统计分析 | Agent 统计分析 | ⭐⭐⭐⭐ | 3 | P2-01 |
| P2-03 | 统计分析 | 任务统计看板 | ⭐⭐⭐ | 3 | P2-01 |
| P2-04 | 高级控制 | 条件分支执行 | ⭐⭐⭐⭐ | 8 | P0-07 |
| P2-05 | 高级控制 | 并行步骤组 | ⭐⭐⭐⭐ | 5 | P0-07 |
| P2-06 | 高级控制 | 检查点机制 | ⭐⭐⭐ | 5 | P0-07 |
| P2-07 | 移动端 | 响应式设计 | ⭐⭐⭐⭐ | 8 | P0-12 |
| P2-08 | 移动端 | 审核操作（移动端） | ⭐⭐⭐⭐ | 3 | P2-07 |
| P2-09 | 集成 | Webhook 通知 | ⭐⭐⭐ | 3 | P0-18 |
| P2-10 | 集成 | 邮件/IM 通知 | ⭐⭐⭐ | 5 | P2-09 |
| P2-11 | 集成 | 嵌套工作流（子工作流） | ⭐⭐⭐ | 8 | P0-07 |
| **合计** | | | | **56 人天** | |

### 9.4 发布计划

| 版本 | 功能范围 | 预计工期 | 发布日期 |
|------|---------|---------|---------|
| **v1.0 MVP** | P0（18 个功能点） | 87 人天 ≈ 2.5 个月（3 人团队） | 2026-06-15 |
| **v1.1** | P0 + P1（32 个功能点） | 136 人天 ≈ 4 个月 | 2026-08-01 |
| **v1.2** | P0 + P1 + P2（43 个功能点） | 192 人天 ≈ 5.5 个月 | 2026-09-15 |

---

## 10. 与现有页面的集成点

### 10.1 与 Kanban 的集成

#### 10.1.1 工作流任务卡片

**展示方式**：
- 在现有看板中新增"工作流任务"类型
- 卡片样式区别于普通任务（特殊图标 + 标识）

**卡片内容**：

```
┌────────────────────────────────────┐
│ [WF] 研发流水线-需求新增            │ ← 标题
├────────────────────────────────────┤
│ 状态：运行中                        │ ← 状态徽章
│ ████████░░ 80%                     │ ← 进度条
│ 当前：Step 15 测试编写              │ ← 当前步骤
├────────────────────────────────────┤
│ Agent: rd-tester-func              │ ← Agent 信息
│ 预计剩余：45 分钟                   │ ← 时间估算
└────────────────────────────────────┘
```

**交互**：
- 点击卡片 → 跳转到工作流实例详情页
- 悬停卡片 → 显示简要信息（Tooltip）

#### 10.1.2 状态同步

| 工作流状态 | 看板列 | 说明 |
|-----------|--------|------|
| `pending` | 待办 | 工作流创建，未开始执行 |
| `running` | 进行中 | 工作流执行中 |
| `paused` | 进行中（暂停标识） | 工作流暂停，显示暂停图标 |
| `awaiting_review` | 待审核 | 等待人工审核 |
| `completed` | 完成 | 工作流成功完成 |
| `failed` | 完成（失败标识） | 工作流失败，显示失败原因 |
| `terminated` | 已取消 | 工作流被终止 |

#### 10.1.3 筛选器增强

在看板页面增加筛选器：

```
[ ] 显示工作流任务
[ ] 仅显示我创建的工作流
[ ] 仅显示待审核的工作流
```

### 10.2 与 Tasks 的集成

#### 10.2.1 任务与步骤关联

**关联方式**：
- 每个工作流步骤创建时，自动创建对应的任务记录
- 任务表新增字段：`workflow_instance_id`, `step_execution_id`

**任务详情页增强**：

在现有任务详情页增加"工作流信息"区块：

```
┌────────────────────────────────────┐
│ 工作流信息                          │
├────────────────────────────────────┤
│ 所属工作流：研发流水线-需求新增      │
│ 步骤：Step 15 测试编写               │
│ 工作流状态：运行中                   │
│ [查看工作流详情]                    │
└────────────────────────────────────┘
```

#### 10.2.2 统一 Agent 分配

**集成方式**：
- 工作流步骤的 Agent 分配复用现有任务的分配逻辑
- Agent 负载均衡统一管理（考虑工作流步骤 + 独立任务）

**分配优先级**：
1. 步骤指定 Agent ID → 直接分配
2. 步骤指定能力标签 → 匹配满足标签的 Agent
3. 无匹配 → 步骤进入等待队列

### 10.3 与 Sessions 的集成

#### 10.3.1 会话与步骤关联

**关联方式**：
- 每个工作流步骤执行时创建一个新的 Agent 会话
- 会话表新增字段：`workflow_instance_id`, `step_execution_id`

**会话详情页增强**：

在现有会话详情页增加"工作流上下文"区块：

```
┌────────────────────────────────────┐
│ 工作流上下文                        │
├────────────────────────────────────┤
│ 所属工作流：研发流水线-需求新增      │
│ 步骤：Step 15 测试编写               │
│ 前序产出：                          │
│  - Step 14: 送测提交记录            │
│  - Step 13: 联调验证结果            │
│ [查看工作流详情]                    │
└────────────────────────────────────┘
```

#### 10.3.2 日志聚合

**集成方式**：
- Agent 会话的日志自动记录到步骤执行日志
- 工作流详情页可查看每个步骤的完整会话日志
- 支持从步骤详情跳转到会话详情

#### 10.3.3 产物传递

**集成方式**：
- Agent 会话的产出文件记录为步骤输出
- 后续步骤通过引用访问前序步骤的产出
- 会话详情页显示产出在工作流中的引用关系

### 10.4 与 Dashboard 的集成

#### 10.4.1 新增统计卡片

在现有 Dashboard 增加"工作流"卡片：

```
┌────────────────────────────────────┐
│ 工作流                              │
├────────────────────────────────────┤
│ 运行中：3                           │
│ 待审核：2                           │
│ 今日完成：5                         │
│ [查看全部]                          │
└────────────────────────────────────┘
```

#### 10.4.2 活动流增强

在"最近活动"列表中增加工作流相关事件：

```
● 10:35 [工作流] 研发流水线-需求新增 完成审核（Step 3）
● 10:20 [工作流] 数据分析流水线 启动成功
● 10:15 [工作流] 研发流水线-需求新增 进入 Step 3（PRD + 需求评审）
```

### 10.5 与 Agents 页面的集成

#### 10.5.1 Agent 详情页增强

在现有 Agent 详情页的"任务"Tab 中增加工作流步骤：

```
当前任务：
┌────────────────────────────────────┐
│ [WF] 研发流水线-需求新增            │
│ Step 15: 测试编写                   │
│ 进度：80% | 预计剩余：10 分钟        │
│ [查看工作流]                        │
└────────────────────────────────────┘
```

#### 10.5.2 Agent 负载显示

在 Agent 列表中显示工作流相关负载：

```
Agent: rd-backend-dev
状态：运行中
当前任务：2（独立任务: 1, 工作流步骤: 1）
```

### 10.6 数据流图

```
┌──────────────┐
│   用户操作    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│                    前端页面层                              │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│  Kanban  │  Tasks   │ Sessions │ Workflow │  Dashboard  │
└──────┬───┴─────┬────┴────┬─────┴────┬─────┴──────┬──────┘
       │         │           │          │            │
       │         │           │          │            │
       └─────────┴───────────┴──────────┴────────────┘
                           │
                           ▼
       ┌───────────────────────────────────────┐
       │           RESTful API 层              │
       │  /api/v1/workflows                   │
       │  /api/v1/workflow-templates          │
       │  /api/v1/reviews                     │
       └───────────────┬───────────────────────┘
                       │
                       ▼
       ┌───────────────────────────────────────┐
       │         业务逻辑层（FastAPI）          │
       ├───────────────────────────────────────┤
       │  WorkflowService                      │
       │  TemplateService                      │
       │  SchedulerService（DAG 调度器）        │
       │  AgentMatcherService                  │
       │  ReviewService                        │
       └───────────────┬───────────────────────┘
                       │
                       ▼
       ┌───────────────────────────────────────┐
       │         数据访问层（SQLAlchemy）       │
       └───────────────┬───────────────────────┘
                       │
                       ▼
       ┌───────────────────────────────────────┐
       │         数据库层（PostgreSQL）         │
       ├───────────────────────────────────────┤
       │  workflow_templates                   │
       │  workflow_instances                   │
       │  step_executions                      │
       │  review_records                       │
       │  agents                               │
       │  tasks（现有表，增加字段）             │
       │  sessions（现有表，增加字段）          │
       └───────────────────────────────────────┘

       ┌───────────────────────────────────────┐
       │         外部系统集成                   │
       ├───────────────────────────────────────┤
       │  OpenClaw Gateway API（Agent 调度）   │
       │  WebSocket Server（实时推送）         │
       │  Notification Service（邮件/IM）      │
       └───────────────────────────────────────┘
```

---

## 附录

### A. 术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| 工作流模板 | Workflow Template | 预定义的任务链结构，包含步骤顺序、依赖关系、Agent 分配、审核点等 |
| 工作流实例 | Workflow Instance | 模板的一次具体执行，包含实际状态、进度、日志、产出 |
| 步骤 | Step | 工作流中的单个任务节点，指定 Agent、输入、输出、验证条件 |
| DAG | Directed Acyclic Graph | 有向无环图，表示步骤依赖关系和执行顺序 |
| 人工审核点 | Human Review Point | 执行到该步骤时暂停，等待人工 Approve/Reject/Request Changes |
| Agent 能力标签 | Agent Capability Tag | Agent 的技能标识，如 `backend`, `frontend`, `research` |
| 状态机 | State Machine | 定义步骤/工作流的生命周期状态和流转规则 |
| 拓扑排序 | Topological Sort | DAG 的执行顺序算法，保证依赖关系正确 |
| 乐观锁 | Optimistic Lock | 基于版本号的并发控制机制 |
| 悲观锁 | Pessimistic Lock | 基于锁定的并发控制机制 |
| 熔断器 | Circuit Breaker | 故障快速失败机制，防止级联故障 |
| 降级 | Degradation | 功能降级以保证核心功能可用 |
| 指数退避 | Exponential Backoff | 重试间隔按指数增长的策略 |

### B. 参考资料

1. **已有文档**：
   - `/root/.openclaw/workspace/docs/rd-team-workflow.md` — 20 步研发流水线定义
   - `/root/.openclaw/workspace/project/openclaw-control-plane/docs/requirements/workflow-management.md` — 需求文档
   - `/root/.openclaw/workspace/project/openclaw-control-plane/docs/requirements/agent-workflow-v2.md` — v2 技术需求草稿

2. **竞品参考**：
   - **LangGraph Studio**：DAG 可视化和调试，交互式步骤查看
   - **n8n**：工作流自动化平台，节点拖拽编辑
   - **GitHub Actions**：CI/CD 流水线可视化，实时日志
   - **Jira**：看板和任务管理，工作流状态流转
   - **Linear**：简洁的任务管理，快速操作

3. **技术文档**：
   - React Flow：https://reactflow.dev/ — React DAG 可视化库
   - FastAPI：https://fastapi.tiangolo.com/ — Python Web 框架
   - SQLAlchemy：https://www.sqlalchemy.org/ — Python ORM
   - WebSocket：https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   - Dagre：https://github.com/dagrejs/dagre — DAG 布局算法

### C. 文档版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-04-01 | rd-product-manager | 初始版本，包含完整 PRD |

---

**PRD 文档完成**

> **下一步**：由 rd-pm-checker 进行互审，列出 ≥3 个具体问题，逐条回复后进入 Step 4 需求冻结
