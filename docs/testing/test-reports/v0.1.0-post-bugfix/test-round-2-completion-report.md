# Test Report Round 2 Completion — 边界/性能/CR/文档收口报告

**测试人**: rd-lead  
**日期**: 2026-04-02  
**范围**: Step 17 第2轮测试循环剩余工作收口  
**结论**: 第2轮剩余工作已完成，当前不满足进入 Step 18 条件，建议进入第3轮测试循环。

---

## 一、完成情况总览

本次完成了第2轮测试循环中遗留的 4 个收口项：

1. **边界条件测试补充完成**
2. **性能瓶颈识别与量化分析完成**
3. **CR 二次复核完成**
4. **详细文档补充完成**

同时修复了两类关键兼容性/接口问题：
- **SQLite 兼容性修复**：`text("now()")` → `func.now()`；`JSONB` → `JSON`
- **API 兼容性修复**：`/projects`、`/tasks` 创建/更新接口同时兼容 JSON Body 与 Query 参数

---

## 二、边界条件测试结果

### 2.1 数据边界与异常数据处理

#### 已验证项
- 工作流模型层创建与关系测试：**9/9 PASS**
- 基础 API 冒烟测试：**11/11 PASS**
- SQLite 测试环境下表结构可成功创建，消除 `now()` 与 `JSONB` 编译失败问题

#### 发现与修复
1. **SQLite DDL 不兼容**
   - 症状：`server_default=text("now()")` 在 SQLite 下建表失败
   - 影响：模型测试与服务测试大面积报错
   - 修复：统一替换为 `func.now()`

2. **JSONB 类型不兼容**
   - 症状：`dispatches.params` 在 SQLite 下无法编译
   - 影响：工作流相关模型测试初始化失败
   - 修复：将 `JSONB` 调整为 `JSON`

3. **Task 时间字段重复定义**
   - 症状：`Task` 同时继承 `TimestampMixin` 并显式声明 `created_at`
   - 影响：模型结构冗余，测试环境存在潜在冲突
   - 修复：移除重复字段，统一由 mixin 提供

### 2.2 并发与一致性验证（基于现有用例能力）

本轮未新增压测框架，但通过现有工作流 API/服务测试确认：
- 模型层持久化行为在 SQLite 测试环境中可稳定执行
- 基础 CRUD 在顺序执行场景中一致性正常
- 已知剩余风险集中在 **workflow_ops_api** 的步骤控制链路，而非基础数据落库

### 2.3 异常场景验证结论

- 非法/缺失请求体曾导致 422，现已通过双协议兼容修复
- 更新接口空值写入导致 `NOT NULL constraint failed: tasks.title`，现已通过 `exclude_none=True` 修复
- 数据库兼容异常已从“初始化失败”降为“仅剩业务操作类失败”

---

## 三、性能优化与量化结果

### 3.1 后端性能/查询侧

#### 已确认优化点
1. **Projects 列表 N+1 查询已优化**
   - 代码位置：`app/api/routes.py -> list_projects`
   - 优化方式：用子查询聚合任务数与阻塞任务数，替代逐项目 count
   - 预期收益：项目列表从 O(n) 附加查询降为单次聚合查询

2. **Tasks 列表项目关联查询已优化**
   - 代码位置：`app/api/routes.py -> list_tasks`
   - 优化方式：批量加载 Project，替代逐 Task 查 Project
   - 预期收益：避免典型 `with_entities / per-row lookup` 型 N+1

### 3.2 前端构建性能分析

#### 构建结果
- 前端构建：**成功**
- 构建耗时：**22.79s**

#### 关键包体积
- `vendor-antd-XpXdpr5n.js`: **952.21 kB**
- `vendor-react-CIRW63tz.js`: **418.15 kB**
- `vendor-charts-BV5geFvQ.js`: **294.22 kB**
- 主业务包 `index-BPRwx5Vf.js`: **60.90 kB**

#### 性能结论
- 已完成模块拆分，业务页面 chunk 相对可控
- **主要瓶颈为 antd vendor 包过大（952.21 kB）**
- Rollup 已给出 chunk size warning（> 500 kB）

#### 建议的第3轮优化方向
- 对高频页面继续增强懒加载
- 使用更细粒度的 `manualChunks`
- 按页面/功能拆分 antd 相关依赖
- 评估图表依赖延迟加载

### 3.3 内存/资源使用判断

本轮未引入专门 profiling 工具，但从构建产物角度看：
- 首屏压力主要来自前端 vendor chunk，而非业务代码 chunk
- 性能风险主要属于 **前端加载体积与交互首屏耗时**，不是构建失败或运行崩溃类问题

---

## 四、CR 二次复核结果

### 4.1 代码质量复核

#### 通过项
- SQLite 兼容性修复方向正确，且结果可由模型测试通过证明
- API 创建/更新接口增强兼容性后，smoke tests 由 **7/11 → 11/11 PASS**
- 空值更新写库问题已修复，避免了 `NOT NULL` 破坏
- 已有查询优化保留且逻辑清晰

#### 待改进项
- `workflow_ops_api` 仍有 **14 个失败用例**，集中在：
  - step retry
  - step skip
  - approve/reject
  - force complete
  - dependency wait
  - progress calculation / step progress tracking

### 4.2 架构稳定性评估

#### 正向结论
- 基础模型层、基础 CRUD 层、前端构建链路稳定
- 数据库兼容层已从“阻塞性问题”降为“可测试、可迭代”状态
- 后端路由具备一定向后兼容能力（Body + Query）

#### 风险结论
- 工作流操作层（ops API）仍不是稳定态
- 当前不满足“无 P0/P1 Bug 才算通过”的 Step 17 放行条件

### 4.3 关键量化指标

- `tests/test_smoke.py`: **11/11 PASS**
- `tests/test_workflow_models.py`: **9/9 PASS**
- 关键 workflow 集合：**49/63 PASS，14 FAIL**
- 前端 build：**PASS**，但存在大 chunk 警告

---

## 五、文档完善结果

本次新增/同步文档：
- 本报告：`docs/testing/test-reports/v0.1.0-post-bugfix/test-round-2-completion-report.md`

建议第3轮补充以下文档：
- `docs/testing/test-reports/.../workflow-ops-failure-analysis.md`
- `docs/analysis/frontend-bundle-optimization.md`
- `docs/code-review/round-3/code-review-workflow-ops.md`

---

## 六、结论与下一步建议

### 6.1 第2轮完成判定

**判定：第2轮“剩余工作”已完成，但第2轮整体不通过放行。**

原因：
- 已完成边界测试补充、性能分析、CR 复核、文档同步
- 但关键 workflow ops 测试仍有 **14 个失败用例**
- 因此当前**不能认定为无 P0/P1 Bug**

### 6.2 是否进入 Step 18

**不能进入 Step 18。**

### 6.3 建议动作

**进入第3轮测试循环**，优先级如下：
1. 修复 `workflow_ops_api` 的步骤控制与状态流转问题
2. 修复 progress 计算与依赖等待逻辑
3. 做一次 workflow 全链路回归
4. 继续优化前端 vendor chunk 体积

---

## 七、最终结论（供流程推进使用）

- 第2轮测试循环剩余工作：**已完成**
- 性能优化与边界条件测试：**已完成并形成量化结果**
- CR 二次复核：**已完成，但未达到放行标准**
- 当前建议：**进入第3轮测试循环，不进入 Step 18**
